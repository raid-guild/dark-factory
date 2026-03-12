import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-shell">
      <div className="landing-embers" aria-hidden="true">
        {Array.from({ length: 15 }).map((_, index) => (
          <span
            className="landing-ember"
            key={index}
            style={
              {
                "--ember-left": `${8 + ((index * 11) % 82)}%`,
                "--ember-delay": `${(index * 0.8) % 7}s`,
                "--ember-duration": `${6 + (index % 5)}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <section className="landing-hero container-custom">
        <p className="type-label-sm">RAIDGUILD CASTLE // LOWER WORKS</p>
        <h1 className="landing-title">The Dark Factory</h1>
        <p className="landing-lead">
          Beneath the Raid Guild castle, strange machinery turns. Agents move unseen, tasks appear on iron
          ledgers, and drafts rise from the dark before the wax has cooled.
        </p>
        <div className="home-actions">
          <Link className="button-primary" href="/runs">
            Enter The Command Floor
          </Link>
          <Link className="button-secondary" href="/api/v1/workflow-runs">
            Inspect The API
          </Link>
        </div>
      </section>

      <section className="landing-grid container-custom">
        <article className="landing-panel">
          <p className="type-label-sm">Rumors From Below</p>
          <h2>The guild scribes speak quietly of a workshop under the stone.</h2>
          <p className="type-body-md">
            They say dwarven engines grind without rest. That specialist agents take work from unseen hands.
            That artifacts emerge before a human reviewer has even reached the table.
          </p>
        </article>

        <article className="landing-panel landing-panel-glow">
          <p className="type-label-sm">Machine Logic</p>
          <h2>Task. Agent. Artifact. Approval.</h2>
          <ol className="landing-sequence">
            <li>Runs open with context and intent.</li>
            <li>Agents claim work, report heartbeat, and hand off blockers.</li>
            <li>Artifacts accumulate without losing audit trail.</li>
            <li>Human approval still seals the outcome.</li>
          </ol>
        </article>
      </section>

      <section className="landing-grid container-custom">
        <article className="landing-panel landing-panel-wide">
          <p className="type-label-sm">Control Plane</p>
          <h2>Dark Factory coordinates the run. It does not pretend to be the work itself.</h2>
          <p className="type-body-md">
            Task state, workflow runs, approvals, handoffs, and operator visibility belong here. Durable
            discussion and file reservations live elsewhere. The control plane stays narrow enough to trust.
          </p>
        </article>

        <article className="landing-panel">
          <p className="type-label-sm">Known Entrance</p>
          <h2>Prototype surfaces are already active.</h2>
          <p className="type-body-md">
            The workflow board is live as a spike, with API contracts, mock run views, and the first operator
            shell already mapped.
          </p>
          <Link className="text-link" href="/runs">
            Open current run board
          </Link>
        </article>
      </section>
    </main>
  );
}
