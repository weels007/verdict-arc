// Features page: capability grid + comparison table.

export function renderFeatures(root: HTMLElement): void {
  root.innerHTML = `
  <div class="route">
    <section class="page-head wrap">
      <span class="eyebrow">Features</span>
      <h1>Everything a court needs, <em style="color:var(--gold);font-style:italic;">nothing it doesn't</em></h1>
      <p>
        Each capability is a contract entrypoint or a schema rule — small enough to
        audit in one sitting, strong enough to hold real payments.
      </p>
    </section>

    <section class="wrap" style="padding-bottom:56px;">
      <div class="grid-3-up">
        <div class="card feature-card">
          <span class="num">01</span>
          <div class="icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
          <h3>Custodial-less escrow</h3>
          <p>Payment is transaction value held by the contract. There is no operator key that can move funds; settlement paths are the only exits.</p>
        </div>

        <div class="card feature-card">
          <span class="num">02</span>
          <div class="icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg></div>
          <h3>Structured evidence schema</h3>
          <p>Evidence documents are canonical JSON with a fixed field set per mode, validated by builders before publishing — the contract rejects anything it cannot parse.</p>
        </div>

        <div class="card feature-card">
          <span class="num">03</span>
          <div class="icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
          <h3>Self-fetching verification</h3>
          <p>The contract renders the evidence URL onchain via <code>gl.nondet.web.render</code>. Verification does not depend on the submitter's honesty.</p>
        </div>

        <div class="card feature-card">
          <span class="num">04</span>
          <div class="icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7l-2.8 6h5.6z"/><path d="M19 7l-2.8 6h5.6z"/><path d="M5 7h14"/></svg></div>
          <h3>Deterministic SLA predicates</h3>
          <p>Two shapes — task completion and availability — with thresholds fixed at case creation. The predicate is pure arithmetic over extracted values.</p>
        </div>

        <div class="card feature-card">
          <span class="num">05</span>
          <div class="icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/><path d="M12 7v5l3 3"/></svg></div>
          <h3>Bounded dispute resolution</h3>
          <p>One dispute, one counter-evidence URL, one re-evaluation with the same predicate. Decided outcomes only — no perpetual appeal loops.</p>
        </div>

        <div class="card feature-card">
          <span class="num">06</span>
          <div class="icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
          <h3>Wallet-native UX</h3>
          <p>MetaMask and Rabby via EIP-1193. Every write is signed in the user's own wallet; the app holds no keys and takes no custody.</p>
        </div>

        <div class="card feature-card">
          <span class="num">07</span>
          <div class="icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg></div>
          <h3>State machine integrity</h3>
          <p>Ten onchain states with guarded transitions. Funds move only from DecisionPending or a decided dispute — nothing else is a valid exit.</p>
        </div>

        <div class="card feature-card">
          <span class="num">08</span>
          <div class="icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg></div>
          <h3>Fully auditable trail</h3>
          <p>Evidence URL, extracted result, dispute outcome and last decision are all readable views on the contract — anyone can reconstruct the verdict.</p>
        </div>

        <div class="card feature-card">
          <span class="num">09</span>
          <div class="icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <h3>Built for the GenLayer stack</h3>
          <p>Standard intelligent-contract pattern: Python contract, genlayer-js client, direct-mode friendly — deployable to the local simulator or testnet.</p>
        </div>
      </div>
    </section>

    <section class="wrap" style="padding-bottom:40px;">
      <div class="section-head">
        <span class="eyebrow">Positioning</span>
        <h2>Why not just an escrow wrapper</h2>
        <p>The difference is who verifies the deliverable — and how disputes end.</p>
      </div>

      <div class="compare-wrap">
        <table class="compare">
          <thead>
            <tr>
              <th></th>
              <th class="ours">VerdictArc</th>
              <th>Typical escrow contract</th>
              <th>Manual arbitration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Who verifies the deliverable</td>
              <td class="ours yes">The contract, via consensus-fetched evidence</td>
              <td>Trusts a signed claim from the provider</td>
              <td class="no">Human reviewer</td>
            </tr>
            <tr>
              <td>Decision rule</td>
              <td class="ours yes">Deterministic predicate fixed at case creation</td>
              <td>Binary released / not released</td>
              <td class="no">Case-by-case judgment</td>
            </tr>
            <tr>
              <td>Dispute handling</td>
              <td class="ours yes">Bounded: same predicate on counter-evidence</td>
              <td>Usually none</td>
              <td class="no">Open-ended, subjective</td>
            </tr>
            <tr>
              <td>Manipulation resistance</td>
              <td class="ours yes">Validators independently agree on extracted facts</td>
              <td>Submitter-controlled payload</td>
              <td class="no">Reputational</td>
            </tr>
            <tr>
              <td>Auditability</td>
              <td class="ours yes">Evidence URL + result + decision all onchain</td>
              <td>Partial (amounts only)</td>
              <td class="no">Private records</td>
            </tr>
            <tr>
              <td>Time to verdict</td>
              <td class="ours yes">One consensus round after evidence submission</td>
              <td>Instant (but trusts claims)</td>
              <td class="no">Days to weeks</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="wrap">
      <div class="cta-band">
        <h2>Judge it yourself</h2>
        <p>The deployed contract is the demo. Connect a wallet and run a case end to end.</p>
        <a class="btn btn-primary btn-lg" href="#/app">Launch the dashboard</a>
      </div>
    </section>
  </div>`;
}
