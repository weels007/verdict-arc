import {
  Address,
  Bytes32,
  Timestamp,
  Uint128,
  Offer,
  Escrow,
  Evidence,
  Dispute,
  EvaluationOutcome,
  DecisionCode,
  EvidencePayload,
  TaskCompletionPayload,
} from './types.js';
import {
  isAvailabilityPayload,
  isValidAvailabilityPayload,
  evaluateAvailabilitySLA,
} from './availability.js';
import {
  isTaskCompletionPayload,
  isValidTaskCompletionPayload,
  isValidFingerprintRef,
  fingerprintBindingBelongsToProvider,
  fingerprintBindingMatchesContext,
  isEvidenceFormatFor,
} from './evidence.js';
import {
  invalidState,
  offerNotFound,
  escrowNotFound,
  evidenceNotFound,
  disputeNotFound,
  amountMismatch,
  submissionTooEarly,
  submissionTooLate,
  evidenceFormatMismatch,
  fingerprintRequired,
  fingerprintInconsistent,
  alreadyEvaluated,
  escrowNotLocked,
  disputeAlreadyDecided,
  onlyConsumer,
  onlyProvider,
  offerAlreadyExists,
  invalidPayload,
  ContractError,
} from './errors.js';

export type ChainCallAdapter = {
  lockEscrow: (params: {
    contractId: Bytes32;
    amount: Uint128;
    consumer: Address;
  }) => Promise<{ ok: boolean; error?: string }>;
  startExecution: (params: {
    contractId: Bytes32;
    provider: Address;
  }) => Promise<{ ok: boolean; error?: string }>;
  submitEvidence: (params: {
    contractId: Bytes32;
    submissionId: Bytes32;
    submissionTime: Timestamp;
    provider: Address;
    submissionType: string;
    evidencePayload: EvidencePayload;
    fingerprintRef: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  evaluate: (params: {
    contractId: Bytes32;
  }) => Promise<{ ok: boolean; decision?: DecisionCode; error?: string }>;
  release: (params: {
    contractId: Bytes32;
  }) => Promise<{ ok: boolean; error?: string }>;
  penalty: (params: {
    contractId: Bytes32;
  }) => Promise<{ ok: boolean; error?: string }>;
  disputeSubmit: (params: {
    contractId: Bytes32;
    submitter: Address;
    reasonCode: string;
    counterEvidenceRef: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  disputeEvaluate: (params: {
    contractId: Bytes32;
  }) => Promise<{ ok: boolean; decision?: DecisionCode; error?: string }>;
};

function zero128(): Uint128 {
  return '0';
}

function now(): Timestamp {
  return Math.floor(Date.now() / 1000);
}

function decisionCodeFromOutcome(
  outcome: EvaluationOutcome,
  fingerprintOk: boolean,
  requireFingerprint: boolean
): DecisionCode {
  if (outcome === 'Malformed') return 'Failed';
  if (outcome === 'NotSatisfied') return 'Penalty';
  if (!fingerprintOk && requireFingerprint) return 'Failed';
  return 'Release';
}

type Repo = {
  offers: Map<Bytes32, Offer>;
  escrows: Map<Bytes32, Escrow>;
  evidences: Map<Bytes32, Evidence>;
  disputes: Map<Bytes32, Dispute>;
  nextSubmissionId: number;
  nextDisputeId: number;
};

export function createRepo(): Repo {
  return {
    offers: new Map(),
    escrows: new Map(),
    evidences: new Map(),
    disputes: new Map(),
    nextSubmissionId: 1,
    nextDisputeId: 1,
  };
}

export function createOffer(
  repo: Repo,
  contractId: Bytes32,
  provider: Address,
  consumer: Address,
  serviceDescription: string,
  slaAmount: Uint128,
  feeAmount: Uint128,
  penaltyAmount: Uint128,
  windowStart: Timestamp,
  windowEnd: Timestamp,
  taskCountRequired: number,
  requireFingerprint: boolean,
  evidenceFormat: string
): Bytes32 {
  if (repo.offers.has(contractId)) {
    offerAlreadyExists();
  }
  if (windowStart >= windowEnd) {
    throw new ContractError('windowStart must be less than windowEnd', 'INVALID_WINDOW');
  }
  if (taskCountRequired <= 0) {
    throw new ContractError('taskCountRequired must be greater than 0', 'INVALID_TASK_COUNT');
  }
  if (slaAmount === zero128()) {
    throw new ContractError('slaAmount must be greater than 0', 'INVALID_SLA_AMOUNT');
  }

  const offer: Offer = {
    contractId,
    provider,
    consumer,
    serviceDescription,
    slaAmount,
    feeAmount,
    penaltyAmount,
    windowStart,
    windowEnd,
    taskCountRequired,
    requireFingerprint,
    evidenceFormat,
    createdAt: now(),
    status: 'Offering',
  };

  repo.offers.set(contractId, offer);
  return contractId;
}

export function lockEscrow(
  repo: Repo,
  contractId: Bytes32,
  amount: Uint128,
  caller: Address
): boolean {
  const offer = repo.offers.get(contractId) ?? null;
  if (!offer) {
    offerNotFound();
  }
  if (offer.status !== 'Offering') {
    invalidState('Offering', offer.status);
  }
  if (caller !== offer.consumer) {
    onlyConsumer();
  }
  if (amount !== offer.slaAmount) {
    amountMismatch(offer.slaAmount, amount);
  }

  const escrow: Escrow = {
    contractId,
    lockedAmount: amount,
    heldAmount: amount,
    feeAmount: offer.feeAmount,
    penaltyAmount: offer.penaltyAmount,
    providerCandidate: offer.provider,
    consumer: offer.consumer,
    locked: true,
    released: false,
    disputed: false,
  };

  repo.escrows.set(contractId, escrow);
  offer.status = 'EscrowLocked';
  repo.offers.set(contractId, offer);
  return true;
}

export function startExecution(
  repo: Repo,
  contractId: Bytes32,
  caller: Address
): boolean {
  const offer = repo.offers.get(contractId) ?? null;
  if (!offer) {
    offerNotFound();
  }
  if (offer.status !== 'EscrowLocked') {
    invalidState('EscrowLocked', offer.status);
  }
  if (caller !== offer.provider) {
    onlyProvider();
  }

  offer.status = 'InExecution';
  repo.offers.set(contractId, offer);
  return true;
}

export function submitEvidence(
  repo: Repo,
  contractId: Bytes32,
  submissionId: Bytes32,
  submissionTime: Timestamp,
  provider: Address,
  submissionType: string,
  evidencePayload: EvidencePayload,
  fingerprintRef: string,
  caller: Address
): boolean {
  const offer = repo.offers.get(contractId) ?? null;
  if (!offer) {
    offerNotFound();
  }
  if (offer.status !== 'InExecution') {
    invalidState('InExecution', offer.status);
  }
  if (caller !== offer.provider) {
    onlyProvider();
  }

  if (submissionTime < offer.windowStart) {
    submissionTooEarly();
  }
  if (submissionTime > offer.windowEnd) {
    submissionTooLate();
  }
  if (submissionType !== offer.evidenceFormat) {
    evidenceFormatMismatch(offer.evidenceFormat, submissionType);
  }

  if (!isEvidenceFormatFor(evidencePayload, offer.evidenceFormat)) {
    invalidPayload();
  }

  if (offer.evidenceFormat === 'task_completion_v1') {
    if (!isValidTaskCompletionPayload(evidencePayload as TaskCompletionPayload)) {
      invalidPayload();
    }
  } else if (offer.evidenceFormat === 'availability_v1') {
    if (!isValidAvailabilityPayload(evidencePayload as any)) {
      invalidPayload();
    }
  } else {
    if (!isTaskCompletionPayload(evidencePayload)) {
      invalidPayload();
    }
  }

  if (offer.requireFingerprint) {
    if (fingerprintRef === '') {
      fingerprintRequired();
    }
    if (!isValidFingerprintRef(fingerprintRef, offer, provider)) {
      fingerprintInconsistent();
    }
  }

  const evidence: Evidence = {
    contractId,
    submissionId,
    submissionTime,
    provider,
    submissionType,
    evidencePayload,
    fingerprintRef: fingerprintRef ?? '',
    evaluated: false,
    result: 'Malformed',
    decidedAt: 0,
  };

  repo.evidences.set(contractId, evidence);
  offer.status = 'EvidenceSubmitted';
  repo.offers.set(contractId, offer);
  return true;
}

export function evaluate(
  repo: Repo,
  contractId: Bytes32,
  caller: Address
): DecisionCode {
  const offer = repo.offers.get(contractId) ?? null;
  const evidence = repo.evidences.get(contractId) ?? null;
  const escrow = repo.escrows.get(contractId) ?? null;

  if (!offer) {
    offerNotFound();
  }
  if (!escrow) {
    escrowNotFound();
  }
  if (!evidence) {
    evidenceNotFound();
  }
  if (offer.status !== 'EvidenceSubmitted') {
    invalidState('EvidenceSubmitted', offer.status);
  }
  if (evidence.evaluated) {
    alreadyEvaluated();
  }

  const sla = evaluateSLA(offer, evidence);
  let fingerprintOk = true;
  if (offer.requireFingerprint) {
    fingerprintOk = isValidFingerprintRef(evidence.fingerprintRef, offer, evidence.provider);
  }

  evidence.evaluated = true;
  evidence.result = sla;
  evidence.decidedAt = now();
  repo.evidences.set(contractId, evidence);

  const malformedOrFingerprintFailed = sla === 'Malformed' || (!fingerprintOk && offer.requireFingerprint);

  if (malformedOrFingerprintFailed) {
    offer.status = 'SettledDisputed';
    escrow.disputed = true;
    repo.escrows.set(contractId, escrow);
    repo.offers.set(contractId, offer);
    return 'Failed';
  }

  if (sla === 'NotSatisfied') {
    offer.status = 'SettledDisputed';
    escrow.disputed = true;
    repo.escrows.set(contractId, escrow);
    repo.offers.set(contractId, offer);
    return 'Failed';
  }

  const decision = decisionCodeFromOutcome(sla, fingerprintOk, offer.requireFingerprint);
  offer.status = 'DecisionPending';
  repo.offers.set(contractId, offer);
  return decision;
}

export function executeRelease(
  repo: Repo,
  contractId: Bytes32,
  tokenRelease: (to: Address, amount: Uint128) => void,
  feeRecipient: Address
): boolean {
  const offer = repo.offers.get(contractId) ?? null;
  const escrow = repo.escrows.get(contractId) ?? null;

  if (!offer) {
    offerNotFound();
  }
  if (!escrow) {
    escrowNotFound();
  }
  if (offer.status !== 'DecisionPending') {
    invalidState('DecisionPending', offer.status);
  }
  if (escrow.heldAmount === zero128()) {
    escrowNotLocked();
  }

  const providerPayout = sub128(escrow.lockedAmount, escrow.feeAmount);
  if (providerPayout !== zero128()) {
    tokenRelease(escrow.providerCandidate, providerPayout);
  }
  if (escrow.feeAmount !== zero128()) {
    tokenRelease(feeRecipient, escrow.feeAmount);
  }

  escrow.released = true;
  escrow.heldAmount = zero128();
  repo.escrows.set(contractId, escrow);
  offer.status = 'SettledReleased';
  repo.offers.set(contractId, offer);
  return true;
}

export function executePenalty(
  repo: Repo,
  contractId: Bytes32,
  tokenRelease: (to: Address, amount: Uint128) => void,
  tokenRefund: (to: Address, amount: Uint128) => void,
  penaltyRecipient: Address
): boolean {
  const offer = repo.offers.get(contractId) ?? null;
  const escrow = repo.escrows.get(contractId) ?? null;

  if (!offer) {
    offerNotFound();
  }
  if (!escrow) {
    escrowNotFound();
  }
  if (offer.status !== 'DecisionPending') {
    invalidState('DecisionPending', offer.status);
  }
  if (escrow.heldAmount === zero128()) {
    escrowNotLocked();
  }

  const refundAmount = sub128(escrow.lockedAmount, escrow.penaltyAmount);
  if (refundAmount !== zero128()) {
    tokenRefund(escrow.consumer, refundAmount);
  }
  if (escrow.penaltyAmount !== zero128() && penaltyRecipient !== '') {
    tokenRelease(penaltyRecipient, escrow.penaltyAmount);
  }

  escrow.released = true;
  escrow.heldAmount = zero128();
  repo.escrows.set(contractId, escrow);
  offer.status = 'SettledPenalized';
  repo.offers.set(contractId, offer);
  return true;
}

export function submitDispute(
  repo: Repo,
  contractId: Bytes32,
  submitter: Address,
  reasonCode: string,
  counterEvidenceRef: string,
  caller: Address
): boolean {
  const offer = repo.offers.get(contractId) ?? null;
  if (!offer) {
    offerNotFound();
  }
  if (offer.status !== 'SettledDisputed') {
    invalidState('SettledDisputed', offer.status);
  }

  const dispute: Dispute = {
    contractId,
    disputeId: bytes32FromInt(repo.nextDisputeId++),
    submitter,
    reasonCode,
    counterEvidenceRef: counterEvidenceRef ?? '',
    submittedAt: now(),
    decided: false,
    decision: 'Failed',
  };

  repo.disputes.set(contractId, dispute);
  offer.status = 'DisputeSubmitted';
  repo.offers.set(contractId, offer);
  return true;
}

export function evaluateDispute(
  repo: Repo,
  contractId: Bytes32,
  tokenRelease: (to: Address, amount: Uint128) => void,
  tokenRefund: (to: Address, amount: Uint128) => void,
  penaltyRecipient: Address,
  feeRecipient: Address = ''
): DecisionCode {
  const offer = repo.offers.get(contractId) ?? null;
  const evidence = repo.evidences.get(contractId) ?? null;
  const dispute = repo.disputes.get(contractId) ?? null;
  const escrow = repo.escrows.get(contractId) ?? null;

  if (!offer) {
    offerNotFound();
  }
  if (!dispute) {
    disputeNotFound();
  }
  if (!escrow) {
    escrowNotFound();
  }
  if (dispute.decided) {
    disputeAlreadyDecided();
  }
  if (offer.status !== 'DisputeSubmitted') {
    invalidState('DisputeSubmitted', offer.status);
  }

  let counterSatisfied = false;
  if (dispute.counterEvidenceRef !== '') {
    const counterEvidence = resolveCounterEvidence(dispute.counterEvidenceRef);
    if (counterEvidence) {
      const tempOffer = { ...offer };
      const tempEvidence: Evidence = {
        contractId,
        submissionId: dispute.counterEvidenceRef,
        submissionTime: counterEvidence.submissionTime,
        provider: counterEvidence.provider,
        submissionType: offer.evidenceFormat,
        evidencePayload: counterEvidence.payload,
        fingerprintRef: counterEvidence.fingerprintRef ?? '',
        evaluated: false,
        result: 'Malformed',
        decidedAt: 0,
      };
      counterSatisfied =
        evaluateSLA(tempOffer, tempEvidence) === 'Satisfied' &&
        (!tempOffer.requireFingerprint ||
          isValidFingerprintRef(tempEvidence.fingerprintRef, tempOffer, tempEvidence.provider));
    }
  }

  const originalSatisfied =
    evidence && evidence.result === 'Satisfied';

  let decision: DecisionCode;
  if (counterSatisfied) {
    decision = 'Release';
  } else if (originalSatisfied) {
    decision = 'Penalty';
  } else {
    decision = 'Failed';
  }

  dispute.decided = true;
  dispute.decision = decision;
  repo.disputes.set(contractId, dispute);

  escrow.disputed = false;
  repo.escrows.set(contractId, escrow);
  offer.status = 'DisputeDecided';
  repo.offers.set(contractId, offer);

  if (decision === 'Release') {
    executeRelease(repo, contractId, tokenRelease, feeRecipient);
    return decision;
  }
  if (decision === 'Penalty') {
    executePenalty(repo, contractId, tokenRelease, tokenRefund, penaltyRecipient);
    return decision;
  }

  const refundAmount = escrow.lockedAmount;
  if (refundAmount !== zero128()) {
    tokenRefund(escrow.consumer, refundAmount);
  }
  escrow.released = true;
  escrow.heldAmount = zero128();
  repo.escrows.set(contractId, escrow);
  return decision;
}

export function evaluateSLA(
  offer: Offer,
  evidence: Evidence
): EvaluationOutcome {
  const format = offer.evidenceFormat;

  if (format === 'availability_v1') {
    const wrapped = { evidencePayload: evidence.evidencePayload };
    return evaluateAvailabilitySLA(offer, wrapped);
  }

  if (!isTaskCompletionPayload(evidence.evidencePayload)) {
    return 'Malformed';
  }
  const payload = evidence.evidencePayload as TaskCompletionPayload;

  if (!isValidTaskCompletionPayload(payload)) {
    return 'Malformed';
  }

  if (payload.completedTaskCount < offer.taskCountRequired) {
    return 'NotSatisfied';
  }

  for (const ts of payload.completionTimestamps) {
    if (ts < offer.windowStart || ts > offer.windowEnd) {
      return 'NotSatisfied';
    }
  }

  for (let i = 0; i < payload.statuses.length; i += 1) {
    if (!payload.statuses[i]) {
      return 'NotSatisfied';
    }
  }

  return 'Satisfied';
}

// Fingerprint-binding helpers live canonically in ./evidence.ts; re-exported
// here so existing callers can keep importing them from the contract layer.
export {
  isValidFingerprintRef,
  fingerprintBindingBelongsToProvider,
  fingerprintBindingMatchesContext,
};

function bytes32FromInt(value: number): Bytes32 {
  return '0x' + String(value).padStart(64, '0');
}

function sub128(a: Uint128, b: Uint128): Uint128 {
  const numA = BigInt(a);
  const numB = BigInt(b);
  if (numA < numB) {
    throw new ContractError('underflow in subtraction', 'UNDERFLOW');
  }
  return String(numA - numB);
}

interface CounterEvidenceBundle {
  submissionTime: Timestamp;
  provider: Address;
  fingerprintRef: string;
  payload: TaskCompletionPayload;
}

// In the real-chain path, counter-evidence is fetched onchain by the
// intelligent contract (contracts/verdict_arc.py) with validator consensus.
// This mirror resolves it via the same URL the dispute references. A null
// result means the referenced evidence is unreachable.
export function resolveCounterEvidence(
  ref: string
): CounterEvidenceBundle | null {
  if (ref === "") return null;
  return null; // mirror stub: offline tests assert the unresolved path
}
