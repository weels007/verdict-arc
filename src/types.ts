export type Uint128 = string;

export type Bytes32 = string;

export type Address = string;

export type Timestamp = number;

export type ProofRef = string;

export type ReasonCode = string;

export type SubmissionType = string;

export type EvidenceFormat = string;

export type ServiceDescription = string;

export type FingerprintRef = string;

export type CounterEvidenceRef = string;

export type TaskBatchId = string;

export type WorkerBinding = string;

export interface TaskCompletionPayload {
  batchId: TaskBatchId;
  completedTaskCount: number;
  completionTimestamps: TimestampArray;
  statuses: TaskStatusArray;
  workerBinding: WorkerBinding;
}

export interface AvailabilityPayload {
  endpointId: string;
  windowStart: Timestamp;
  windowEnd: Timestamp;
  successfulResponses: number;
  totalResponses: number;
  verifierBinding: string;
}

export type TaskStatusArray = boolean[];

export type TimestampArray = number[];

export type Submitter = string;

export type DecisionCode = 'Release' | 'Penalty' | 'Refund' | 'Failed';

export type EvaluationOutcome = 'Satisfied' | 'NotSatisfied' | 'Malformed';

export type ContractStatus =
  | 'Offering'
  | 'EscrowLocked'
  | 'InExecution'
  | 'EvidenceSubmitted'
  | 'DecisionPending'
  | 'SettledReleased'
  | 'SettledPenalized'
  | 'SettledDisputed'
  | 'DisputeSubmitted'
  | 'DisputeDecided';

export type DisputeState =
  | 'Unopened'
  | 'Submitted'
  | 'Decided';

export type EvidencePayload = TaskCompletionPayload | AvailabilityPayload;

export interface Offer {
  contractId: Bytes32;
  provider: Address;
  consumer: Address;
  serviceDescription: ServiceDescription;
  slaAmount: Uint128;
  feeAmount: Uint128;
  penaltyAmount: Uint128;
  windowStart: Timestamp;
  windowEnd: Timestamp;
  taskCountRequired: number;
  requireFingerprint: boolean;
  evidenceFormat: EvidenceFormat;
  createdAt: Timestamp;
  status: ContractStatus;
}

export interface Escrow {
  contractId: Bytes32;
  lockedAmount: Uint128;
  heldAmount: Uint128;
  feeAmount: Uint128;
  penaltyAmount: Uint128;
  providerCandidate: Address;
  consumer: Address;
  locked: boolean;
  released: boolean;
  disputed: boolean;
}

export interface Evidence {
  contractId: Bytes32;
  submissionId: Bytes32;
  submissionTime: Timestamp;
  provider: Address;
  submissionType: SubmissionType;
  evidencePayload: EvidencePayload;
  fingerprintRef: FingerprintRef;
  evaluated: boolean;
  result: EvaluationOutcome;
  decidedAt: Timestamp;
}

export interface Dispute {
  contractId: Bytes32;
  disputeId: Bytes32;
  submitter: Submitter;
  reasonCode: ReasonCode;
  counterEvidenceRef: CounterEvidenceRef;
  submittedAt: Timestamp;
  decided: boolean;
  decision: DecisionCode;
}
