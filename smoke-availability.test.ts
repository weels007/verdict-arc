import { createRepo, createOffer, lockEscrow, startExecution, submitEvidence, evaluate, executeRelease, submitDispute, evaluateDispute } from './src/contract.js';
import { Bytes32 } from './src/types.js';

function bytes32FromInt(value: number): Bytes32 {
  return '0x' + String(value).padStart(64, '0');
}

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error('Assertion failed: ' + message);
  }
}

function runSmokeAvailability(): void {
  console.log('Running availability smoke tests...');

  // Test 1: Availability happy path
  const repo1 = createRepo();
  const provider1 = 'agent001';
  const consumer1 = 'consumer42';
  const contractId1 = bytes32FromInt(1);

  createOffer(repo1, contractId1, provider1, consumer1, 'availability service', '1000', '0', '200', 1000, 5000, 3, false, 'availability_v1');
  lockEscrow(repo1, contractId1, '1000', consumer1);
  startExecution(repo1, contractId1, provider1);

  const submissionId1 = bytes32FromInt(1);
  const fingerprintRef1 = `fp:${contractId1.slice(0, 8)}:${provider1.slice(-8)}`;
  submitEvidence(repo1, contractId1, submissionId1, 3600, provider1, 'availability_v1', {
    endpointId: 'https://svc.example/health',
    windowStart: 1200,
    windowEnd: 4800,
    successfulResponses: 98,
    totalResponses: 100,
    verifierBinding: 'monitor-ref-001',
  }, fingerprintRef1, provider1);

  const decision1 = evaluate(repo1, contractId1, provider1);
  assertCondition(decision1 === 'Release', 'expected Release decision');

  const token1: { releases: Array<{ to: string; amount: string }>; refunds: Array<{ to: string; amount: string }> } = { releases: [], refunds: [] };
  executeRelease(repo1, contractId1, (to, amount) => token1.releases.push({ to, amount }), '');
  assertCondition(repo1.offers.get(contractId1)!.status === 'SettledReleased', 'offer should be SettledReleased');
  assertCondition(token1.releases.length === 1, 'should have one token release');

  // Test 2: Availability breach routes to the bounded dispute path
  const repo2 = createRepo();
  const provider2 = 'agent002';
  const consumer2 = 'consumer99';
  const contractId2 = bytes32FromInt(2);

  createOffer(repo2, contractId2, provider2, consumer2, 'availability service', '1000', '0', '200', 1000, 5000, 3, false, 'availability_v1');
  lockEscrow(repo2, contractId2, '1000', consumer2);
  startExecution(repo2, contractId2, provider2);

  const submissionId2 = bytes32FromInt(2);
  submitEvidence(repo2, contractId2, submissionId2, 3600, provider2, 'availability_v1', {
    endpointId: 'https://svc.example/health',
    windowStart: 1200,
    windowEnd: 4800,
    successfulResponses: 94,
    totalResponses: 100,
    verifierBinding: 'monitor-ref-002',
  }, '', provider2);

  const decision2 = evaluate(repo2, contractId2, provider2);
  assertCondition(decision2 === 'Failed', 'expected Failed decision for not-satisfied evidence');
  assertCondition(repo2.offers.get(contractId2)!.status === 'SettledDisputed', 'offer should be SettledDisputed');
  assertCondition(repo2.escrows.get(contractId2)!.disputed === true, 'escrow should be disputed');

  submitDispute(repo2, contractId2, consumer2, 'low_availability', bytes32FromInt(8), consumer2);
  assertCondition(repo2.offers.get(contractId2)!.status === 'DisputeSubmitted', 'dispute submitted');
  assertCondition(repo2.escrows.get(contractId2)!.disputed === true, 'escrow disputed');

  const token2: { releases: Array<{ to: string; amount: string }>; refunds: Array<{ to: string; amount: string }> } = { releases: [], refunds: [] };
  const disputeResult2 = evaluateDispute(repo2, contractId2, (to, amount) => token2.releases.push({ to, amount }), (to, amount) => token2.refunds.push({ to, amount }), provider2);
  assertCondition(disputeResult2 === 'Failed', 'dispute ends in Failed without counter-evidence');
  assertCondition(repo2.offers.get(contractId2)!.status === 'DisputeDecided', 'dispute decided');
  assertCondition(repo2.escrows.get(contractId2)!.disputed === false, 'escrow no longer disputed');
  assertCondition(repo2.escrows.get(contractId2)!.released === true, 'escrow released after dispute');
  assertCondition(token2.refunds.length === 1, 'consumer refunded after failed dispute');
  assertCondition(token2.releases.length === 0, 'no provider payout on failed dispute');

  console.log('Availability smoke tests passed.');
}

runSmokeAvailability();
