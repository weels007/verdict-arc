# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import json
import re
import typing

import genlayer as gl

#
# VerdictArc - onchain court for agentic commerce (GenLayer Intelligent Contract).
# Runner pinned to the Studio-dev preview (v0.3.0 stack, chain 61997).
# Stable studionet uses py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6.
#
# Flow:
# - Consumer opens a case and locks escrow (value attached to lock_escrow).
# - Provider executes and publishes a structured evidence document at a public
#   URL, then submits that URL onchain.
# - The contract ITSELF fetches the evidence (gl.nondet.web.render) and extracts
#   the SLA result with an LLM under validator consensus
#   (gl.vm.run_nondet with independent re-run + decision-field comparison).
#   The decision comes from evidence content,
#   never from submitter claims. No mock path exists.
# - Satisfied -> release. Breach or malformed evidence -> bounded dispute path
#   (funds stay locked) with one counter-evidence round, same predicate.

ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"


def _fresh_evidence() -> dict:
    return {"evidence_url": "", "submission_time": 0, "result": "", "evaluated": False}


def _fresh_dispute() -> dict:
    return {
        "submitter": "",
        "reason_code": "",
        "counter_evidence_url": "",
        "counter_result": "",
        "decided": False,
        "decision": "",
    }


def _coerce_int(value: typing.Any, field: str) -> int:
    try:
        return int(round(float(str(value).strip())))
    except (ValueError, TypeError, AttributeError):
        raise gl.vm.UserError(f"{ERROR_LLM} Non-numeric field '{field}': {value}")


def _clean_llm_json(text: str) -> dict:
    first = text.find("{")
    last = text.rfind("}")
    if first == -1 or last == -1 or last <= first:
        raise gl.vm.UserError(f"{ERROR_LLM} No JSON object in LLM output")
    candidate = text[first : last + 1]
    candidate = re.sub(r",(?!\s*?[\{\[\"\'\w])", "", candidate)
    try:
        parsed = json.loads(candidate)
    except Exception as e:
        raise gl.vm.UserError(f"{ERROR_LLM} Unparsable LLM JSON: {e}")
    if not isinstance(parsed, dict):
        raise gl.vm.UserError(f"{ERROR_LLM} LLM JSON is not an object")
    return parsed


def _normalize_extraction(raw: typing.Any) -> dict:
    if isinstance(raw, dict):
        data = raw
    elif isinstance(raw, str):
        data = _clean_llm_json(raw)
    else:
        raise gl.vm.UserError(f"{ERROR_LLM} LLM returned {type(raw)}, expected dict or str")
    fmt = str(data.get("evidence_format", data.get("format", "unknown")))
    completed = data.get("completed_task_count", data.get("completed_count", 0))
    timestamps = data.get("completion_timestamps", data.get("timestamps", []))
    if not isinstance(timestamps, list):
        raise gl.vm.UserError(f"{ERROR_LLM} completion_timestamps is not a list")
    return {
        "evidence_format": fmt,
        "completed_task_count": _coerce_int(completed, "completed_task_count"),
        "completion_timestamps": [_coerce_int(t, "completion_timestamps[]") for t in timestamps],
        "all_tasks_successful": bool(data.get("all_tasks_successful", False)),
        "successful_responses": _coerce_int(
            data.get("successful_responses", data.get("successful", 0)), "successful_responses"
        ),
        "total_responses": _coerce_int(
            data.get("total_responses", data.get("total", 0)), "total_responses"
        ),
        "observation_window_start": _coerce_int(
            data.get("observation_window_start", data.get("window_start", 0)),
            "observation_window_start",
        ),
        "observation_window_end": _coerce_int(
            data.get("observation_window_end", data.get("window_end", 0)),
            "observation_window_end",
        ),
    }


def _judge_outcome(case: dict, extracted: dict) -> str:
    try:
        fmt = str(extracted.get("evidence_format", "unknown"))
        if fmt != case["evidence_mode"]:
            return "Malformed"

        if case["evidence_mode"] == "task_completion_v1":
            completed = int(extracted.get("completed_task_count", 0))
            timestamps = extracted.get("completion_timestamps", [])
            all_ok = bool(extracted.get("all_tasks_successful", False))
            if completed < case["task_count_required"]:
                return "NotSatisfied"
            for ts in timestamps:
                if int(ts) < case["window_start"] or int(ts) > case["window_end"]:
                    return "NotSatisfied"
            if not all_ok:
                return "NotSatisfied"
            return "Satisfied"

        ok = int(extracted.get("successful_responses", 0))
        total = int(extracted.get("total_responses", 0))
        w_start = int(extracted.get("observation_window_start", 0))
        w_end = int(extracted.get("observation_window_end", 0))
        if total <= 0:
            return "Malformed"
        if w_start < case["window_start"] or w_end > case["window_end"]:
            return "NotSatisfied"
        if (ok * 1000) < (case["availability_threshold_permille"] * total):
            return "NotSatisfied"
        return "Satisfied"
    except Exception:
        return "Malformed"


def _handle_leader_error(leaders_res: typing.Any, leader_fn: typing.Any) -> bool:
    leader_msg = leaders_res.message if hasattr(leaders_res, "message") else ""
    try:
        leader_fn()
        return False
    except gl.vm.UserError as e:
        validator_msg = e.message if hasattr(e, "message") else str(e)
        if validator_msg.startswith(ERROR_EXPECTED) or validator_msg.startswith(ERROR_EXTERNAL):
            return validator_msg == leader_msg
        if validator_msg.startswith(ERROR_TRANSIENT) and leader_msg.startswith(ERROR_TRANSIENT):
            return True
        return False
    except Exception:
        return False


class VerdictArc(gl.contract.Contract):
    # case_id -> full case record as canonical JSON.
    # JSON keeps the schema versioned and avoids nested storage classes;
    # amounts are stored as strings to stay exact for u256 values.
    cases: gl.storage.TreeMap[str, str]

    def __init__(self):
        pass

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get(self, case_id: str) -> dict:
        if case_id not in self.cases:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} unknown case_id: {case_id}")
        return json.loads(self.cases[case_id])

    def _put(self, case_id: str, case: dict) -> None:
        self.cases[case_id] = json.dumps(case, sort_keys=True)

    # ------------------------------------------------------------------
    # Views
    # ------------------------------------------------------------------

    @gl.public.view
    def get_case_summary(self, case_id: str) -> dict[str, typing.Any]:
        c = self._get(case_id)
        return {
            "provider": c["provider"],
            "consumer": c["consumer"],
            "service_description": c["service_description"],
            "sla_amount": int(c["sla_amount"]),
            "fee_amount": int(c["fee_amount"]),
            "penalty_amount": int(c["penalty_amount"]),
            "window_start": c["window_start"],
            "window_end": c["window_end"],
            "task_count_required": c["task_count_required"],
            "availability_threshold_permille": c["availability_threshold_permille"],
            "evidence_mode": c["evidence_mode"],
            "status": c["status"],
            "last_decision": c["last_decision"],
        }

    @gl.public.view
    def get_status(self, case_id: str) -> str:
        return self._get(case_id)["status"]

    @gl.public.view
    def get_last_decision(self, case_id: str) -> str:
        return self._get(case_id)["last_decision"]

    @gl.public.view
    def get_evidence(self, case_id: str) -> dict[str, typing.Any]:
        return self._get(case_id)["evidence"]

    @gl.public.view
    def get_dispute(self, case_id: str) -> dict[str, typing.Any]:
        return self._get(case_id)["dispute"]

    # ------------------------------------------------------------------
    # Case lifecycle
    # ------------------------------------------------------------------

    @gl.public.write
    def create_case(
        self,
        case_id: str,
        provider: gl.Address,
        consumer: gl.Address,
        service_description: str,
        window_start: int,
        window_end: int,
        task_count_required: int,
        availability_threshold_permille: int,
        evidence_mode: str,
    ) -> None:
        if case_id in self.cases:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} case_id already exists")
        if window_start >= window_end:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} window_start must be before window_end")
        if task_count_required <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task_count_required must be > 0")
        if evidence_mode not in ("task_completion_v1", "availability_v1"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} unsupported evidence_mode")
        if availability_threshold_permille <= 0 or availability_threshold_permille > 1000:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} availability_threshold_permille must be in (0, 1000]"
            )

        self._put(
            case_id,
            {
                "provider": provider.as_hex,
                "consumer": consumer.as_hex,
                "service_description": service_description,
                "sla_amount": "0",
                "fee_amount": "0",
                "penalty_amount": "0",
                "window_start": window_start,
                "window_end": window_end,
                "task_count_required": task_count_required,
                "availability_threshold_permille": availability_threshold_permille,
                "evidence_mode": evidence_mode,
                "status": "Offering",
                "last_decision": "",
                "evidence": _fresh_evidence(),
                "dispute": _fresh_dispute(),
            },
        )

    @gl.public.write.payable
    def lock_escrow(self, case_id: str, fee_amount: gl.u256, penalty_amount: gl.u256) -> None:
        c = self._get(case_id)
        if c["status"] != "Offering":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} case must be in Offering to lock escrow")
        if gl.message.sender_address.as_hex != c["consumer"]:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the consumer can lock escrow")
        if gl.message.value <= 0:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} lock_escrow must attach value as the escrow amount"
            )
        c["sla_amount"] = str(gl.message.value)
        c["fee_amount"] = str(fee_amount)
        c["penalty_amount"] = str(penalty_amount)
        c["status"] = "EscrowLocked"
        self._put(case_id, c)

    @gl.public.write
    def start_execution(self, case_id: str) -> None:
        c = self._get(case_id)
        if c["status"] != "EscrowLocked":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} case must be EscrowLocked to start execution")
        if gl.message.sender_address.as_hex != c["provider"]:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the provider can start execution")
        c["status"] = "InExecution"
        self._put(case_id, c)

    # ------------------------------------------------------------------
    # Evidence: the contract fetches real evidence from the web and lets
    # validator consensus agree on the extracted SLA result.
    # ------------------------------------------------------------------

    @gl.public.write
    def submit_evidence(self, case_id: str, evidence_url: str, submission_time: int) -> None:
        c = self._get(case_id)
        if c["status"] != "InExecution":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} case must be InExecution to submit evidence")
        if gl.message.sender_address.as_hex != c["provider"]:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the provider can submit evidence")
        if evidence_url == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} evidence_url is required")

        # Window enforcement uses timestamps extracted from the evidence itself
        # (completion_timestamps / observation_window), so the decision derives
        # from evidence content, not submitter claims.
        c["evidence"] = {
            "evidence_url": evidence_url,
            "submission_time": submission_time,
            "result": "",
            "evaluated": False,
        }
        c["status"] = "EvidenceSubmitted"
        self._put(case_id, c)

    def _fetch_and_extract(
        self,
        evidence_mode: str,
        task_count_required: int,
        availability_threshold_permille: int,
        window_start: int,
        window_end: int,
        url: str,
    ) -> dict:
        # Per docs: strict_eq must NOT be used for LLM calls — LLM outputs are
        # non-deterministic and strict_eq would fail consensus. Use
        # run_nondet with an independent re-run + decision-field compare.
        # Pattern: fetch web data -> LLM extraction -> return structured data,
        # all inside the same nondet block. Storage writes stay outside.
        def leader_fn() -> str:
            try:
                web_data = gl.nondet.web.render(url, mode="text")
            except Exception as e:
                raise gl.vm.UserError(f"{ERROR_TRANSIENT} evidence fetch failed: {e}")
            if not web_data or not str(web_data).strip():
                raise gl.vm.UserError(f"{ERROR_EXTERNAL} empty evidence at URL")
            task = f"""
You are auditing SLA evidence for an agentic-commerce escrow case.

Evidence mode: {evidence_mode}
Required task count: {task_count_required}
Availability threshold (permille): {availability_threshold_permille}
Service window start (unix): {window_start}
Service window end (unix): {window_end}

Evidence content:
{web_data}

Respond in JSON:
{{
    "evidence_format": str,
    "completed_task_count": int,
    "completion_timestamps": [int],
    "all_tasks_successful": bool,
    "successful_responses": int,
    "total_responses": int,
    "observation_window_start": int,
    "observation_window_end": int
}}
"""
            raw = gl.nondet.exec_prompt(task, response_format="json")
            normalized = _normalize_extraction(raw)
            return json.dumps(normalized, sort_keys=True)

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)
            try:
                leader_data = json.loads(leaders_res.calldata)
            except Exception:
                return False
            try:
                validator_data = json.loads(leader_fn())
            except gl.vm.UserError as e:
                msg = e.message if hasattr(e, "message") else str(e)
                if msg.startswith(ERROR_TRANSIENT):
                    return False
                return False
            except Exception:
                return False
            # Compare only decision fields — free-form text would differ.
            # evidence_format gates the predicate, so it must match exactly.
            if leader_data.get("evidence_format") != validator_data.get("evidence_format"):
                return False
            for field in (
                "completed_task_count",
                "all_tasks_successful",
                "successful_responses",
                "total_responses",
                "observation_window_start",
                "observation_window_end",
            ):
                if leader_data.get(field) != validator_data.get(field):
                    return False
            if leader_data.get("completion_timestamps") != validator_data.get(
                "completion_timestamps"
            ):
                return False
            return True

        return json.loads(gl.vm.run_nondet(leader_fn, validator_fn))

    @gl.public.write
    def evaluate_evidence(self, case_id: str) -> str:
        c = self._get(case_id)
        if c["status"] != "EvidenceSubmitted":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} case must be EvidenceSubmitted to evaluate")
        if c["evidence"]["evidence_url"] == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} no evidence submitted")

        extracted = self._fetch_and_extract(
            c["evidence_mode"],
            c["task_count_required"],
            c["availability_threshold_permille"],
            c["window_start"],
            c["window_end"],
            c["evidence"]["evidence_url"],
        )
        outcome = _judge_outcome(c, extracted)
        c["evidence"]["result"] = outcome
        c["evidence"]["evaluated"] = True

        if outcome == "Satisfied":
            c["last_decision"] = "Release"
            c["status"] = "DecisionPending"
            self._put(case_id, c)
            return "Release"
        # NotSatisfied / Malformed: bounded dispute path. Funds stay locked.
        c["last_decision"] = "Failed"
        c["status"] = "SettledDisputed"
        self._put(case_id, c)
        return "Failed"

    # ------------------------------------------------------------------
    # Settlement
    # ------------------------------------------------------------------

    @gl.public.write
    def release(self, case_id: str) -> None:
        c = self._get(case_id)
        if c["status"] != "DecisionPending":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} release requires DecisionPending")
        c["status"] = "SettledReleased"
        self._put(case_id, c)

    @gl.public.write
    def penalize(self, case_id: str) -> None:
        c = self._get(case_id)
        if c["status"] != "DecisionPending":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} penalize requires DecisionPending")
        c["status"] = "SettledPenalized"
        self._put(case_id, c)

    # ------------------------------------------------------------------
    # Dispute: same predicate, counter-evidence, bounded outcome.
    # ------------------------------------------------------------------

    @gl.public.write
    def submit_dispute(self, case_id: str, reason_code: str, counter_evidence_url: str) -> None:
        c = self._get(case_id)
        if c["status"] != "SettledDisputed":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} dispute requires SettledDisputed")
        sender = gl.message.sender_address.as_hex
        if sender != c["provider"] and sender != c["consumer"]:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only case parties can open a dispute")
        if counter_evidence_url == "":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} counter_evidence_url is required")

        c["dispute"] = {
            "submitter": sender,
            "reason_code": reason_code,
            "counter_evidence_url": counter_evidence_url,
            "counter_result": "",
            "decided": False,
            "decision": "",
        }
        c["status"] = "DisputeSubmitted"
        self._put(case_id, c)

    @gl.public.write
    def evaluate_dispute(self, case_id: str) -> str:
        c = self._get(case_id)
        if c["status"] != "DisputeSubmitted":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} evaluate_dispute requires DisputeSubmitted")
        if c["dispute"]["decided"]:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} dispute already decided")

        counter = self._fetch_and_extract(
            c["evidence_mode"],
            c["task_count_required"],
            c["availability_threshold_permille"],
            c["window_start"],
            c["window_end"],
            c["dispute"]["counter_evidence_url"],
        )
        counter_outcome = _judge_outcome(c, counter)
        c["dispute"]["counter_result"] = counter_outcome
        c["dispute"]["decided"] = True

        if counter_outcome == "Satisfied":
            c["dispute"]["decision"] = "Release"
            c["last_decision"] = "Release"
            c["status"] = "SettledReleased"
        elif c["evidence"]["result"] == "Satisfied":
            c["dispute"]["decision"] = "Refund"
            c["last_decision"] = "Penalty"
            c["status"] = "SettledPenalized"
        else:
            c["dispute"]["decision"] = "Failed"
            c["last_decision"] = "Failed"
            c["status"] = "DisputeDecided"
        self._put(case_id, c)
        return c["dispute"]["decision"]
