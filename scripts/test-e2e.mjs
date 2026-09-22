import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT = "0x95Ff2075f20b638647Fc3417989F1FdC3254b000";
const PRIVATE_KEY = "0x30488520d4ab1c90d3ad114b9bcc252a26992739c869f903f4464d4d27d89a50";

async function main() {
  const account = createAccount(PRIVATE_KEY);
  const client = createClient({ chain: studionet, account });

  // Step 1: Check status
  const status = await client.readContract({
    address: CONTRACT,
    functionName: "get_status",
    args: ["test-002"],
  });
  console.log("Status:", status);

  // Step 2: lock_escrow with 0.5 GEN value
  const value = BigInt(5) * BigInt(10 ** 17); // 0.5 GEN
  console.log("Locking escrow with value:", value.toString(), "wei");

  const txHash = await client.writeContract({
    address: CONTRACT,
    functionName: "lock_escrow",
    args: ["test-002", 0n, 0n],
    value,
  });
  console.log("lock_escrow tx:", txHash);

  const receipt = await client.waitForTransactionReceipt({ hash: txHash, status: "FINALIZED" });
  console.log("lock_escrow result:", receipt.status_name);

  // Step 3: start_execution
  const tx2 = await client.writeContract({
    address: CONTRACT,
    functionName: "start_execution",
    args: ["test-001"],
  });
  console.log("start_execution tx:", tx2);
  const r2 = await client.waitForTransactionReceipt({ hash: tx2, status: "FINALIZED" });
  console.log("start_execution result:", r2.status_name);

  // Step 4: submit_evidence
  const tx3 = await client.writeContract({
    address: CONTRACT,
    functionName: "submit_evidence",
    args: ["test-001", "https://gist.githubusercontent.com/test/evidence.json", Math.floor(Date.now() / 1000)],
  });
  console.log("submit_evidence tx:", tx3);
  const r3 = await client.waitForTransactionReceipt({ hash: tx3, status: "FINALIZED" });
  console.log("submit_evidence result:", r3.status_name);

  // Check final status
  const finalStatus = await client.readContract({
    address: CONTRACT,
    functionName: "get_status",
    args: ["test-001"],
  });
  console.log("Final status:", finalStatus);
}

main().catch(console.error);
