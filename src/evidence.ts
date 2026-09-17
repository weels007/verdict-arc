import { EvidencePayload, Offer, TaskCompletionPayload, AvailabilityPayload, EvaluationOutcome } from './types.js';
import { isAvailabilityPayload, isValidAvailabilityPayload } from './availability.js';

/**
 * Evidence-layer helpers.
 *
 * These helpers convert an evidence attestation into a structured submission and
 * evaluate that submission against an offer. They are used by the frontend and the
 * real path to prepare evidence for submission. They are NOT the onchain rule
 * module by themselves. The onchain rule module is represented by the shared
 * evaluation logic in src/contract.ts.
 *
 * The validation rules here are intentionally aligned with the contract rules in
 * src/contract.ts. If you change one, change the other.
 */

export function isTaskCompletionPayload(payload: EvidencePayload): payload is TaskCompletionPayload {
  if (!payload) return false;
  if (typeof payload !== 'object') return false;
  if (!('batchId' in payload)) return false;
  if (!('completedTaskCount' in payload)) return false;
  if (!('completionTimestamps' in payload)) return false;
  if (!('statuses' in payload)) return false;
  if (!('workerBinding' in payload)) return false;
  return true;
}

export interface EvidenceSubmission {
  contractId: string;
  submissionId: string;
  submissionTime: number;
  provider: string;
  submissionType: string;
  evidencePayload: EvidencePayload;
  fingerprintRef: string;
  source: EvidenceSource;
}

export interface EvidenceSource {
  sourceId: string;
  kind: 'real';
  attestation?: EvidenceAttestation;
}

export interface EvidenceAttestation {
  contractId: string;
  submissionId: string;
  submissionTime: number;
  provider: string;
  submissionType: string;
  evidencePayload: EvidencePayload;
  fingerprintRef: string;
  bindingProof?: string;
  verifierSignature?: string;
  verifierSourceId?: string;
}

export interface EvidenceDecision {
  outcome: EvaluationOutcome;
  fingerprintOk: boolean;
  requireFingerprint: boolean;
  slaSatisfied: boolean;
}

export function decideEvidence(offer: Offer, submission: EvidenceSubmission): EvidenceDecision {
  const sla = evaluateSLAFromEvidence(offer, submission);
  const fingerprintOk = !offer.requireFingerprint || isValidFingerprintRef(submission.fingerprintRef, offer, submission.provider);
  const slaSatisfied = sla === 'Satisfied';

  const outcome: EvaluationOutcome =
    (!slaSatisfied || (offer.requireFingerprint && !fingerprintOk))
      ? (offer.requireFingerprint && !fingerprintOk ? 'Malformed' : sla)
      : 'Satisfied';

  if (outcome === 'Malformed') {
    return { outcome: 'Malformed', fingerprintOk, requireFingerprint: offer.requireFingerprint, slaSatisfied: false };
  }

  return { outcome, fingerprintOk, requireFingerprint: offer.requireFingerprint, slaSatisfied };
}

export function evaluateSLAFromEvidence(offer: Offer, submission: EvidenceSubmission): EvaluationOutcome {
  if (!isEvidenceFormatFor(submission.evidencePayload, offer.evidenceFormat)) {
    return 'Malformed';
  }

  if (offer.evidenceFormat === 'task_completion_v1') {
    const payload = submission.evidencePayload as any;
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

  if (offer.evidenceFormat === 'availability_v1') {
    const payload = submission.evidencePayload as any;
    if (!isValidAvailabilityPayload(payload)) {
      return 'Malformed';
    }
    if (payload.windowStart < offer.windowStart || payload.windowEnd > offer.windowEnd) {
      return 'NotSatisfied';
    }
    if (payload.totalResponses === 0) {
      return 'NotSatisfied';
    }
    const availability = payload.successfulResponses / payload.totalResponses;
    if (availability < 0.95) {
      return 'NotSatisfied';
    }
    return 'Satisfied';
  }

  return 'Malformed';
}

export function isEvidenceFormatFor(payload: EvidencePayload, format: string): boolean {
  return (
    (format === 'task_completion_v1' && isTaskCompletionPayload(payload)) ||
    (format === 'availability_v1' && isAvailabilityPayload(payload))
  );
}

// Canonical fingerprint-binding helpers. The contract layer re-exports these so
// callers can import them from either module.
export function fingerprintBindingBelongsToProvider(
  fingerprintRef: string,
  provider: string
): boolean {
  return fingerprintRef.endsWith(provider.slice(-8));
}

export function fingerprintBindingMatchesContext(
  fingerprintRef: string,
  contractId: string
): boolean {
  return fingerprintRef.includes(contractId.slice(0, 8));
}

export function isValidFingerprintRef(
  fingerprintRef: string,
  offer: Offer,
  provider: string
): boolean {
  if (fingerprintRef === '') {
    return false;
  }
  if (!fingerprintBindingBelongsToProvider(fingerprintRef, provider)) {
    return false;
  }
  if (!fingerprintBindingMatchesContext(fingerprintRef, offer.contractId)) {
    return false;
  }
  return true;
}

export function isValidTaskCompletionPayload(payload: TaskCompletionPayload): boolean {
  if (!payload) return false;
  if (payload.completedTaskCount <= 0) return false;
  if (payload.completionTimestamps.length === 0) return false;
  if (payload.statuses.length !== payload.completedTaskCount) return false;
  if (payload.completionTimestamps.length !== payload.completedTaskCount) return false;
  if (payload.workerBinding === '') return false;
  return true;
}

export { isAvailabilityPayload, isValidAvailabilityPayload } from './availability.js';
export type { TaskCompletionPayload, AvailabilityPayload } from './types.js';

/**
 * Convert a real-path attestation into a contract-ready submission.
 * Alias of extractRealEvidenceFromAttestation kept for API naming symmetry.
 */
export function evidenceSubmitFromAttestation(attestation: EvidenceAttestation): EvidenceSubmission {
  return extractRealEvidenceFromAttestation(attestation);
}

export function extractRealEvidenceFromAttestation(attestation: EvidenceAttestation): EvidenceSubmission {
  return {
    contractId: attestation.contractId,
    submissionId: attestation.submissionId,
    submissionTime: attestation.submissionTime,
    provider: attestation.provider,
    submissionType: attestation.submissionType,
    evidencePayload: attestation.evidencePayload,
    fingerprintRef: attestation.fingerprintRef,
    source: {
      sourceId: attestation.verifierSourceId ?? 'real-source',
      kind: 'real',
      attestation,
    },
  };
}
export function makeTaskCompletionEvidencePayload(partial: any): TaskCompletionPayload {
  return {
    batchId: partial.batchId ?? 'batch-real',
    completedTaskCount: partial.completedTaskCount ?? 5,
    completionTimestamps: partial.completionTimestamps ?? [1500, 2000, 2500, 3000, 3500],
    statuses: partial.statuses ?? [true, true, true, true, true],
    workerBinding: partial.workerBinding ?? 'sig:worker:real',
  };
}

export function makeAvailabilityEvidencePayload(partial: any): AvailabilityPayload {
  return {
    endpointId: partial.endpointId ?? 'https://svc.example/health',
    windowStart: partial.windowStart ?? 1200,
    windowEnd: partial.windowEnd ?? 4800,
    successfulResponses: partial.successfulResponses ?? 98,
    totalResponses: partial.totalResponses ?? 100,
    verifierBinding: partial.verifierBinding ?? 'monitor-ref-real',
  };
}
