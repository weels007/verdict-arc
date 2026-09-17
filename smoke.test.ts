import { createRepo, createOffer, lockEscrow, startExecution, submitEvidence, evaluate, executeRelease, executePenalty, submitDispute, evaluateDispute, isValidFingerprintRef, resolveCounterEvidence } from './src/contract.js';
import { Bytes32, Uint128 } from './src/types.js';

function bytes32FromInt(value: number): Bytes32 {
  return '0x' + String(value).padStart(64, '0');
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

function runSmoke(): void {
  console.log('Running smoke tests...');

  // Test 1: Happy path
  const repo1 = createRepo();
  const provider1 = 'agent001';
  const consumer1 = 'consumer42';
  const contractId1 = bytes32FromInt(1);

  createOffer(repo1, contractId1, provider1, consumer1, 'task service', '1000', '50', '300', 1000, 5000, 5, true, 'task_completion_v1');
  lockEscrow(repo1, contractId1, '1000', consumer1);
  startExecution(repo1, contractId1, provider1);

  const submissionId1 = bytes32FromInt(1);
  const fingerprintRef1 = `fp:${contractId1.slice(0, 8)}:${provider1.slice(-8)}`;
  submitEvidence(repo1, contractId1, submissionId1, 3600, provider1, 'task_completion_v1', {
    batchId: 'batch-001',
    completedTaskCount: 5,
    completionTimestamps: [1500, 2000, 2500, 3000, 3500],
    statuses: [true, true, true, true, true],
    workerBinding: 'sig:worker:001',
  }, fingerprintRef1, provider1);

  const decision1 = evaluate(repo1, contractId1, provider1);
  assertCondition(decision1 === 'Release', 'expected Release decision');
  assertCondition(isValidFingerprintRef(fingerprintRef1, repo1.offers.get(contractId1)!, provider1), 'fingerprint should be valid');

  interface TokenLogger {
    releases: Array<{ to: string; amount: string }>;
    refunds: Array<{ to: string; amount: string }>;
  }

  function makeTokenLogger(): TokenLogger {
    return { releases: [], refunds: [] };
  }

  function release(token: TokenLogger, to: string, amount: string): void {
    token.releases.push({ to, amount });
  }

  function refund(token: TokenLogger, to: string, amount: string): void {
    token.refunds.push({ to, amount });
  }

  const token1 = makeTokenLogger();
  executeRelease(repo1, contractId1, release.bind(null, token1), '');
  assertCondition(repo1.offers.get(contractId1)!.status === 'SettledReleased', 'offer should be SettledReleased');
  assertCondition(token1.releases.length === 2, 'should have two token releases');

  // Test 2: Penalty path
  const repo2 = createRepo();
  const provider2 = 'agent002';
  const consumer2 = 'consumer99';
  const contractId2 = bytes32FromInt(2);

  createOffer(repo2, contractId2, provider2, consumer2, 'task service', '1000', '0', '300', 1000, 5000, 5, false, 'task_completion_v1');
  lockEscrow(repo2, contractId2, '1000', consumer2);
  startExecution(repo2, contractId2, provider2);

  const submissionId2 = bytes32FromInt(2);
  submitEvidence(repo2, contractId2, submissionId2, 3600, provider2, 'task_completion_v1', {
    batchId: 'batch-002',
    completedTaskCount: 3,
    completionTimestamps: [1500, 2000, 2500],
    statuses: [true, true, true],
    workerBinding: 'sig:worker:002',
  }, '', provider2);

  const decision2 = evaluate(repo2, contractId2, provider2);
  assertCondition(decision2 === 'Failed', 'expected Failed decision for not-satisfied evidence');
  assertCondition(repo2.offers.get(contractId2)!.status === 'SettledDisputed', 'offer should be SettledDisputed');
  assertCondition(repo2.escrows.get(contractId2)!.disputed === true, 'escrow should be disputed');

  // With the corrected routing, insufficient-but-valid evidence now enters the
  // disputed path, so settlement must go through the dispute flow.
  submitDispute(repo2, contractId2, consumer2, 'insufficient_tasks', bytes32FromInt(7), consumer2);
  assertCondition(repo2.offers.get(contractId2)!.status === 'DisputeSubmitted', 'dispute submitted');
  assertCondition(repo2.escrows.get(contractId2)!.disputed === true, 'escrow disputed');

  const token2 = makeTokenLogger();
  const disputeResult2 = evaluateDispute(repo2, contractId2, release.bind(null, token2), refund.bind(null, token2), provider2);
  assertCondition(disputeResult2 === 'Failed', 'dispute ends in Failed without counter-evidence');
  assertCondition(repo2.offers.get(contractId2)!.status === 'DisputeDecided', 'dispute decided');
  assertCondition(repo2.escrows.get(contractId2)!.disputed === false, 'escrow no longer disputed');
  assertCondition(repo2.escrows.get(contractId2)!.released === true, 'escrow released after dispute');
  assertCondition(token2.refunds.length === 1, 'consumer refunded after failed dispute');
  assertCondition(token2.releases.length === 0, 'no provider payout on failed dispute');

  // Test 3: Dispute path
  const repo3 = createRepo();
  const provider3 = 'agent003';
  const consumer3 = 'consumer77';
  const contractId3 = bytes32FromInt(3);

  createOffer(repo3, contractId3, provider3, consumer3, 'task service', '1000', '0', '200', 1000, 5000, 5, true, 'task_completion_v1');
  lockEscrow(repo3, contractId3, '1000', consumer3);
  startExecution(repo3, contractId3, provider3);

  const submissionId3 = bytes32FromInt(3);
  const fingerprintRef3 = `fp:${contractId3.slice(0, 8)}:${provider3.slice(-8)}`;
  submitEvidence(repo3, contractId3, submissionId3, 3600, provider3, 'task_completion_v1', {
    batchId: 'batch-003',
    completedTaskCount: 5,
    completionTimestamps: [1500, 2000, 2500, 3000, 3500],
    statuses: [true, true, true, true, false],
    workerBinding: 'sig:worker:003',
  }, fingerprintRef3, provider3);

  const decision3 = evaluate(repo3, contractId3, provider3);
  assertCondition(decision3 === 'Failed', 'expected Failed decision');
  assertCondition(repo3.offers.get(contractId3)!.status === 'SettledDisputed', 'offer should be SettledDisputed');
  assertCondition(repo3.disputes.get(contractId3) === undefined, 'no dispute yet');

  submitDispute(repo3, contractId3, consumer3, 'evidence_incomplete', bytes32FromInt(42), consumer3);
  assertCondition(repo3.offers.get(contractId3)!.status === 'DisputeSubmitted', 'offer should be DisputeSubmitted');

  const holdState = repo3.escrows.get(contractId3)!.disputed;
  assertCondition(holdState === true, 'escrow should remain disputed during dispute');

  // NOTE: resolveCounterEvidence still returns null in this repo, so the dispute
  // does not fake a resolution. This smoke asserts the structural placement of that
  // hook, the disputed hold semantics, and the dispute-evaluate decision path.
  assertCondition(resolveCounterEvidence(bytes32FromInt(42)) === null, 'counter-evidence resolver is still a stub');

  const token3 = makeTokenLogger();
  const counterResult = evaluateDispute(repo3, contractId3, release.bind(null, token3), refund.bind(null, token3), provider3);
  assertCondition(counterResult === 'Failed', 'without wired counter-evidence, dispute ends in Failed');
  assertCondition(repo3.offers.get(contractId3)!.status === 'DisputeDecided', 'offer should be DisputeDecided');
  assertCondition(repo3.escrows.get(contractId3)!.disputed === false, 'escrow should no longer be disputed');
  assertCondition(repo3.disputes.get(contractId3)!.decided === true, 'dispute should be marked decided');

  console.log('Smoke tests passed.');
}

runSmoke();
