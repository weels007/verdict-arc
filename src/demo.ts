#!/usr/bin/env node
// VerdictArc: full case lifecycle against a deployed
// GenLayer intelligent contract (contracts/verdict_arc.py).
//
// Requires real chain configuration via env vars:
//   GENLAYER_ENDPOINT, GENLAYER_PRIVATE_KEY, GENLAYER_CONTRACT
// There is no mock or local fallback: without config this script fails fast.
//
// Optional env:
//   GENLAYER_EVIDENCE_PUBLISH_URL   HTTPS endpoint to publish evidence docs
//   GENLAYER_EVIDENCE_TOKEN         bearer token for the publish endpoint

import { createRealAdapter } from "./real/adapter.js";
import {
  makeTaskCompletionEvidenceDoc,
  publishEvidenceDoc,
} from "./real/evidence.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing ${name}. The real-chain demo runs against a deployed contract only. ` +
        `Set GENLAYER_ENDPOINT, GENLAYER_PRIVATE_KEY and GENLAYER_CONTRACT (see .env.example).`
    );
  }
  return value.trim();
}

function section(name: string): void {
  console.log("\n========================================");
  console.log("  " + name);
  console.log("  ========================================");
}

async function main(): Promise<void> {
  console.log("VERDICTARC — REAL CHAIN DEMO");
  requireEnv("GENLAYER_ENDPOINT");
  requireEnv("GENLAYER_PRIVATE_KEY");
  requireEnv("GENLAYER_CONTRACT");

  const adapter = createRealAdapter();
  const caseId = `case-${Date.now()}`;
  const windowStart = 1700000000;
  const windowEnd = 1700004000;

  // 1. Create the case onchain
  section("1. CREATE CASE");
  await adapter.createCase({
    caseId,
    provider: process.env.GENLAYER_PROVIDER ?? "provider-agent",
    consumer: process.env.GENLAYER_CONSUMER ?? "consumer-agent",
    serviceDescription: "AI content review batch",
    windowStart,
    windowEnd,
    taskCountRequired: 5,
    availabilityThresholdPermille: 950,
    evidenceMode: "task_completion_v1",
  });
  console.log("  caseId:", caseId);

  // 2. Consumer locks escrow (value attached in the transaction)
  section("2. LOCK ESCROW");
  const lock = await adapter.lockEscrow(caseId, {
    slaAmount: "1000000000000000000",
    feeAmount: "10000000000000000",
    penaltyAmount: "250000000000000000",
  });
  console.log("  lock tx:", lock.txHash);

  // 3. Provider starts execution
  section("3. START EXECUTION");
  const start = await adapter.startExecution(caseId);
  console.log("  start tx:", start.txHash);

  // 4. Provider publishes real evidence and submits the URL onchain.
  //    The evidence document must be reachable by the validators.
  section("4. PUBLISH + SUBMIT EVIDENCE");
  const publishUrl = process.env.GENLAYER_EVIDENCE_PUBLISH_URL;
  const token = process.env.GENLAYER_EVIDENCE_TOKEN;
  let evidenceUrl: string;
  if (publishUrl && token) {
    const doc = makeTaskCompletionEvidenceDoc({
      batchId: caseId,
      completedTaskCount: 5,
      completionTimestamps: [1700003100, 1700003200, 1700003300, 1700003400, 1700003500],
      allTasksSuccessful: true,
      workerBinding: "sig:worker:review-core-001",
    });
    const published = await publishEvidenceDoc({ publishUrl, bearerToken: token, doc });
    evidenceUrl = published.url;
    console.log("  published bytes:", published.bytes);
  } else {
    throw new Error(
      "No evidence publish endpoint configured. Set GENLAYER_EVIDENCE_PUBLISH_URL and " +
        "GENLAYER_EVIDENCE_TOKEN so the contract can fetch real evidence from the web."
    );
  }
  const submission = await adapter.submitEvidence(caseId, {
    evidenceUrl,
    submissionTime: 1700003500,
  });
  console.log("  evidence url:", evidenceUrl);
  console.log("  submit tx:", submission.txHash);

  // 5. Onchain evaluation: validators fetch the URL and reach consensus.
  section("5. EVALUATE EVIDENCE (ONCHAIN CONSENSUS)");
  const decision = await adapter.evaluateEvidence(caseId);
  console.log("  decision:", decision.decision);
  console.log("  evaluate tx:", decision.txHash);

  // 6. Settle according to the decision
  section("6. SETTLE");
  if (decision.decision === "Release") {
    const settled = await adapter.release(caseId);
    console.log("  released:", settled.txHash);
  } else {
    // Bounded dispute: same predicate, counter-evidence, decided outcome.
    const dispute = await adapter.disputeSubmit(caseId, {
      reasonCode: "counter_evidence_provided",
      counterEvidenceUrl: evidenceUrl,
    });
    console.log("  dispute tx:", dispute.txHash);
    const disputeDecision = await adapter.disputeEvaluate(caseId);
    console.log("  dispute decision:", disputeDecision.decision);
  }

  const summary = await adapter.getCaseSummary(caseId);
  console.log("\nFINAL CASE SUMMARY:", JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Real-chain demo failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
