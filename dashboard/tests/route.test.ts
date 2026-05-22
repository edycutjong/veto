// Mock next/server before importing the route
class MockResponse {
  private _json: unknown;
  public status: number;

  constructor(json: unknown, options?: { status?: number }) {
    this._json = json;
    this.status = options?.status ?? 200;
  }

  async json() {
    return this._json;
  }
}

jest.mock("next/server", () => {
  return {
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => {
        return new MockResponse(body, init);
      }
    }
  };
});

import { GET } from "../src/app/api/vault/route";

describe("Vault API Route", () => {
  const originalEnv = process.env;

  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns error if NEXT_PUBLIC_VAULT_ADDRESS is not set", async () => {
    delete process.env.NEXT_PUBLIC_VAULT_ADDRESS;

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.error).toBe("NEXT_PUBLIC_VAULT_ADDRESS environment variable not set");
    expect(data.balance).toBe("0.0000");
    expect(data.threshold).toBe(1000);
    expect(data.executed).toBe(0);
    expect(data.blocked).toBe(0);
  });

  it("handles successful RPC calls and correctly parses balance, threshold, and stats", async () => {
    process.env.NEXT_PUBLIC_VAULT_ADDRESS = "0x77435CF556A3705496Aa3739bD3678D9edfcB69c";
    process.env.NEXT_PUBLIC_RPC_URL = "https://mock-rpc-url.com";

    // Mock global fetch specifically for the RPC calls
    const mockFetch = jest.spyOn(global, "fetch").mockImplementation((_url, options) => {
      const body = JSON.parse(options?.body as string);
      
      let result = "0x0";
      if (body.params[0].data === "0xb69ef8a8") {
        // balance() -> returns 1 ETH (1 * 10^18 in wei)
        result = "0xde0b6b3a7640000";
      } else if (body.params[0].data === "0x71084cda") {
        // volatilityThresholdBps() -> returns 1000
        result = "0x3e8";
      } else if (body.params[0].data === "0xd80528ae") {
        // stats() -> returns (5 executed, 10 blocked)
        result = "0x" + 
          "0000000000000000000000000000000000000000000000000000000000000005" +
          "000000000000000000000000000000000000000000000000000000000000000a";
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result }),
      } as Response);
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.error).toBeUndefined();
    expect(data.balance).toBe("1.0000");
    expect(data.threshold).toBe(1000);
    expect(data.executed).toBe(5);
    expect(data.blocked).toBe(10);
    expect(data.vaultAddress).toBe("0x77435CF556A3705496Aa3739bD3678D9edfcB69c");

    mockFetch.mockRestore();
  });

  it("handles malformed stats responses correctly by defaulting executed/blocked to 0", async () => {
    process.env.NEXT_PUBLIC_VAULT_ADDRESS = "0x77435CF556A3705496Aa3739bD3678D9edfcB69c";

    const mockFetch = jest.spyOn(global, "fetch").mockImplementation((_url, options) => {
      const body = JSON.parse(options?.body as string);
      
      let result = "0x0";
      if (body.params[0].data === "0xd80528ae") {
        // stats() -> returns malformed short result
        result = "0x123";
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result }),
      } as Response);
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.executed).toBe(0);
    expect(data.blocked).toBe(0);

    mockFetch.mockRestore();
  });

  it("handles RPC network/fetch failures gracefully by returning an error response", async () => {
    process.env.NEXT_PUBLIC_VAULT_ADDRESS = "0x77435CF556A3705496Aa3739bD3678D9edfcB69c";

    const mockFetch = jest.spyOn(global, "fetch").mockImplementation(() => {
      return Promise.reject(new Error("RPC Connection Failed"));
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.error).toBe("RPC Connection Failed");
    expect(data.balance).toBe("0.0000");
    expect(data.threshold).toBe(1000);
    expect(data.executed).toBe(0);
    expect(data.blocked).toBe(0);

    mockFetch.mockRestore();
  });

  it("handles non-Error exceptions gracefully when RPC fetch fails", async () => {
    process.env.NEXT_PUBLIC_VAULT_ADDRESS = "0x77435CF556A3705496Aa3739bD3678D9edfcB69c";

    const mockFetch = jest.spyOn(global, "fetch").mockImplementation(() => {
      return Promise.reject("Unexpected string error");
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.error).toBe("Failed to query RPC");

    mockFetch.mockRestore();
  });

  it("handles missing/null results in RPC response by defaulting correctly", async () => {
    process.env.NEXT_PUBLIC_VAULT_ADDRESS = "0x77435CF556A3705496Aa3739bD3678D9edfcB69c";

    const mockFetch = jest.spyOn(global, "fetch").mockImplementation(() => {
      // Return empty response with no result field to trigger || fallbacks
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.balance).toBe("0.0000"); // fallback from 0x0
    expect(data.threshold).toBe(1000);   // fallback from 0x3e8
    expect(data.executed).toBe(0);        // fallback from 0x
    expect(data.blocked).toBe(0);

    mockFetch.mockRestore();
  });
});
