// How It Works page: lifecycle timeline, consensus explainer, dispute branch.

export function renderHow(root: HTMLElement): void {
  root.innerHTML = `
  <div class="route">
    <section class="page-head wrap">
      <span class="eyebrow">How it works</span>
      <h1>How a case is <em style="color:var(--gold);font-style:italic;">decided</em></h1>
      <p>
        From opening a case to the final settlement, every step is an onchain
        transaction. The decisive step — evaluating evidence — is performed by the
        contract itself under validator consensus, not by any participant.
      </p>
    </section>

    <section class="wrap" style="padding-bottom:40px;">
      <div class="timeline">
        <div class="tl-item">
          <div class="tl-meta">Step 01 · consumer</div>
          <h3>The case is opened</h3>
          <p>
            The consumer writes the terms onchain: provider and consumer addresses,
            the service window, and the SLA shape — either a required task count
            (<code>task_completion_v1</code>) or a minimum availability permille
            (<code>availability_v1</code>). The case starts in <b>Offering</b>.
          </p>
          <span class="code">create_case(case_id, provider, consumer, …)</span>
        </div>

        <div class="tl-item">
          <div class="tl-meta">Step 02 · consumer</div>
          <h3>Escrow is locked</h3>
          <p>
            The consumer locks the payment by sending it as transaction value. The
            contract holds it; it can only leave through a decided outcome. The case
            moves to <b>EscrowLocked</b>.
          </p>
          <span class="code">lock_escrow(case_id, fee_amount, penalty_amount) + value</span>
        </div>

        <div class="tl-item">
          <div class="tl-meta">Step 03 · provider</div>
          <h3>Work starts, evidence is published</h3>
          <p>
            The provider starts execution, does the work, then publishes a structured
            evidence document at a public HTTPS URL — task completion counts and
            timestamps, or monitoring ratios — and submits the URL onchain. The case
            reaches <b>EvidenceSubmitted</b> via <b>InExecution</b>.
          </p>
          <span class="code">start_execution(case_id) → submit_evidence(case_id, url, t)</span>
        </div>

        <div class="tl-item">
          <div class="tl-meta">Step 04 · the court</div>
          <h3>The contract fetches and judges the evidence</h3>
          <p>
            This is the heart of the court. The contract renders the submitted URL
            itself, an LLM extracts the structured SLA fields, and independent
            validators must reach the exact same extraction before it is accepted.
            A deterministic predicate then decides:
          </p>
          <div class="branch">
            <h4>Satisfied → Release</h4>
            <ul>
              <li><b>task mode:</b> completed count ≥ required, every completion timestamp inside the window, all tasks successful.</li>
              <li><b>availability mode:</b> observation window inside the case window and successful / total ≥ threshold.</li>
            </ul>
          </div>
          <div class="branch">
            <h4>Breach or malformed → bounded dispute</h4>
            <ul>
              <li>Funds stay locked. No automatic penalty — a party opens a dispute and submits counter-evidence.</li>
              <li>The same predicate re-runs on the counter-evidence: satisfied → release, otherwise refund.</li>
              <li>The dispute is one bounded evaluation, not an open-ended appeal chain.</li>
            </ul>
          </div>
          <span class="code">evaluate_evidence(case_id) → Release | Failed → submit_dispute / evaluate_dispute</span>
        </div>

        <div class="tl-item">
          <div class="tl-meta">Step 05 · contract</div>
          <h3>Settlement</h3>
          <p>
            Release on satisfaction, refund through the dispute path on breach. The
            final state — <b>SettledReleased</b>, <b>SettledPenalized</b>, or
            <b>DisputeDecided</b> — is onchain and auditable by anyone.
          </p>
          <span class="code">release(case_id) / penalize(case_id) / evaluate_dispute(case_id)</span>
        </div>
      </div>

      <div class="callout">
        <h3>Why the verdict can't be gamed</h3>
        <p>
          The provider chooses <em>where</em> to publish evidence, but not <em>what it
          says</em>: the content is fetched by validators at evaluation time and must
          survive the equivalence principle — every validator independently extracts
          the same fields, or the result is rejected. The window, thresholds and
          counts were fixed when the case opened. The only way to pass is for the
          work to actually satisfy the terms.
        </p>
      </div>

      <div class="cta-band">
        <h2>Walk a real case yourself</h2>
        <p>The dashboard signs every step with your wallet against the deployed contract.</p>
        <a class="btn btn-primary btn-lg" href="#/app">Open the Court</a>
      </div>
    </section>
  </div>`;
}
