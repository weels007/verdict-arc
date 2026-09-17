// Public API: real-chain only. There is no mock verifier surface.

export {
  createRealAdapter,
  getGenLayerClient,
  getContractAddress,
  type ChainCallAdapter,
  type RealChainContext,
} from "./real/adapter.js";

export {
  makeTaskCompletionEvidenceDoc,
  makeAvailabilityEvidenceDoc,
  serializeEvidenceDoc,
  publishEvidenceDoc,
  type EvidenceMode,
  type SlaEvidenceDoc,
} from "./real/evidence.js";

// Offline rule mirror (used by the rule tests; the onchain authority is
// contracts/verdict_arc.py).
export {
  createRepo,
  createOffer,
  lockEscrow,
  startExecution,
  submitEvidence,
  evaluate,
  executeRelease,
  executePenalty,
  submitDispute,
  evaluateDispute,
  evaluateSLA,
  isValidFingerprintRef,
} from "./contract.js";

export { evaluateSLAFromEvidence } from "./evidence.js";
export { ContractError } from "./errors.js";
