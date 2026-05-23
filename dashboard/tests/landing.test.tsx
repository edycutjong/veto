import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import LandingPage from "../src/app/page";

describe("Landing Page", () => {
  let originalRAF: typeof window.requestAnimationFrame;
  let originalCAF: typeof window.cancelAnimationFrame;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    jest.useFakeTimers();

    // Mock requestAnimationFrame and cancelAnimationFrame using setTimeout/clearTimeout to avoid recursion stack overflow
    originalRAF = window.requestAnimationFrame;
    originalCAF = window.cancelAnimationFrame;
    window.requestAnimationFrame = jest.fn().mockImplementation((cb) => {
      return setTimeout(() => cb(0), 16) as unknown as number;
    });
    window.cancelAnimationFrame = jest.fn().mockImplementation((id) => {
      clearTimeout(id);
    });

    // Mock HTMLCanvasElement.prototype.getContext
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCAF;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("renders the landing page correctly", () => {
    render(<LandingPage />);

    expect(screen.getByText(/Your AI agent tried to/i)).toBeInTheDocument();
    expect(screen.getAllByText("VE")[0]).toBeInTheDocument();
    expect(screen.getAllByText("TO")[0]).toBeInTheDocument();
    expect(screen.getByText("Launch Security Console")).toBeInTheDocument();
    expect(screen.getByText("Run Execution Dry-Run")).toBeInTheDocument();
  });

  it("handles mouse interactions and window resize for CanvasBackground", () => {
    // Mock Math.random to place particles in a deterministic close-knit cluster
    const originalRandom = Math.random;
    Math.random = () => 0.1;

    const { container } = render(<LandingPage />);

    Math.random = originalRandom;

    // Simulate window resize
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Simulate mouse move
    act(() => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 100, clientY: 100 })
      );
    });

    // Advance timers so the animation loop runs with mouse coordinates active, long enough to trigger boundary bouncing
    act(() => {
      jest.advanceTimersByTime(20000);
    });

    // Simulate mouse leave
    act(() => {
      document.body.dispatchEvent(new MouseEvent("mouseleave"));
    });

    // Just verify the canvas is still present
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("runs the dry-run simulation for RUGCOIN (reverts/blocked)", () => {
    render(<LandingPage />);

    // Select RUGCOIN (should be selected by default, but let's click it explicitly)
    const rugcoinButton = screen.getByText("⚠ RUGCOIN");
    fireEvent.click(rugcoinButton);

    const runButton = screen.getByText("Run Execution Dry-Run");
    fireEvent.click(runButton);

    // Initial state: Processing...
    expect(screen.getByText("Processing...")).toBeInTheDocument();
    expect(screen.getByText("$ veto-agent --mode dry-run --asset RUGCOIN")).toBeInTheDocument();

    // Advance to step 1 (600ms)
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.getByText("[Agent] Market opportunity detected: RUGCOIN")).toBeInTheDocument();

    // Advance to step 2 (1400ms - starts evaluating)
    act(() => {
      jest.advanceTimersByTime(800); // 600 + 800 = 1400
    });
    expect(screen.getByText("[WASM] Loading Stylus risk engine on Robinhood Chain...")).toBeInTheDocument();

    // Advance to step 3 (2400ms - result: blocked)
    act(() => {
      jest.advanceTimersByTime(1000); // 1400 + 1000 = 2400
    });
    expect(screen.getByText("[VETO] REVERTED: VolatilityExceedsThreshold(2450, 1000)")).toBeInTheDocument();
    expect(screen.getByText("✗ REVERTED: VolatilityExceedsThreshold(2450, 1000)")).toBeInTheDocument();
  });

  it("runs the dry-run simulation for ETH (approved/executed)", () => {
    render(<LandingPage />);

    // Select ETH
    const ethButton = screen.getByText("◆ ETH");
    fireEvent.click(ethButton);

    const runButton = screen.getByText("Run Execution Dry-Run");
    fireEvent.click(runButton);

    // Initial state: Processing...
    expect(screen.getByText("Processing...")).toBeInTheDocument();
    expect(screen.getByText("$ veto-agent --mode dry-run --asset ETH")).toBeInTheDocument();

    // Advance to step 1 (600ms)
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.getByText("[Agent] Market opportunity detected: ETH")).toBeInTheDocument();

    // Advance to step 2 (1400ms)
    act(() => {
      jest.advanceTimersByTime(800);
    });

    // Advance to step 3 (2400ms - result: executed)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("[VETO] APPROVED: Forwarding to VetoVault")).toBeInTheDocument();
    expect(screen.getByText("✓ EXECUTED: Swap confirmed · TX: 0x8dfb2...ce32")).toBeInTheDocument();
  });

  it("handles null canvas context gracefully", () => {
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(null);
    render(<LandingPage />);
    expect(screen.getByText(/Your AI agent tried to/i)).toBeInTheDocument();
  });

  it("handles null canvas ref gracefully", () => {
    let callCount = 0;
    const mockUseRef = jest.spyOn(React, "useRef").mockImplementation((initialValue) => {
      callCount++;
      if (callCount === 1) {
        return { current: null };
      }
      return { current: initialValue };
    });

    render(<LandingPage />);
    expect(screen.getByText(/Your AI agent tried to/i)).toBeInTheDocument();
    mockUseRef.mockRestore();
  });
});
