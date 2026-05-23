import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import Page from "../src/app/dashboard/page";

describe("Dashboard Page", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    (console.error as jest.Mock).mockRestore();
  });

  it("renders basic skeleton and stats cards with default values", async () => {
    render(<Page />);

    expect(screen.getByText("CONNECTED LIVE")).toBeInTheDocument();
    expect(screen.getByText("WASM Risk Engine • Robinhood Chain")).toBeInTheDocument();
    expect(screen.getByText("Vault Balance")).toBeInTheDocument();
    expect(screen.getByText("Trades Executed")).toBeInTheDocument();
    expect(screen.getByText("Trades Blocked")).toBeInTheDocument();
    expect(screen.getByText("Funds Saved")).toBeInTheDocument();
  });

  it("fetches and renders vault stats and trade history successfully", async () => {
    // 1. Mock api and trades fetch calls
    const mockVaultStats = {
      balance: "1.5000",
      threshold: 1500,
      executed: 12,
      blocked: 7,
      vaultAddress: "0x77435CF556A3705496Aa3739bD3678D9edfcB69c",
      riskEngineAddress: "0x0a94398c550226ca01570afede89e378d81e9426",
      rpcUrl: "https://rpc.testnet.chain.robinhood.com",
    };

    const mockTrades = [
      {
        id: 1,
        txHash: "0xhash123",
        asset: "RUGCOIN",
        status: "blocked",
        varianceBps: 2450,
        thresholdBps: 1500,
        value: "0.5 ETH",
        timestamp: "2026-05-22T08:00:00Z",
        prices: [100, 200, 150, 300],
      },
      {
        id: 2,
        txHash: "0xhash456",
        asset: "ETH",
        status: "executed",
        varianceBps: 200,
        thresholdBps: 1500,
        value: "1.0 ETH",
        timestamp: "2026-05-22T07:30:00Z",
        prices: [3200, 3210, 3205],
      },
      {
        id: 3,
        txHash: "",
        asset: "USDC",
        status: "pending",
        varianceBps: 10,
        thresholdBps: 1500,
        value: "100.0 USDC",
        timestamp: "2026-05-22T07:00:00Z",
        prices: [1.0, 1.0, 1.0],
      },
      {
        id: 4,
        txHash: "0xhash789",
        asset: "NO_PRICES",
        status: "executed",
        varianceBps: 0,
        thresholdBps: 1500,
        value: "0.0 ETH",
        timestamp: "2026-05-22T06:30:00Z",
        prices: [], // Triggers empty prices branch in PriceChart
      }
    ];

    const mockFetch = jest.spyOn(global, "fetch").mockImplementation((url) => {
      if (url === "/api/vault") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVaultStats),
        } as Response);
      }
      if (url === "/trades.json") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTrades),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });

    render(<Page />);

    // Fast-forward timers to trigger intervals
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    // Verify stats update on screen
    await waitFor(() => {
      expect(screen.getByText("1.5000 ETH")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument(); // Executed stat card
      expect(screen.getByText("1")).toBeInTheDocument();  // Blocked stat card (comes from trades.filter length)
    });

    // Verify trade history elements
    expect(screen.getByText("RUGCOIN")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("NO_PRICES")).toBeInTheDocument();

    // Verify badges
    expect(screen.getAllByText("BLOCKED")[0]).toBeInTheDocument();
    expect(screen.getAllByText("EXECUTED")[0]).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();

    // Verify transaction verification link
    expect(screen.getAllByText("Verify")[0]).toBeInTheDocument();
    expect(screen.getByText("TX: 0xhash123...")).toBeInTheDocument();

    // Verify Custom Error message renders
    expect(screen.getByText("VolatilityExceedsThreshold(2450, 1500)")).toBeInTheDocument();

    // Verify terminal contains agent commands and outputs
    expect(screen.getByText("$ veto-agent --mode live --monitor")).toBeInTheDocument();
    expect(screen.getAllByText("[BLOCK] REVERTED: VolatilityExceedsThreshold(2450, 1500)")[0]).toBeInTheDocument();
    expect(screen.getAllByText("[PASS] EXECUTED: On-chain transaction executed successfully")[0]).toBeInTheDocument();

    mockFetch.mockRestore();
  });

  it("handles fetch errors gracefully in page intervals", async () => {
    const mockFetch = jest.spyOn(global, "fetch").mockImplementation(() => {
      return Promise.reject(new Error("Network Failure"));
    });

    render(<Page />);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Failed to fetch vault statistics:",
        expect.any(Error)
      );
      expect(console.error).toHaveBeenCalledWith(
        "Failed to fetch trades log:",
        expect.any(Error)
      );
    });

    mockFetch.mockRestore();
  });

  it("handles non-ok API responses correctly", async () => {
    const mockFetch = jest.spyOn(global, "fetch").mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 500,
      } as Response);
    });

    render(<Page />);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    // Should fail silently, state shouldn't break and basic elements are still present
    expect(screen.getByText("CONNECTED LIVE")).toBeInTheDocument();

    mockFetch.mockRestore();
  });

  it("uses agent url if environment variable is set", async () => {
    const originalEnv = process.env.NEXT_PUBLIC_AGENT_URL;
    process.env.NEXT_PUBLIC_AGENT_URL = "http://mock-agent.com";

    const mockFetch = jest.spyOn(global, "fetch").mockImplementation((url) => {
      if (url === "http://mock-agent.com/api/trades") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });

    render(<Page />);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockFetch).toHaveBeenCalledWith("http://mock-agent.com/api/trades");

    mockFetch.mockRestore();
    process.env.NEXT_PUBLIC_AGENT_URL = originalEnv;
  });


  it("toggles scanline shaking animation on Simulate Block click", async () => {
    render(<Page />);

    const button = screen.getByText("Simulate Block");
    expect(button).toBeInTheDocument();

    // Click to simulate block
    fireEvent.click(button);

    // Scanline should contain shaking class
    const mainContainer = screen.getByText("CONNECTED LIVE").closest(".scanline");
    expect(mainContainer).toHaveClass("shake");

    // Fast-forward 500ms for animation timeout
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mainContainer).not.toHaveClass("shake");
  });
});
