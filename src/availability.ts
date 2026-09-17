import { EvidencePayload, Offer, EvaluationOutcome, Timestamp } from './types.js';

export interface AvailabilityPayload {
  endpointId: string;
  windowStart: Timestamp;
  windowEnd: Timestamp;
  successfulResponses: number;
  totalResponses: number;
  verifierBinding: string;
}

export function isAvailabilityPayload(payload: EvidencePayload): payload is AvailabilityPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'endpointId' in payload &&
    'windowStart' in payload &&
    'windowEnd' in payload &&
    'successfulResponses' in payload &&
    'totalResponses' in payload &&
    'verifierBinding' in payload
  );
}

export function isValidAvailabilityPayload(payload: AvailabilityPayload): boolean {
  if (!payload.endpointId) return false;
  if (payload.windowStart >= payload.windowEnd) return false;
  if (payload.totalResponses <= 0) return false;
  if (payload.successfulResponses < 0) return false;
  if (payload.successfulResponses > payload.totalResponses) return false;
  if (!payload.verifierBinding) return false;
  return true;
}

export function evaluateAvailabilitySLA(offer: Offer, evidence: { evidencePayload: EvidencePayload }): EvaluationOutcome {
  if (!isAvailabilityPayload(evidence.evidencePayload)) {
    return 'Malformed';
  }

  const payload = evidence.evidencePayload as AvailabilityPayload;

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
