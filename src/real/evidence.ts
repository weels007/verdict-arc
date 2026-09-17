// Real evidence publishing for the GenLayer SLA-escrow contract.
//
// The onchain contract (contracts/verdict_arc.py) fetches evidence from a URL
// with validator consensus (gl.nondet.web.render + LLM extraction under
// gl.vm.run_nondet with decision-field comparison).
// The provider's job is to publish a structured evidence document at a publicly
// reachable URL and submit that URL onchain via submit_evidence.
//
// There is no mock verifier here: this module builds the canonical evidence
// document and publishes it over HTTPS to a host the provider controls. The
// content-type is text/plain so gl.nondet.web.render(mode="text") can read it.

export type EvidenceMode = "task_completion_v1" | "availability_v1";

export interface TaskCompletionEvidenceDoc {
  evidence_format: "task_completion_v1";
  batch_id: string;
  completed_task_count: number;
  completion_timestamps: number[];
  all_tasks_successful: boolean;
  worker_binding: string;
}

export interface AvailabilityEvidenceDoc {
  evidence_format: "availability_v1";
  endpoint_id: string;
  observation_window_start: number;
  observation_window_end: number;
  successful_responses: number;
  total_responses: number;
  monitor_ref: string;
}

export type SlaEvidenceDoc = TaskCompletionEvidenceDoc | AvailabilityEvidenceDoc;

/** Build the task-completion evidence document the contract's extractor expects. */
export function makeTaskCompletionEvidenceDoc(options: {
  batchId: string;
  completedTaskCount: number;
  completionTimestamps: number[];
  allTasksSuccessful: boolean;
  workerBinding: string;
}): TaskCompletionEvidenceDoc {
  const { batchId, completedTaskCount, completionTimestamps, allTasksSuccessful, workerBinding } = options;
  if (completedTaskCount <= 0) throw new Error("completedTaskCount must be > 0");
  if (completionTimestamps.length !== completedTaskCount) {
    throw new Error("completionTimestamps length must equal completedTaskCount");
  }
  return {
    evidence_format: "task_completion_v1",
    batch_id: batchId,
    completed_task_count: completedTaskCount,
    completion_timestamps: [...completionTimestamps],
    all_tasks_successful: allTasksSuccessful,
    worker_binding: workerBinding,
  };
}

/** Build the availability evidence document the contract's extractor expects. */
export function makeAvailabilityEvidenceDoc(options: {
  endpointId: string;
  observationWindowStart: number;
  observationWindowEnd: number;
  successfulResponses: number;
  totalResponses: number;
  monitorRef: string;
}): AvailabilityEvidenceDoc {
  const { endpointId, observationWindowStart, observationWindowEnd, successfulResponses, totalResponses, monitorRef } = options;
  if (observationWindowStart >= observationWindowEnd) {
    throw new Error("observation window must satisfy start < end");
  }
  if (totalResponses <= 0) throw new Error("totalResponses must be > 0");
  if (successfulResponses < 0 || successfulResponses > totalResponses) {
    throw new Error("successfulResponses must be within [0, totalResponses]");
  }
  return {
    evidence_format: "availability_v1",
    endpoint_id: endpointId,
    observation_window_start: observationWindowStart,
    observation_window_end: observationWindowEnd,
    successful_responses: successfulResponses,
    total_responses: totalResponses,
    monitor_ref: monitorRef,
  };
}

/** Serialize the evidence document exactly as it will be published. */
export function serializeEvidenceDoc(doc: SlaEvidenceDoc): string {
  return JSON.stringify(doc, null, 2);
}

export interface PublishResult {
  url: string;
  bytes: number;
}

/**
 * Publish the evidence document to a real HTTPS endpoint (e.g. a gist raw URL,
 * S3 object, or the provider's own server). Requires a real upload endpoint
 * and token; there is no local or mock fallback.
 */
export async function publishEvidenceDoc(options: {
  publishUrl: string;
  bearerToken: string;
  doc: SlaEvidenceDoc;
  fetchImpl?: typeof fetch;
}): Promise<PublishResult> {
  const { publishUrl, bearerToken, doc } = options;
  const doFetch = options.fetchImpl ?? fetch;
  if (!publishUrl.startsWith("https://")) {
    throw new Error("publishUrl must be a real HTTPS endpoint");
  }
  if (!bearerToken) {
    throw new Error("bearerToken is required to publish evidence");
  }
  const body = serializeEvidenceDoc(doc);
  const response = await doFetch(publishUrl, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      authorization: `Bearer ${bearerToken}`,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`evidence publish failed: HTTP ${response.status} ${response.statusText}`);
  }
  return { url: publishUrl, bytes: body.length };
}
