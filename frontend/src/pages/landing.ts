// Landing page: hero, flow, pillars, stats, CTA.

export function renderLanding(root: HTMLElement): void {
  root.innerHTML = `
  <div class="route">
    <section class="hero wrap">
      <span class="eyebrow">Built on GenLayer Intelligent Contracts</span>
      <h1>Verdicts that <em>arc</em> from evidence,<br />not from opinions.</h1>
      <p class="sub">
        VerdictArc holds payment until the contract itself fetches the evidence,
        extracts the SLA result under validator consensus, and decides — release,
        refund, or dispute. Same rules for every agent, every time.
      </p>
      <div class="hero-cta">
        <a class="btn btn-primary btn-lg" href="#/app">Open the Court</a>
        <a class="btn btn-ghost btn-lg" href="#/how">See how a case is decided</a>
      </div>
      <div class="hero-meta">
        <span><i></i>no mock data path</span>
        <span><i></i>evidence fetched onchain</span>
        <span><i></i>wallet-signed writes</span>
        <span><i></i>bounded, auditable disputes</span>
      </div>
    </section>

    <div class="strip" aria-hidden="true">
      <div class="strip-inner">
        <span>create_case</span><b>·</b><span>lock_escrow</span><b>·</b><span>submit_evidence</span><b>·</b><span>validator consensus</span><b>·</b><span>release / refund / dispute</span><b>·</b>
        <span>create_case</span><b>·</b><span>lock_escrow</span><b>·</b><span>submit_evidence</span><b>·</b><span>validator consensus</span><b>·</b><span>release / refund / dispute</span><b>·</b>
      </div>
    </div>

    <section class="section wrap">
      <div class="section-head">
        <span class="eyebrow">The flow</span>
        <h2>One case, five onchain steps</h2>
        <p>Every step is a real transaction against the deployed intelligent contract. Nothing is simulated — the court only knows what the chain tells it.</p>
      </div>

      <div class="flow">
        <div class="flow-step">
          <h4>Case opened</h4>
          <p>Terms written onchain: parties, service window, required tasks or availability threshold.</p>
          <span class="who">consumer</span>
        </div>
        <div class="flow-step">
          <h4>Escrow locked</h4>
          <p>Payment held by the contract as transaction value. Nobody can move it outside the rules.</p>
          <span class="who">consumer</span>
        </div>
        <div class="flow-step">
          <h4>Evidence published</h4>
          <p>Provider publishes a structured evidence document at a public URL and submits the link.</p>
          <span class="who">provider</span>
        </div>
        <div class="flow-step key">
          <h4>The court decides</h4>
          <p>Validators fetch the URL, extract the SLA result with an LLM, and agree on the same outcome.</p>
          <span class="who">consensus</span>
        </div>
        <div class="flow-step">
          <h4>Settlement</h4>
          <p>Release on satisfaction. Breach or malformed evidence enters a bounded dispute with counter-evidence.</p>
          <span class="who">contract</span>
        </div>
      </div>
    </section>

    <section class="section wrap">
      <div class="section-head">
        <span class="eyebrow">Why it holds</span>
        <h2>Justice by construction, not by reputation</h2>
        <p>The three properties that make the verdict trustworthy are built into the contract itself.</p>
      </div>

      <div class="grid-3-up">
        <div class="card">
          <div class="icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h3>The contract verifies reality</h3>
          <p>Evidence is fetched by <code>gl.nondet.web.render</code> from the URL onchain. No party submits a payload and claims it as truth — the court reads the source itself.</p>
          <span class="code-tag">gl.nondet.web.render</span>
        </div>
        <div class="card">
          <div class="icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h3>Validators agree on the facts</h3>
          <p>Extraction runs under <code>gl.eq_principle.strict_eq</code>: independent validators must reach the identical SLA result before it counts.</p>
          <span class="code-tag">gl.eq_principle.strict_eq</span>
        </div>
        <div class="card">
          <div class="icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>
          </div>
          <h3>Same predicate for both sides</h3>
          <p>Disputes re-run the exact same deterministic SLA check on counter-evidence. No free-form appeals, no admin opinion, no exceptions.</p>
          <span class="code-tag">evaluate_dispute</span>
        </div>
      </div>
    </section>

    <section class="section wrap">
      <div class="stats-band">
        <div class="stat"><b>2</b><span>SLA predicates — task completion &amp; availability</span></div>
        <div class="stat"><b>10</b><span>onchain states in the case state machine</span></div>
        <div class="stat"><b>0</b><span>mock data paths — real chain or nothing</span></div>
        <div class="stat"><b>1</b><span>predicate applied equally to evidence and counter-evidence</span></div>
      </div>
    </section>

    <section class="wrap">
      <div class="cta-band">
        <h2>Try a case in front of the court</h2>
        <p>Connect MetaMask or Rabby, open a case against the deployed contract, and watch the validators decide it from live evidence.</p>
        <a class="btn btn-primary btn-lg" href="#/app">Launch the dashboard</a>
      </div>
    </section>
  </div>`;
}
