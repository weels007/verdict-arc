export class ContractError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

export function invalidState(expected: string, actual: string): never {
  throw new ContractError(
    `Invalid state transition. Expected ${expected}, got ${actual}`,
    'INVALID_STATE',
    { expected, actual }
  );
}

export function offerNotFound(): never {
  throw new ContractError('Offer not found', 'OFFER_NOT_FOUND');
}

export function escrowNotFound(): never {
  throw new ContractError('Escrow not found', 'ESCROW_NOT_FOUND');
}

export function evidenceNotFound(): never {
  throw new ContractError('Evidence not found', 'EVIDENCE_NOT_FOUND');
}

export function disputeNotFound(): never {
  throw new ContractError('Dispute not found', 'DISPUTE_NOT_FOUND');
}

export function amountMismatch(expected: string, actual: string): never {
  throw new ContractError(
    `Amount mismatch. Expected ${expected}, got ${actual}`,
    'AMOUNT_MISMATCH',
    { expected, actual }
  );
}

export function submissionTooEarly(): never {
  throw new ContractError(
    'Submission time is before window start',
    'SUBMISSION_TOO_EARLY'
  );
}

export function submissionTooLate(): never {
  throw new ContractError(
    'Submission time is after window end',
    'SUBMISSION_TOO_LATE'
  );
}

export function evidenceFormatMismatch(expected: string, actual: string): never {
  throw new ContractError(
    `Evidence format mismatch. Expected ${expected}, got ${actual}`,
    'EVIDENCE_FORMAT_MISMATCH',
    { expected, actual }
  );
}

export function fingerprintRequired(): never {
  throw new ContractError(
    'Fingerprint is required but missing',
    'FINGERPRINT_REQUIRED'
  );
}

export function fingerprintInconsistent(): never {
  throw new ContractError(
    'Fingerprint does not match required context',
    'FINGERPRINT_INCONSISTENT'
  );
}

export function alreadyEvaluated(): never {
  throw new ContractError(
    'Evidence already evaluated',
    'ALREADY_EVALUATED'
  );
}

export function escrowNotLocked(): never {
  throw new ContractError(
    'Escrow is not locked',
    'ESCROW_NOT_LOCKED'
  );
}

export function disputeAlreadyDecided(): never {
  throw new ContractError(
    'Dispute already decided',
    'DISPUTE_ALREADY_DECIDED'
  );
}

export function onlyConsumer(): never {
  throw new ContractError(
    'Only consumer can perform this action',
    'ONLY_CONSUMER'
  );
}

export function onlyProvider(): never {
  throw new ContractError(
    'Only provider can perform this action',
    'ONLY_PROVIDER'
  );
}

export function offerAlreadyExists(): never {
  throw new ContractError(
    'Offer already exists',
    'OFFER_ALREADY_EXISTS'
  );
}

export function invalidPayload(): never {
  throw new ContractError(
    'Evidence payload is invalid',
    'INVALID_PAYLOAD'
  );
}
