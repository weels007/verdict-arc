#!/usr/bin/env node
// Real-chain availability demo: creates an availability_v1 SLA case and runs
// it end-to-end against a deployed GenLayer intelligent contract.
//
// Requires real chain configuration via env vars:
//   GENLAYER_ENDPOINT, GENLAYER_PRIVATE_KEY, GENLAYER_CONTRACT
// plus evidence publishing:
//   GENLAYER_EVIDENCE_PUBLISH_URL, GENLAYER_EVIDENCE_TOKEN
// There is no mock or local fallback.

import { createRealAdapter } from "./real/adapter.js";
import {
  makeAvailabilityEvidenceDoc,
  publishEvidenceDoc,
} from "./real/evidence.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing ${name}. Set GENLAYER_ENDPOINT, GENLAYER_PRIVATE_KEY, GENLAYER_CONTRACT, ` +
        `GENLAYER_EVIDENCE_PUBLISH_URL and GENLAYER_EVIDENCE_TOKEN (see .env.example).`
    );
  }
  return value.trim();
}

async function main(): Promise<void> {
  console.log("VERDICTARC — REAL CHAIN AVAILABILITY DEMO");
  requireEnv("GENLAYER_ENDPOINT");
  requireEnv("GENLAYER_PRIVATE_KEY");
  requireEnv("GENLAYER_CONTRACT");

  const adapter = createRealAdapter();
  const caseId = `case-avail-${Date.now()}`;
  const windowStart = 1700000000;
  const windowEnd = 1700086400;

  console.log("\n1. CREATE AVAILABILITY CASE");
  await adapter.createCase({
    caseId,
    provider: process.env.GENLAYER_PROVIDER ?? "provider-monitor",
    consumer: process.env.GENLAYER_CONSUMER ?? "consumer-monitor",
    serviceDescription: "API uptime SLA",
    windowStart,
    windowEnd,
    taskCountRequired: 1,
    availabilityThresholdPermille: 950,
    evidenceMode: "availability_v1",
  });

  console.log("\n2. LOCK ESCROW");
  const lock = await adapter.lockEscrow(caseId, {
    slaAmount: "2000000000000000000",
    feeAmount: "0",
    penaltyAmount: "500000000000000000",
  });
  console.log("  lock tx:", lock.txHash);

  console.log("\n3. START EXECUTION");
  await adapter.startExecution(caseId);

  console.log("\n4. PUBLISH + SUBMIT MONITORING EVIDENCE");
  const publishUrl = requireEnv("GENLAYER_EVIDENCE_PUBLISH_URL");
  const token = requireEnv("GENLAYER_EVIDENCE_TOKEN");
  const doc = makeAvailabilityEvidenceDoc({
    endpointId: process.env.GENLAYER_MONITORED_ENDPOINT ?? "https://svc.example/health",
    observationWindowStart: windowStart + 3600,
    observationWindowEnd: windowEnd - 3600,
    successfulResponses: 98,
    totalResponses: 100,
    monitorRef: "real-monitor-run-001",
  });
  const published = await publishEvidenceDoc({ publishUrl, bearerToken: token, doc });
  const submission = await adapter.submitEvidence(caseId, {
    evidenceUrl: published.url,
    submissionTime: windowEnd - 60,
  });
  console.log("  evidence url:", published.url);
  console.log("  submit tx:", submission.txHash);

  console.log("\n5. EVALUATE (ONCHAIN CONSENSUS)");
  const decision = await adapter.evaluateEvidence(caseId);
  console.log("  decision:", decision.decision);

  console.log("\n6. SETTLE");
  if (decision.decision === "Release") {
    const settled = await adapter.release(caseId);
    console.log("  released:", settled.txHash);
  } else {
    const dispute = await adapter.disputeSubmit(caseId, {
      reasonCode: "counter_evidence_provided",
      counterEvidenceUrl: published.url,
    });
    const disputeDecision = await adapter.disputeEvaluate(caseId);
    console.log("  dispute decision:", disputeDecision.decision);
  }

  const summary = await adapter.getCaseSummary(caseId);
  console.log("\nFINAL CASE SUMMARY:", JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Availability demo failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
