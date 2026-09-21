// VerdictArc — real-chain SPA.
//
// Routes: #/ (landing), #/how, #/features, #/app (wallet-connected dashboard).
// Every write is signed in the user's wallet (MetaMask / Rabby via EIP-1193).
// Every read goes straight to the deployed VerdictArc intelligent contract.
// There is no mock path: without a real endpoint + contract the app cannot
// load a case.

import { createWalletAdapter, type ChainCallAdapter, type Eip1193Provider } from "../../src/real/adapter.js";
import { loadConfig, isConfigured, DEFAULTS, type AppConfig } from "./config.js";
import {
  detectWallets,
  connectWallet,
  getConnectedAddress,
  hasWallet,
  shortenAddress,
  type WalletInfo,
} from "./wallet.js";
import { renderLanding } from "./pages/landing.js";
import { renderHow } from "./pages/how.js";
import { renderFeatures } from "./pages/features.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface AppState {
  config: AppConfig;
  wallet: WalletInfo | null;
  adapter: ChainCallAdapter | null;
  caseId: string | null;
  dashboardBooted: boolean;
  walletListenerBound: boolean;
}

const state: AppState = {
  config: loadConfig(),
  wallet: null,
  adapter: null,
  caseId: null,
  dashboardBooted: false,
  walletListenerBound: false,
};

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function $within(root: ParentNode, id: string): HTMLElement {
  const el = root.querySelector(`#${id}`);
  if (!el) throw new Error(`missing #${id}`);
  return el as HTMLElement;
}

function inputWithin(root: ParentNode, id: string): HTMLInputElement {
  return $within(root, id) as HTMLInputElement;
}

function log(root: ParentNode, kind: "info" | "ok" | "err" | "warn", message: string): void {
  const box = root.querySelector("#log");
  if (!box) return;
  const line = document.createElement("div");
  line.className = "line";
  const t = document.createElement("span");
  t.className = "t";
  t.textContent = new Date().toLocaleTimeString();
  const m = document.createElement("span");
  m.className = kind;
  m.textContent = message;
  line.append(t, m);
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function setBusy(root: ParentNode, action: string | null): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>(".actions .action");
  buttons.forEach((b) => {
    b.disabled = action !== null;
  });
  const create = root.querySelector<HTMLButtonElement>("#create-btn");
  if (create) create.disabled = action !== null;
  const submit = root.querySelector<HTMLButtonElement>("#submit-evidence-btn");
  if (submit) submit.disabled = action !== null;
}

function setConnState(stateName: "idle" | "ok" | "err", label: string): void {
  const el = document.getElementById("conn-status");
  if (!el) return;
  el.dataset.state = stateName;
  const labelEl = document.getElementById("conn-label");
  if (labelEl) labelEl.textContent = label;
}

let notifyTimeout: number | null = null;

function notify(root: ParentNode, message: string, kind: "err" | "warn" = "err"): void {
  let box = root.querySelector("#notify") as HTMLDivElement | null;
  if (!box) {
    box = document.createElement("div");
    box.id = "notify";
    const panel = root.querySelector(".panel");
    if (panel) panel.insertBefore(box, panel.firstChild);
  }
  box.textContent = "";
  box.className = `notify notify-${kind}`;
  const t = document.createElement("span");
  t.textContent = message;
  box.appendChild(t);
  box.hidden = false;
  if (notifyTimeout) window.clearTimeout(notifyTimeout);
  notifyTimeout = window.setTimeout(() => { box.hidden = true; }, 5000);
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

function updateConnectButton(): void {
  const btn = document.getElementById("connect-btn");
  if (!btn) return;
  if (state.wallet) {
    btn.textContent = `Disconnect · ${shortenAddress(state.wallet.address)}`;
  } else {
    btn.textContent = "Connect Wallet";
  }
}

async function onConnect(root?: ParentNode): Promise<void> {
  if (state.wallet) {
    state.wallet = null;
    state.adapter = null;
    setConnState("idle", "Wallet not connected");
    updateConnectButton();
    if (root) {
      log(root, "info", "Wallet disconnected.");
      renderNetworkStatus(root);
    }
    return;
  }

  if (!hasWallet()) {
    setConnState("err", "No wallet found");
    if (root) log(root, "err", "No injected wallet detected. Install MetaMask or Rabby.");
    return;
  }

  const wallets = detectWallets();
  const chosen = wallets[0];
  try {
    const info = await connectWallet(chosen.provider);
    state.wallet = info;
    state.walletListenerBound = false;
    setConnState("ok", `${info.walletName} · ${shortenAddress(info.address)}`);
    updateConnectButton();
    if (root) {
      log(root, "ok", `Connected: ${info.walletName} ${info.address}`);
      notify(root, `Wallet connected: ${info.walletName} ${shortenAddress(info.address)}`, "ok");
      prefillFromWallet(root);
      rebuildAdapter(root);
      refreshNetworkStatus(root);
      bindWalletEvents(root);
    }
  } catch (error) {
    setConnState("err", "Connection rejected");
    if (root) log(root, "err", error instanceof Error ? error.message : String(error));
  }
}

function bindWalletEvents(root: ParentNode): void {
  if (state.walletListenerBound || !state.wallet) return;
  const provider = state.wallet.provider as Eip1193Provider & {
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
  };
  if (typeof provider.on !== "function") return;
  state.walletListenerBound = true;
  const handleAccounts = (...args: unknown[]): void => {
    const accounts = args[0] as string[] | undefined;
    const next = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null;
    if (!next || !/^0x[a-fA-F0-9]{40}$/.test(next)) {
      state.wallet = null;
      state.adapter = null;
      setConnState("idle", "Wallet not connected");
      updateConnectButton();
      if (root) log(root, "warn", "Wallet disconnected.");
      return;
    }
    if (state.wallet) state.wallet.address = next;
    setConnState("ok", state.wallet ? `${state.wallet.walletName} · ${shortenAddress(next)}` : next);
    if (root) {
      log(root, "info", `Wallet account changed → ${next}`);
      prefillFromWallet(root);
      rebuildAdapter(root);
      refreshNetworkStatus(root);
    }
  };
  provider.on("accountsChanged", handleAccounts);
  provider.on("chainChanged", () => {
    if (root) {
      log(root, "warn", "Wallet chain changed — adapter rebuilt.");
      rebuildAdapter(root);
      refreshNetworkStatus(root);
    }
  });
}

function prefillFromWallet(root: ParentNode): void {
  if (!state.wallet) return;
  const providerInput = root.querySelector<HTMLInputElement>("#provider");
  const consumerInput = root.querySelector<HTMLInputElement>("#consumer");
  if (providerInput && !providerInput.value) providerInput.value = state.wallet.address;
  if (consumerInput && !consumerInput.value) consumerInput.value = state.wallet.address;
}

// ---------------------------------------------------------------------------
// Adapter lifecycle
// ---------------------------------------------------------------------------

function readSessionConfig(_root: ParentNode): { endpoint: string; contractAddress: string } {
  return {
    endpoint: state.config.endpoint,
    contractAddress: state.config.contractAddress,
  };
}

function safeRebuildAdapter(root: ParentNode): void {
  try {
    rebuildAdapter(root);
  } catch (error) {
    log(root, "err", error instanceof Error ? error.message : String(error));
  }
}

function rebuildAdapter(root?: ParentNode): void {
  state.adapter = null;
  if (!root) return;
  const { endpoint, contractAddress } = readSessionConfig(root);

  if (!endpoint || !contractAddress) {
    log(root, "warn", "No network set. Configure VITE_GENLAYER_ENDPOINT / VITE_GENLAYER_CONTRACT at deploy time.");
    return;
  }
  if (!state.wallet) {
    log(root, "warn", "Connect a wallet to sign transactions.");
    return;
  }

  try {
    state.adapter = createWalletAdapter({
      endpoint,
      contractAddress,
      provider: state.wallet.provider as Eip1193Provider,
      account: state.wallet.address,
    });
    log(root, "info", `Adapter ready → ${endpoint} · ${shortenAddress(contractAddress)}`);
  } catch (error) {
    log(root, "err", error instanceof Error ? error.message : String(error));
  }
}

function requireAdapter(root: ParentNode): ChainCallAdapter {
  if (!state.adapter) {
    rebuildAdapter(root);
  }
  if (!state.adapter) {
    throw new Error(
      "No chain adapter. Connect a wallet and set endpoint + contract address first."
    );
  }
  return state.adapter;
}

// ---------------------------------------------------------------------------
// Case creation
// ---------------------------------------------------------------------------

async function onCreateCase(root: ParentNode): Promise<void> {
  let adapter: ChainCallAdapter;
  try {
    adapter = requireAdapter(root);
  } catch (error) {
    log(root, "err", error instanceof Error ? error.message : String(error));
    notify(root, error instanceof Error ? error.message : String(error), "err");
    return;
  }
  const caseId = inputWithin(root, "case-id").value.trim();
  if (!caseId) {
    log(root, "err", "Case ID is required.");
    return;
  }

  const provider = inputWithin(root, "provider").value.trim();
  const consumer = inputWithin(root, "consumer").value.trim();
  if (!provider || !consumer) {
    log(root, "err", "Provider and consumer addresses are required.");
    return;
  }

  const windowStart = Number(inputWithin(root, "win-start").value);
  const windowEnd = Number(inputWithin(root, "win-end").value);
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowStart >= windowEnd) {
    log(root, "err", "Window must satisfy start < end.");
    return;
  }

  setBusy(root, "create");
  try {
    const result = await adapter.createCase({
      caseId,
      provider,
      consumer,
      serviceDescription: inputWithin(root, "desc").value.trim() || "service",
      windowStart,
      windowEnd,
      taskCountRequired: Math.max(1, Number(inputWithin(root, "tasks").value) || 1),
      availabilityThresholdPermille: Math.min(1000, Math.max(1, Number(inputWithin(root, "threshold").value) || 950)),
      evidenceMode: (root.querySelector<HTMLSelectElement>("#mode")?.value) ?? "task_completion_v1",
    });
    log(root, "ok", `create_case confirmed · tx ${result.txHash.slice(0, 14)}…`);
    state.caseId = caseId;
    inputWithin(root, "load-id").value = caseId;
    await refreshCase(root);
  } catch (error) {
    log(root, "err", error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(root, null);
  }
}

// ---------------------------------------------------------------------------
// Case loading / rendering
// ---------------------------------------------------------------------------

async function onLoadCase(root: ParentNode): Promise<void> {
  let adapter: ChainCallAdapter;
  try {
    adapter = requireAdapter(root);
  } catch (error) {
    log(root, "err", error instanceof Error ? error.message : String(error));
    return;
  }
  const caseId = inputWithin(root, "load-id").value.trim();
  if (!caseId) {
    log(root, "err", "Enter a case ID to load.");
    return;
  }
  state.caseId = caseId;
  await refreshCase(root);
  void adapter;
}

async function refreshCase(root: ParentNode): Promise<void> {
  if (!state.caseId) return;
  let adapter: ChainCallAdapter;
  try {
    adapter = requireAdapter(root);
  } catch (error) {
    log(root, "err", error instanceof Error ? error.message : String(error));
    return;
  }

  try {
    const summary = await adapter.getCaseSummary(state.caseId);
    const evidence = await adapter.getEvidence(state.caseId);
    const dispute = await adapter.getDispute(state.caseId);
    const decision = await adapter.getLastDecision(state.caseId);
    renderCase(root, summary, evidence, dispute, decision);
  } catch (error) {
    log(root, "err", `load failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function setText(root: ParentNode, id: string, value: unknown): void {
  const el = root.querySelector(`#${id}`);
  if (!el) return;
  el.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
}

function renderCase(
  root: ParentNode,
  summary: Record<string, unknown>,
  evidence: Record<string, unknown>,
  dispute: Record<string, unknown>,
  decision: string
): void {
  const status = String(summary.status ?? "unknown");
  const banner = root.querySelector("#status-banner");
  if (banner) banner.setAttribute("data-status", status);
  setText(root, "status-value", status);
  setText(root, "decision-value", decision);

  setText(root, "sum-provider", summary.provider);
  setText(root, "sum-consumer", summary.consumer);
  setText(root, "sum-desc", summary.service_description);
  setText(root, "sum-mode", summary.evidence_mode);
  setText(root, "sum-window", `${summary.window_start} → ${summary.window_end}`);
  setText(root, "sum-tasks", summary.task_count_required);
  setText(root, "sum-threshold", `${summary.availability_threshold_permille}‰`);

  setText(root, "ev-url", evidence.evidence_url);
  setText(root, "ev-result", evidence.result);
  setText(root, "ev-evaluated", evidence.evaluated ? "yes" : "no");

  setText(root, "dp-submitter", dispute.submitter);
  setText(root, "dp-reason", dispute.reason_code);
  setText(root, "dp-url", dispute.counter_evidence_url);
  setText(root, "dp-counter", dispute.counter_result);
  setText(root, "dp-decision", dispute.decision);

  const disputeRow = root.querySelector("#dispute-row");
  if (disputeRow) (disputeRow as HTMLElement).hidden = status !== "SettledDisputed";

  log(root, "info", `case ${state.caseId} @ ${status}`);
}

// ---------------------------------------------------------------------------
// Lifecycle actions (wallet-signed writes)
// ---------------------------------------------------------------------------

async function onAction(root: ParentNode, name: string): Promise<void> {
  if (!state.caseId) {
    log(root, "err", "Load or create a case first.");
    return;
  }
  let adapter: ChainCallAdapter;
  try {
    adapter = requireAdapter(root);
  } catch (error) {
    log(root, "err", error instanceof Error ? error.message : String(error));
    return;
  }

  setBusy(root, name);
  try {
    switch (name) {
      case "lock_escrow": {
        const result = await adapter.lockEscrow(state.caseId, {
          slaAmount: inputWithin(root, "sla-amount").value.trim() || DEFAULTS.slaAmount,
          feeAmount: DEFAULTS.feeAmount,
          penaltyAmount: DEFAULTS.penaltyAmount,
        });
        log(root, "ok", `lock_escrow confirmed · tx ${result.txHash.slice(0, 14)}…`);
        break;
      }
      case "start_execution": {
        const result = await adapter.startExecution(state.caseId);
        log(root, "ok", `start_execution confirmed · tx ${result.txHash.slice(0, 14)}…`);
        break;
      }
      case "submit_evidence": {
        const evidenceUrl = inputWithin(root, "evidence-url").value.trim();
        if (!evidenceUrl) {
          log(root, "err", "Evidence URL is required for submit_evidence.");
          return;
        }
        if (!/^https:\/\//.test(evidenceUrl)) {
          log(root, "err", "Evidence URL must be a public HTTPS URL (validators fetch it).");
          return;
        }
        const rawTime = inputWithin(root, "evidence-time").value.trim();
        const submissionTime = rawTime ? Number(rawTime) : Math.floor(Date.now() / 1000);
        if (!Number.isFinite(submissionTime) || submissionTime <= 0) {
          log(root, "err", "Submission time must be a positive unix timestamp.");
          return;
        }
        const result = await adapter.submitEvidence(state.caseId, {
          evidenceUrl,
          submissionTime,
        });
        log(root, "ok", `submit_evidence confirmed · tx ${result.txHash.slice(0, 14)}…`);
        break;
      }
      case "evaluate_evidence": {
        log(root, "warn", "Evaluate waits for validator consensus on fetched evidence…");
        const result = await adapter.evaluateEvidence(state.caseId);
        log(root, "ok", `evaluate_evidence → ${result.decision}`);
        break;
      }
      case "release": {
        const result = await adapter.release(state.caseId);
        log(root, "ok", `release confirmed · tx ${result.txHash.slice(0, 14)}…`);
        break;
      }
      case "penalize": {
        const result = await adapter.penalize(state.caseId);
        log(root, "ok", `penalize confirmed · tx ${result.txHash.slice(0, 14)}…`);
        break;
      }
      case "dispute": {
        const counterUrl = inputWithin(root, "counter-url").value.trim();
        if (!counterUrl) {
          log(root, "err", "Counter-evidence URL is required for submit_dispute.");
          return;
        }
        const result = await adapter.disputeSubmit(state.caseId, {
          reasonCode: "counter_evidence_provided",
          counterEvidenceUrl: counterUrl,
        });
        log(root, "ok", `submit_dispute confirmed · tx ${result.txHash.slice(0, 14)}…`);
        const decided = await adapter.disputeEvaluate(state.caseId);
        log(root, "ok", `evaluate_dispute → ${decided.decision}`);
        break;
      }
      default:
        log(root, "err", `Unknown action ${name}`);
    }
    await refreshCase(root);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(root, "err", `${name} failed: ${message}`);
    notify(root, `${name} failed: ${message}`, "err");
  } finally {
    setBusy(root, null);
  }
}

// ---------------------------------------------------------------------------
// Dashboard route
// ---------------------------------------------------------------------------

function renderDashboard(root: HTMLElement): void {
  root.innerHTML = `
  <div class="route">
    <div class="app-layout">
      <section class="panel">
        <h2><span class="step-num">1</span> Network</h2>

        <div class="net-status" id="net-status">
          <div class="kv"><span>Network</span><b class="mono" id="net-name">—</b></div>
          <div class="kv"><span>Contract</span><b class="mono" id="net-contract">—</b></div>
          <div class="kv"><span>Wallet</span><b class="mono" id="net-wallet">not connected</b></div>
        </div>



        <h2 class="panel-sub"><span class="step-num">2</span> Open a case</h2>

        <div class="field-row">
          <label for="case-id">Case ID</label>
          <input id="case-id" type="text" spellcheck="false" placeholder="case-001" class="mono" />
        </div>

        <div class="grid-2">
          <div class="field-row">
            <label for="provider">Provider address</label>
            <input id="provider" type="text" spellcheck="false" placeholder="0x…" class="mono" />
          </div>
          <div class="field-row">
            <label for="consumer">Consumer address</label>
            <input id="consumer" type="text" spellcheck="false" placeholder="0x…" class="mono" />
          </div>
        </div>

        <div class="field-row">
          <label for="desc">Service description</label>
          <input id="desc" type="text" placeholder="AI content review batch" />
        </div>

        <div class="grid-3">
          <div class="field-row">
            <label for="mode">Evidence mode</label>
            <select id="mode">
              <option value="task_completion_v1">task_completion_v1</option>
              <option value="availability_v1">availability_v1</option>
            </select>
          </div>
          <div class="field-row">
            <label for="tasks">Required tasks</label>
            <input id="tasks" type="number" min="1" value="5" />
          </div>
          <div class="field-row">
            <label for="threshold">Availability ‰</label>
            <input id="threshold" type="number" min="1" max="1000" value="950" />
          </div>
        </div>

        <div class="grid-3">
          <div class="field-row">
            <label for="win-start">Window start (unix)</label>
            <input id="win-start" type="number" />
          </div>
          <div class="field-row">
            <label for="win-end">Window end (unix)</label>
            <input id="win-end" type="number" />
          </div>
          <div class="field-row">
            <label for="sla-amount">Escrow (wei)</label>
            <input id="sla-amount" type="text" value="1000000000000000000" class="mono" />
          </div>
        </div>

        <button id="create-btn" class="btn btn-primary btn-block" type="button">Create Case</button>
      </section>

      <section class="panel">
        <h2><span class="step-num">3</span> Case lifecycle</h2>

        <div class="field-row inline">
          <label for="load-id">Load case</label>
          <input id="load-id" type="text" spellcheck="false" placeholder="case-001" class="mono" />
          <button id="load-btn" class="btn" type="button">Load</button>
        </div>

        <div class="status-banner" id="status-banner" data-status="unknown">
          <div>
            <div class="status-label">Case status</div>
            <div class="status-value mono" id="status-value">—</div>
          </div>
          <div>
            <div class="status-label">Last decision</div>
            <div class="status-value mono" id="decision-value">—</div>
          </div>
        </div>

        <div class="case-summary" id="case-summary">
          <div class="kv"><span>Provider</span><b class="mono" id="sum-provider">—</b></div>
          <div class="kv"><span>Consumer</span><b class="mono" id="sum-consumer">—</b></div>
          <div class="kv"><span>Service</span><b id="sum-desc">—</b></div>
          <div class="kv"><span>Evidence mode</span><b class="mono" id="sum-mode">—</b></div>
          <div class="kv"><span>Window</span><b class="mono" id="sum-window">—</b></div>
          <div class="kv"><span>Required tasks</span><b id="sum-tasks">—</b></div>
          <div class="kv"><span>Threshold</span><b id="sum-threshold">—</b></div>
        </div>

        <div class="actions">
          <button class="btn action" data-action="lock_escrow" type="button">2 · Lock Escrow <small>consumer</small></button>
          <button class="btn action" data-action="start_execution" type="button">3 · Start Execution <small>provider</small></button>
          <button class="btn action" data-action="evaluate_evidence" type="button">5 · Evaluate Evidence <small>consensus</small></button>
          <button class="btn action" data-action="release" type="button">6a · Release <small>on Release</small></button>
          <button class="btn action" data-action="penalize" type="button">6b · Penalize <small>on breach</small></button>
          <button class="btn action" data-action="dispute" type="button">6c · Dispute <small>counter-evidence</small></button>
        </div>

        <div class="field-row">
          <label for="evidence-url">4 · Evidence URL <small>provider — public HTTPS doc</small></label>
          <input id="evidence-url" type="url" spellcheck="false" placeholder="https://…" />
        </div>
        <div class="field-row inline">
          <label for="evidence-time">Submission time (unix, blank = now)</label>
          <input id="evidence-time" type="number" min="1" placeholder="auto" />
          <button id="submit-evidence-btn" class="btn" type="button" data-evidence-submit>Submit Evidence</button>
        </div>

        <div class="field-row" id="dispute-row" hidden>
          <label for="counter-url">Counter-evidence URL</label>
          <input id="counter-url" type="url" spellcheck="false" placeholder="https://…" />
        </div>

        <h3>Evidence</h3>
        <div class="evidence-box">
          <div class="kv"><span>URL</span><b class="mono" id="ev-url">—</b></div>
          <div class="kv"><span>Result</span><b id="ev-result">—</b></div>
          <div class="kv"><span>Evaluated</span><b id="ev-evaluated">—</b></div>
        </div>

        <h3>Dispute</h3>
        <div class="evidence-box">
          <div class="kv"><span>Submitter</span><b class="mono" id="dp-submitter">—</b></div>
          <div class="kv"><span>Reason</span><b id="dp-reason">—</b></div>
          <div class="kv"><span>Counter URL</span><b class="mono" id="dp-url">—</b></div>
          <div class="kv"><span>Counter result</span><b id="dp-counter">—</b></div>
          <div class="kv"><span>Decision</span><b id="dp-decision">—</b></div>
        </div>

        <h3>Activity</h3>
        <div class="log" id="log" aria-live="polite"></div>
      </section>
    </div>
  </div>`;

  if (state.dashboardBooted) {
    // Re-visiting the route: DOM was rebuilt, so rebind and restore the
    // network, then refresh status.
    bindDashboard(root);
    fillDashboardDefaults(root);
    renderNetworkStatus(root);
    if (state.wallet) {
      safeRebuildAdapter(root);
      prefillFromWallet(root);
      refreshNetworkStatus(root);
      bindWalletEvents(root);
      updateConnectButton();
    } else {
      void restoreWalletIfApproved(root);
    }
    return;
  }

  bindDashboard(root);
  fillDashboardDefaults(root);
  renderNetworkStatus(root);
  if (state.wallet) {
    safeRebuildAdapter(root);
    prefillFromWallet(root);
    refreshNetworkStatus(root);
    bindWalletEvents(root);
    updateConnectButton();
  }
  state.dashboardBooted = true;

  if (!isConfigured()) {
    log(root, "warn", "No network baked into this build. Set VITE_GENLAYER_ENDPOINT / VITE_GENLAYER_CONTRACT at deploy time.");
  } else {
    log(root, "info", `Network ready → ${state.config.endpoint}`);
  }
  log(root, "info", "Connect a wallet to sign real transactions.");
  if (!state.wallet) {
    notify(root, "Connect your wallet to use the dashboard", "warn");
  }
  if (!state.config.endpoint || !state.config.contractAddress) {
    notify(root, "Network not configured — rebuild with VITE_GENLAYER_ENDPOINT / VITE_GENLAYER_CONTRACT", "err");
  }
  void restoreWalletIfApproved(root);
}

function fillDashboardDefaults(root: ParentNode): void {
  const set = (id: string, value: string): void => {
    const el = root.querySelector<HTMLInputElement>(`#${id}`);
    if (el && !el.value) el.value = value;
  };
  // Use the baked-in network (build-time env). No localhost fallback: an unconfigured
  // build leaves the fields empty and says so in the Network panel.
  set("win-start", String(DEFAULTS.windowStart));
  set("win-end", String(DEFAULTS.windowEnd));
  set("sla-amount", DEFAULTS.slaAmount);
  set("case-id", `case-${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`);
}

function networkName(endpoint: string): string {
  if (!endpoint) return "not configured";
  if (/localhost|127\.0\.0\.1/.test(endpoint)) return "localnet";
  if (/studio-dev|studio-next/.test(endpoint)) return "studio-next";
  if (/studio/.test(endpoint)) return "studionet";
  return "testnet";
}

function renderNetworkStatus(root: ParentNode): void {
  const endpoint = state.config.endpoint;
  const contract = state.config.contractAddress;
  const setText = (id: string, value: string): void => {
    const el = root.querySelector(`#${id}`);
    if (el) el.textContent = value;
  };
  setText("net-name", endpoint ? networkName(endpoint) : "not configured");
  setText("net-contract", contract ? `${contract.slice(0, 10)}…${contract.slice(-6)}` : "not deployed");
  setText("net-wallet", state.wallet ? `${state.wallet.walletName} · ${shortenAddress(state.wallet.address)}` : "not connected");
  const box = root.querySelector("#net-status");
  if (box) box.setAttribute("data-state", endpoint && contract ? "ok" : "unset");
}

function refreshNetworkStatus(root: ParentNode): void {
  renderNetworkStatus(root);
}

function bindDashboard(root: HTMLElement): void {
  $within(root, "create-btn").addEventListener("click", () => void onCreateCase(root));
  $within(root, "load-btn").addEventListener("click", () => void onLoadCase(root));
  root.querySelector("[data-evidence-submit]")?.addEventListener("click", () => void onAction(root, "submit_evidence"));

  root.querySelectorAll<HTMLButtonElement>(".actions .action").forEach((btn) => {
    btn.addEventListener("click", () => void onAction(root, btn.dataset.action ?? ""));
  });
}

async function restoreWalletIfApproved(root: ParentNode): Promise<void> {
  if (!hasWallet()) return;
  // Only runs on the dashboard — other routes have no network status.
  if (!root.querySelector("#net-status")) return;
  const wallets = detectWallets();
  if (wallets.length === 0) return;
  const address = await getConnectedAddress(wallets[0].provider);
  if (!address) return;

  const info = await connectWallet(wallets[0].provider).catch(() => null);
  if (!info) return;
  state.wallet = info;
  state.walletListenerBound = false;
  setConnState("ok", `${info.walletName} · ${shortenAddress(info.address)}`);
  updateConnectButton();
  log(root, "ok", `Reconnected: ${info.walletName} ${info.address}`);
  rebuildAdapter(root);
  prefillFromWallet(root);
  refreshNetworkStatus(root);
  bindWalletEvents(root);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const routes: Record<string, (root: HTMLElement) => void> = {
  "/": renderLanding,
  "/how": renderHow,
  "/features": renderFeatures,
  "/app": renderDashboard,
};

function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return routes[hash] ? hash : "/";
}

function renderRoute(): void {
  const route = currentRoute();
  const view = document.getElementById("view");
  if (!view) return;

  routes[route](view);

  document.querySelectorAll<HTMLAnchorElement>("#nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });

  window.scrollTo({ top: 0 });
}

async function boot(): Promise<void> {
  const connectBtn = document.getElementById("connect-btn");
  connectBtn?.addEventListener("click", () => void onConnect());

  window.addEventListener("hashchange", renderRoute);
  renderRoute();

  // Restore an already-approved wallet connection (no prompt).
  if (hasWallet()) {
    const wallets = detectWallets();
    if (wallets.length > 0) {
      const address = await getConnectedAddress(wallets[0].provider).catch(() => null);
      if (address) {
        const info = await connectWallet(wallets[0].provider).catch(() => null);
        if (info) {
          state.wallet = info;
          state.walletListenerBound = false;
          setConnState("ok", `${info.walletName} · ${shortenAddress(info.address)}`);
          updateConnectButton();
          const view = document.getElementById("view");
          // Only touch the dashboard — landing/how/features have no network status.
          if (view?.querySelector("#net-status")) {
            try {
              rebuildAdapter(view);
              prefillFromWallet(view);
              bindWalletEvents(view);
              if (state.dashboardBooted) refreshNetworkStatus(view);
            } catch (error) {
              console.warn("wallet restore:", error instanceof Error ? error.message : error);
            }
          }
        }
      }
    }
  }
}

void boot();
