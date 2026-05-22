import { NextResponse } from "next/server";

export async function GET() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.chain.robinhood.com";
  const vaultAddress = process.env.NEXT_PUBLIC_VAULT_ADDRESS;
  const riskEngineAddress = process.env.NEXT_PUBLIC_RISK_ENGINE_ADDRESS || "";

  if (!vaultAddress) {
    return NextResponse.json({
      error: "NEXT_PUBLIC_VAULT_ADDRESS environment variable not set",
      rpcUrl,
      balance: "0.0000",
      threshold: 1000,
      executed: 0,
      blocked: 0,
      vaultAddress: "",
      riskEngineAddress,
    });
  }

  try {
    // 1. Fetch balance() (returns uint256)
    const balanceRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          {
            to: vaultAddress,
            data: "0xb69ef8a8", // balance()
          },
          "latest",
        ],
      }),
    });
    const balanceData = await balanceRes.json();
    const balanceHex = balanceData.result || "0x0";
    const balanceWei = BigInt(balanceHex);
    // Convert to Ether string (18 decimals)
    const balanceEth = (Number(balanceWei) / 1e18).toFixed(4);

    // 2. Fetch volatilityThresholdBps() (returns uint256)
    const thresholdRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "eth_call",
        params: [
          {
            to: vaultAddress,
            data: "0x71084cda", // volatilityThresholdBps()
          },
          "latest",
        ],
      }),
    });
    const thresholdData = await thresholdRes.json();
    const thresholdHex = thresholdData.result || "0x3e8"; // 1000 bps
    const thresholdBps = Number(BigInt(thresholdHex));

    // 3. Fetch stats() (returns (uint256, uint256))
    const statsRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "eth_call",
        params: [
          {
            to: vaultAddress,
            data: "0xd80528ae", // stats()
          },
          "latest",
        ],
      }),
    });
    const statsData = await statsRes.json();
    const statsHex = statsData.result || "0x";
    let executed = 0;
    let blocked = 0;
    if (statsHex && statsHex.length >= 130) {
      // First 32 bytes (64 chars after '0x') is executed
      const execHex = "0x" + statsHex.slice(2, 66);
      // Next 32 bytes (64 chars) is blocked
      const blockHex = "0x" + statsHex.slice(66, 130);
      executed = Number(BigInt(execHex));
      blocked = Number(BigInt(blockHex));
    }

    return NextResponse.json({
      balance: balanceEth,
      threshold: thresholdBps,
      executed,
      blocked,
      vaultAddress,
      riskEngineAddress,
      rpcUrl,
    });
  } catch (error: unknown) {
    console.error("Error calling RPC:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to query RPC";
    return NextResponse.json({
      error: errorMessage,
      rpcUrl,
      balance: "0.0000",
      threshold: 1000,
      executed: 0,
      blocked: 0,
      vaultAddress,
      riskEngineAddress,
    });
  }
}
