import { Bytes32, Uint128, Offer, Escrow, Evidence, Dispute } from './types.js';

export function bytes32FromInt(value: number): Bytes32 {
  return '0x' + String(value).padStart(64, '0');
}

export function uint128FromString(value: string): Uint128 {
  return value;
}

export function makeFingerprintRef(provider: string, contractId: Bytes32): string {
  return `fp:${contractId.slice(0, 8)}:${provider.slice(-8)}`;
}

export function makeTaskCompletionPayload(options: {
  batchId?: string;
  completedTaskCount?: number;
  completionTimestamps?: number[];
  statuses?: boolean[];
  workerBinding?: string;
}): any {
  return {
    batchId: options.batchId ?? 'batch-default',
    completedTaskCount: options.completedTaskCount ?? 5,
    completionTimestamps: options.completionTimestamps ?? [1500, 2000, 2500, 3000, 3500],
    statuses: options.statuses ?? [true, true, true, true, true],
    workerBinding: options.workerBinding ?? 'sig-default',
  };
}

export function makeAvailabilityPayload(options: {
  endpointId?: string;
  windowStart?: number;
  windowEnd?: number;
  successfulResponses?: number;
  totalResponses?: number;
  verifierBinding?: string;
}): any {
  return {
    endpointId: options.endpointId ?? 'https://svc.example/health',
    windowStart: options.windowStart ?? 1200,
    windowEnd: options.windowEnd ?? 4800,
    successfulResponses: options.successfulResponses ?? 98,
    totalResponses: options.totalResponses ?? 100,
    verifierBinding: options.verifierBinding ?? 'monitor-ref-001',
  };
}
