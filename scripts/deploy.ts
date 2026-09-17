// Deploy the VerdictArc intelligent contract to GenLayer Studio (studionet).
//
// Usage:
//   GENLAYER_ENDPOINT=https://studio.genlayer.com/api \
//   GENLAYER_PRIVATE_KEY=0x... \
//   npx tsx scripts/deploy.ts
//
// Prints the deployed contract address to set as GENLAYER_CONTRACT
// (and VITE_GENLAYER_CONTRACT for the frontend).

import { readFileSync } from "fs";
import path from "path";
import {
  TransactionHash,
  TransactionStatus,
  type GenLayerClient,
  DecodedDeployData,
} from "genlayer-js/types";
import { getGenLayerClient } from "../src/real/adapter.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var ${name}`);
  }
  return value.trim();
}

async function deploy(client: GenLayerClient<any>): Promise<string> {
  const filePath = path.resolve(process.cwd(), "contracts/verdict_arc.py");
  const contractCode = new Uint8Array(readFileSync(filePath));

  await (client as any).initializeConsensusSmartContract?.();

  const deployTransaction = await (client as any).deployContract({
    code: contractCode,
    args: [],
  });

  const receipt = await client.waitForTransactionReceipt({
    hash: deployTransaction as TransactionHash,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
  });

  if (
    receipt.status !== 5 &&
    receipt.status !== 6 &&
    (receipt as any).statusName !== "ACCEPTED" &&
    (receipt as any).statusName !== "FINALIZED"
  ) {
    throw new Error(`Deployment failed. Receipt: ${JSON.stringify(receipt)}`);
  }

  const deployedContractAddress =
    (receipt as any).data?.contract_address ??
    ((receipt as any).txDataDecoded as DecodedDeployData | undefined)?.contractAddress ??
    (receipt as any).txDataDecoded?.contract_address;

  if (!deployedContractAddress) {
    throw new Error(
      `Could not read deployed address from receipt: ${JSON.stringify(receipt)}`
    );
  }
  return deployedContractAddress;
}

async function main(): Promise<void> {
  const endpoint = requireEnv("GENLAYER_ENDPOINT");
  requireEnv("GENLAYER_PRIVATE_KEY");
  if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
    console.warn(
      "Warning: deploying to localhost, but project default is Studio (https://studio.genlayer.com/api)."
    );
  }
  const client = getGenLayerClient();
  const address = await deploy(client);
  console.log("VerdictArc deployed at:", address);
  console.log("Set GENLAYER_CONTRACT and VITE_GENLAYER_CONTRACT to this address.");
}

main().catch((error) => {
  console.error("Deploy failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
