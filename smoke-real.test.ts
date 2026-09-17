import { evaluateSLAFromEvidence } from './src/evidence.js';
import { createRepo, createOffer } from './src/contract.js';
import {
  makeTaskCompletionEvidenceDoc,
  makeAvailabilityEvidenceDoc,
  serializeEvidenceDoc,
} from './src/real/evidence.js';
import { Bytes32 } from './src/types.js';

function bytes32FromInt(value: number): Bytes32 {
  return '0x' + String(value).padStart(64, '0');
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error('Real smoke assertion failed: ' + message);
  }
}

function runRealEvidenceSmoke(): void {
  console.log('Running real-evidence smoke checks...');

  // 1. Evidence doc builders produce the canonical schema the onchain
  //    extractor (contracts/verdict_arc.py) fetches and parses.
  const taskDoc = makeTaskCompletionEvidenceDoc({
    batchId: 'batch-real-001',
    completedTaskCount: 5,
    completionTimestamps: [1500, 2000, 2500, 3000, 3500],
    allTasksSuccessful: true,
    workerBinding: 'sig:worker-real-001',
  });
  assertCondition(taskDoc.evidence_format === 'task_completion_v1', 'task doc has canonical format');
  assertCondition(taskDoc.completed_task_count === 5, 'task doc preserves count');
  assertCondition(JSON.parse(serializeEvidenceDoc(taskDoc)).batch_id === 'batch-real-001', 'task doc round-trips');

  const availDoc = makeAvailabilityEvidenceDoc({
    endpointId: 'https://svc.example/health',
    observationWindowStart: 1200,
    observationWindowEnd: 4800,
    successfulResponses: 98,
    totalResponses: 100,
    monitorRef: 'monitor-real-002',
  });
  assertCondition(availDoc.evidence_format === 'availability_v1', 'availability doc has canonical format');
  assertCondition(availDoc.total_responses === 100, 'availability doc preserves total');

  // Builders must reject inconsistent evidence
  let rejectedBadCount = false;
  try {
    makeTaskCompletionEvidenceDoc({
      batchId: 'x',
      completedTaskCount: 4,
      completionTimestamps: [1500, 2000, 2500],
      allTasksSuccessful: true,
      workerBinding: 's',
    });
  } catch {
    rejectedBadCount = true;
  }
  assertCondition(rejectedBadCount, 'task doc rejects mismatched timestamps');

  let rejectedBadRatio = false;
  try {
    makeAvailabilityEvidenceDoc({
      endpointId: 'x',
      observationWindowStart: 1200,
      observationWindowEnd: 4800,
      successfulResponses: 120,
      totalResponses: 100,
      monitorRef: 'm',
    });
  } catch {
    rejectedBadRatio = true;
  }
  assertCondition(rejectedBadRatio, 'availability doc rejects out-of-range ratio');

  // 2. SLA-from-evidence evaluation on real evidence docs
  const taskRepo = createRepo();
  createOffer(
    taskRepo,
    bytes32FromInt(101),
    'provider-real',
    'consumer-real',
    'task service',
    '100',
    '0',
    '25',
    1000,
    5000,
    5,
    false,
    'task_completion_v1'
  );
  const taskOffer = taskRepo.offers.get(bytes32FromInt(101))!;
  assertCondition(taskOffer.status === 'Offering', 'offer should be created');

  const taskSubmission = {
    contractId: bytes32FromInt(101),
    submissionId: bytes32FromInt(11),
    submissionTime: 3600,
    provider: 'provider-real',
    submissionType: 'task_completion_v1',
    evidencePayload: {
      batchId: taskDoc.batch_id,
      completedTaskCount: taskDoc.completed_task_count,
      completionTimestamps: taskDoc.completion_timestamps,
      statuses: taskDoc.all_tasks_successful ? taskDoc.completion_timestamps.map(() => true) : taskDoc.completion_timestamps.map(() => false),
      workerBinding: taskDoc.worker_binding,
    },
    fingerprintRef: 'fp:abc123:provider-real',
    source: {
      sourceId: 'real-evidence-doc',
      kind: 'real' as const,
    },
  };

  const taskDecision = evaluateSLAFromEvidence(taskOffer, taskSubmission);
  assertCondition(taskDecision === 'Satisfied', 'valid task evidence should satisfy SLA');

  const failSubmission = {
    contractId: bytes32FromInt(102),
    submissionId: bytes32FromInt(12),
    submissionTime: 3600,
    provider: 'provider-real',
    submissionType: 'task_completion_v1',
    evidencePayload: {
      batchId: 'batch-real-fail',
      completedTaskCount: 3,
      completionTimestamps: [2000, 2500, 3000],
      statuses: [true, true, true],
      workerBinding: 'sig:worker-real-fail',
    },
    fingerprintRef: 'fp:abc123:provider-real',
    source: {
      sourceId: 'real-evidence-doc',
      kind: 'real' as const,
    },
  };
  createOffer(
    taskRepo,
    bytes32FromInt(102),
    'provider-real',
    'consumer-real',
    'task service',
    '100',
    '0',
    '25',
    1000,
    5000,
    5,
    false,
    'task_completion_v1'
  );
  const failOffer = taskRepo.offers.get(bytes32FromInt(102))!;
  const failDecision = evaluateSLAFromEvidence(failOffer, failSubmission);
  assertCondition(failDecision === 'NotSatisfied', 'insufficient tasks should not satisfy SLA');

  const availRepo = createRepo();
  createOffer(
    availRepo,
    bytes32FromInt(103),
    'provider-real',
    'consumer-real',
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
  const availOffer = availRepo.offers.get(bytes32FromInt(103))!;
  assertCondition(availOffer.status === 'Offering', 'availability offer should be created');

  const availSubmission = {
    contractId: bytes32FromInt(103),
    submissionId: bytes32FromInt(13),
    submissionTime: 3600,
    provider: 'provider-real',
    submissionType: 'availability_v1',
    evidencePayload: {
      endpointId: availDoc.endpoint_id,
      windowStart: availDoc.observation_window_start,
      windowEnd: availDoc.observation_window_end,
      successfulResponses: availDoc.successful_responses,
      totalResponses: availDoc.total_responses,
      verifierBinding: availDoc.monitor_ref,
    },
    fingerprintRef: 'fp:abc123:provider-real',
    source: {
      sourceId: 'real-evidence-doc',
      kind: 'real' as const,
    },
  };

  const availDecision = evaluateSLAFromEvidence(availOffer, availSubmission);
  assertCondition(availDecision === 'Satisfied', 'high availability should satisfy SLA');

  const lowAvailDoc = makeAvailabilityEvidenceDoc({
    endpointId: 'https://svc.example/health',
    observationWindowStart: 1200,
    observationWindowEnd: 4800,
    successfulResponses: 94,
    totalResponses: 100,
    monitorRef: 'monitor-real-low',
  });
  const lowAvailSubmission = {
    ...availSubmission,
    contractId: bytes32FromInt(104),
    submissionId: bytes32FromInt(14),
    evidencePayload: {
      endpointId: lowAvailDoc.endpoint_id,
      windowStart: lowAvailDoc.observation_window_start,
      windowEnd: lowAvailDoc.observation_window_end,
      successfulResponses: lowAvailDoc.successful_responses,
      totalResponses: lowAvailDoc.total_responses,
      verifierBinding: lowAvailDoc.monitor_ref,
    },
    source: {
      sourceId: 'real-evidence-doc',
      kind: 'real' as const,
    },
  };

  const lowAvailDecision = evaluateSLAFromEvidence(availOffer, lowAvailSubmission);
  assertCondition(lowAvailDecision === 'NotSatisfied', 'low availability should not satisfy SLA');

  console.log('Real-evidence smoke checks passed.');
}

runRealEvidenceSmoke();
