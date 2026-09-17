import { createRepo, createOffer } from './contract.js';
import { evaluateAvailabilitySLA } from './availability.js';
import {
  makeTaskCompletionEvidenceDoc,
  makeAvailabilityEvidenceDoc,
  serializeEvidenceDoc,
  type SlaEvidenceDoc,
} from './real/evidence.js';
import { Bytes32 } from './types.js';

function bytes32FromInt(value: number): Bytes32 {
  return '0x' + String(value).padStart(64, '0');
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

function runSummary(): void {
  console.log('Running summary checks...');

  // 1. Evidence document builders produce the schema the onchain extractor expects
  const taskDoc = makeTaskCompletionEvidenceDoc({
    batchId: 'batch-001',
    completedTaskCount: 5,
    completionTimestamps: [1500, 2000, 2500, 3000, 3500],
    allTasksSuccessful: true,
    workerBinding: 'sig:worker:001',
  });
  assertCondition(taskDoc.evidence_format === 'task_completion_v1', 'task doc has canonical format');
  assertCondition(taskDoc.completed_task_count === 5, 'task doc preserves count');

  const availDoc = makeAvailabilityEvidenceDoc({
    endpointId: 'https://example.com/h',
    observationWindowStart: 1000,
    observationWindowEnd: 5000,
    successfulResponses: 98,
    totalResponses: 100,
    monitorRef: 'monitor-001',
  });
  assertCondition(availDoc.evidence_format === 'availability_v1', 'availability doc has canonical format');
  const serialized = serializeEvidenceDoc(taskDoc);
  assertCondition(JSON.parse(serialized).evidence_format === 'task_completion_v1', 'serialization round-trips');

  // Builders must reject inconsistent inputs
  let rejected = false;
  try {
    makeTaskCompletionEvidenceDoc({
      batchId: 'x',
      completedTaskCount: 3,
      completionTimestamps: [1500, 2000],
      allTasksSuccessful: true,
      workerBinding: 's',
    });
  } catch {
    rejected = true;
  }
  assertCondition(rejected, 'inconsistent task doc is rejected');

  // 2. Availability SLA evaluation against the rule mirror
  const repo = createRepo();
  createOffer(
    repo,
    bytes32FromInt(101),
    'provider001',
    'consumer001',
    'availability service',
    '100',
    '0',
    '25',
    1000,
    5000,
    3,
    false,
    'availability_v1'
  );
  const offer = repo.offers.get(bytes32FromInt(101))!;

  const good = { endpointId: 'https://example.com/h', windowStart: 1000, windowEnd: 5000, successfulResponses: 98, totalResponses: 100, verifierBinding: 'r' };
  assertCondition(evaluateAvailabilitySLA(offer, { evidencePayload: good }) === 'Satisfied', '98% should satisfy');

  const badWindow = { endpointId: 'x', windowStart: 500, windowEnd: 2000, successfulResponses: 90, totalResponses: 100, verifierBinding: 'r' };
  assertCondition(evaluateAvailabilitySLA(offer, { evidencePayload: badWindow }) === 'NotSatisfied', 'window outside offer window should not satisfy');

  const badTotal = { endpointId: 'x', windowStart: 1000, windowEnd: 5000, successfulResponses: 90, totalResponses: 0, verifierBinding: 'rbinding' };
  assertCondition(evaluateAvailabilitySLA(offer, { evidencePayload: badTotal }) === 'Malformed', 'zero total should be Malformed');

  const lowAvail = { endpointId: 'x', windowStart: 1000, windowEnd: 5000, successfulResponses: 94, totalResponses: 100, verifierBinding: 'r' };
  assertCondition(evaluateAvailabilitySLA(offer, { evidencePayload: lowAvail }) === 'NotSatisfied', '94% should not satisfy');

  console.log('Summary checks passed.');
}

runSummary();
