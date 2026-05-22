import "@testing-library/jest-dom";

// Polyfill web standard globals that JSDOM environment lacks but Next.js 16 server imports require
if (typeof global.Request === 'undefined') {
  global.Request = globalThis.Request;
}
if (typeof global.Response === 'undefined') {
  global.Response = globalThis.Response;
}
if (typeof global.Headers === 'undefined') {
  global.Headers = globalThis.Headers;
}

// Mock global fetch to prevent ReferenceError: fetch is not defined during tests
global.fetch = jest.fn().mockImplementation((url: string) => {
  if (url.includes("/api/vault")) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          balance: "1.2345",
          threshold: 1000,
          executed: 5,
          blocked: 3,
          vaultAddress: "0x77435CF556A3705496Aa3739bD3678D9edfcB69c",
          rpcUrl: "https://rpc.testnet.chain.robinhood.com",
        }),
    });
  }
  if (url.includes("/trades.json")) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            txHash: "0x123",
            asset: "ETH",
            status: "executed",
            varianceBps: 120,
            thresholdBps: 1000,
            value: "1.0 ETH",
            timestamp: "2026-05-22T07:42:50Z",
            prices: [3200, 3210, 3205],
          },
        ]),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});
