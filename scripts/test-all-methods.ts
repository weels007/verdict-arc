import "dotenv/config";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { execSync } from "child_process";

const ENDPOINT = process.env.GENLAYER_ENDPOINT ?? "https://studio.genlayer.com/api";
const PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;
const CONTRACT = process.env.GENLAYER_CONTRACT;

if (!PRIVATE_KEY) throw new Error("Missing GENLAYER_PRIVATE_KEY");
if (!CONTRACT) throw new Error("Missing GENLAYER_CONTRACT");

const client = createClient({
  chain: studionet,
  endpoint: ENDPOINT,
  account: createAccount(PRIVATE_KEY as `0x${string}`),
});

const addr = CONTRACT as `0x${string}`;
const provider = "0x689759bb926E032EAfb1eE986eD7A98C1496ec1c";
const consumer = "0x689759bb926E032EAfb1eE986eD7A98C1496ec1c";

function log(emoji: string, msg: string) {
  console.log(`${emoji} ${msg}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cliCall(fn: string, args: string, retries = 5): string {
  for (let i = 0; i < retries; i++) {
    try {
      const cmd = `genlayer call ${addr} ${fn} --args "${args}"`;
      const out = execSync(cmd, { encoding: "utf-8", timeout: 120000 });
      const lines = out.split("\n");
      // Find "Result:" line and capture everything after it
      const resultIdx = lines.findIndex((l) => l.trim().startsWith("Result:"));
      if (resultIdx !== -1) {
        const resultLines = lines.slice(resultIdx).join("\n").replace("Result:", "").trim();
        return resultLines || "(empty)";
      }
      // Fallback: look for actual output (JSON or text) between markers
      const outputLines = lines.filter(l => {
        const t = l.trim();
        return t && !t.startsWith("[") && !t.startsWith("-") && !t.startsWith("√") && !t.includes("deprecated") && !t.includes("Error");
      });
      if (outputLines.length > 0) return outputLines.join("\n").trim();
      throw new Error("No output found");
    } catch (e: any) {
      const msg = e.message?.slice(0, 120) || "unknown";
      log("⚠️", `CLI read failed (attempt ${i + 1}/${retries}): ${msg}`);
      if (i < retries - 1) {
        execSync("ping -n 8 127.0.0.1 >nul 2>&1");
      }
    }
  }
  return "(all retries failed)";
}

async function writeContract(fn: string, args: any[], value = 0n) {
  const txHash = await client.writeContract({
    address: addr,
    functionName: fn,
    args,
    value,
  });
  log("📝", `Tx: ${String(txHash)}`);
  log("⏳", `Waiting for receipt...`);
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash as any,
    status: "ACCEPTED" as any,
    retries: 120,
    interval: 5000,
  });
  log("✅", `${fn} accepted`);
  return String(txHash);
}

async function main() {
  const ts = Math.floor(Date.now() / 1000);
  const caseId = `test-${ts}`;

  console.log("=".repeat(60));
  console.log("VerdictArc - Full Method Test (studionet)");
  console.log("=".repeat(60));
  console.log(`Contract : ${CONTRACT}`);
  console.log(`Case ID  : ${caseId}`);
  console.log("=".repeat(60));

  // === PHASE 1: View existing case ===
  console.log("\n=== Phase 1: Verify existing case-001 ===");
  console.log("--- get_status (case-001) ---");
  log("🔍", `Status: ${cliCall("get_status", "case-001")}`);

  console.log("--- get_case_summary (case-001) ---");
  log("🔍", `Summary: ${cliCall("get_case_summary", "case-001")}`);

  console.log("--- get_evidence (case-001) ---");
  log("🔍", `Evidence: ${cliCall("get_evidence", "case-001")}`);

  console.log("--- get_dispute (case-001) ---");
  log("🔍", `Dispute: ${cliCall("get_dispute", "case-001")}`);

  console.log("--- get_last_decision (case-001) ---");
  log("🔍", `Decision: ${cliCall("get_last_decision", "case-001")}`);

  // === PHASE 2: Create new case and walk through lifecycle ===
  console.log("\n=== Phase 2: Create case + full lifecycle ===");
  console.log("\n--- 1. create_case ---");
  await writeContract("create_case", [
    caseId,
    provider,
    consumer,
    "E2E test case",
    ts,
    ts + 3600,
    3,
    800,
    "task_completion_v1",
  ]);

  await sleep(10000);

  console.log("\n--- 2. get_status ---");
  log("🔍", `Status: ${cliCall("get_status", caseId)}`);

  console.log("\n--- 3. get_case_summary ---");
  log("🔍", `Summary: ${cliCall("get_case_summary", caseId)}`);

  console.log("\n--- 4. lock_escrow (payable, 1 GEN) ---");
  const slaAmount = BigInt(1e18);
  const feeAmount = BigInt(1e17);
  const penaltyAmount = BigInt(5e17);
  await writeContract("lock_escrow", [caseId, feeAmount, penaltyAmount], slaAmount);

  await sleep(10000);

  console.log("\n--- 5. get_status (after lock) ---");
  log("🔍", `Status: ${cliCall("get_status", caseId)}`);

  console.log("\n--- 6. get_case_summary (after lock) ---");
  log("🔍", `Summary: ${cliCall("get_case_summary", caseId)}`);

  console.log("\n--- 7. start_execution ---");
  await writeContract("start_execution", [caseId]);

  await sleep(10000);

  console.log("\n--- 8. get_status (after start) ---");
  log("🔍", `Status: ${cliCall("get_status", caseId)}`);

  console.log("\n--- 9. submit_evidence ---");
  await writeContract("submit_evidence", [
    caseId,
    "https://httpbin.org/json",
    Math.floor(Date.now() / 1000),
  ]);

  await sleep(10000);

  console.log("\n--- 10. get_status (after evidence) ---");
  log("🔍", `Status: ${cliCall("get_status", caseId)}`);

  console.log("\n--- 11. get_evidence ---");
  log("🔍", `Evidence: ${cliCall("get_evidence", caseId)}`);

  console.log("\n--- 12. get_dispute ---");
  log("🔍", `Dispute: ${cliCall("get_dispute", caseId)}`);

  console.log("\n--- 13. get_last_decision ---");
  log("🔍", `Decision: ${cliCall("get_last_decision", caseId)}`);

  console.log("\n" + "=".repeat(60));
  console.log("Done! Skipped: evaluate_evidence (LLM consensus)");
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
