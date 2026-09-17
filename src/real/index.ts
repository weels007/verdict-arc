// Real path entry point: real chain adapter + real evidence publishing.
// There is no stub, no mock and no local fallback in this surface.

export {
  createRealAdapter,
  getGenLayerClient,
  getContractAddress,
  type ChainCallAdapter,
  type RealChainContext,
  type RealClient,
  type RealSigner,
} from "./adapter.js";

export {
  makeTaskCompletionEvidenceDoc,
  makeAvailabilityEvidenceDoc,
  serializeEvidenceDoc,
  publishEvidenceDoc,
  type EvidenceMode,
  type TaskCompletionEvidenceDoc,
  type AvailabilityEvidenceDoc,
  type SlaEvidenceDoc,
  type PublishResult,
} from "./evidence.js";
