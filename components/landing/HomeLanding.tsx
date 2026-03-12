"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const EMBER_COUNT = 15;

export default function HomeLanding() {
  const [knockCount, setKnockCount] = useState(0);
  const [pulseDoor, setPulseDoor] = useState(false);
  const [showEntrance, setShowEntrance] = useState(false);

  useEffect(() => {
    if (knockCount < 3) return;

    const timeoutId = window.setTimeout(() => setShowEntrance(true), 180);
    return () => window.clearTimeout(timeoutId);
  }, [knockCount]);

  const handleKnock = () => {
    setKnockCount((current) => Math.min(current + 1, 3));
    setPulseDoor(true);
    window.setTimeout(() => setPulseDoor(false), 420);
  };

  return (
    <main className="landing-shell">
      <div className="landing-embers" aria-hidden="true">
        {Array.from({ length: EMBER_COUNT }).map((_, index) => (
          <span
            className="landing-ember"
            key={index}
            style={
              {
                "--ember-left": `${8 + ((index * 11) % 82)}%`,
                "--ember-delay": `${(index * 0.8) % 7}s`,
                "--ember-duration": `${6 + (index % 5)}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <section className="landing-hero container-custom landing-hero-grid">
        <div className="landing-hero-copy">
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
        </div>

        <div className="landing-hero-art">
          <div className="landing-image-frame landing-image-hero">
            <Image
              src="/hero.png"
              alt="A shadowed mechanical chamber beneath a castle, lit by furnace glow."
              fill
              priority
              className="landing-image"
            />
            <div className="landing-image-caption">The machinery below has already started.</div>
          </div>
        </div>
      </section>

      <section className="landing-grid container-custom">
        <article className="landing-panel landing-panel-image">
          <div className="landing-panel-visual">
            <Image
              src="/underground.png"
              alt="Underground stoneworks leading into the factory floor."
              fill
              className="landing-image"
            />
          </div>
          <div className="landing-panel-copy">
            <p className="type-label-sm">Rumors From Below</p>
            <h2>The guild scribes speak quietly of a workshop under the stone.</h2>
            <p className="type-body-md">
              They say dwarven engines grind without rest. That specialist agents take work from unseen hands.
              That artifacts emerge before a human reviewer has even reached the table.
            </p>
          </div>
        </article>

        <article className="landing-panel landing-panel-glow landing-panel-image">
          <div className="landing-panel-visual">
            <Image
              src="/workflow.png"
              alt="Workflow machinery and ledgers arranged like a ritual control surface."
              fill
              className="landing-image"
            />
          </div>
          <div className="landing-panel-copy">
            <p className="type-label-sm">Machine Logic</p>
            <h2>Task. Agent. Artifact. Approval.</h2>
            <ol className="landing-sequence">
              <li>Runs open with context and intent.</li>
              <li>Agents claim work, report heartbeat, and hand off blockers.</li>
              <li>Artifacts accumulate without losing audit trail.</li>
              <li>Human approval still seals the outcome.</li>
            </ol>
          </div>
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

        <article className="landing-panel landing-panel-image">
          <div className="landing-panel-visual">
            <Image
              src="/agents.png"
              alt="Specialist agents represented as figures in the lower works."
              fill
              className="landing-image"
            />
          </div>
          <div className="landing-panel-copy">
            <p className="type-label-sm">Known Entrance</p>
            <h2>Prototype surfaces are already active.</h2>
            <p className="type-body-md">
              The workflow board is live as a spike, with API contracts, agent loops, and the operator shell
              already mapped.
            </p>
          </div>
        </article>
      </section>

      <section className="landing-door container-custom">
        <p className="type-label-sm">The Entrance</p>
        <h2 className="landing-door-title">Knock three times and the lower stairs will open.</h2>

        <button
          type="button"
          className={`landing-door-button${pulseDoor ? " is-pulsing" : ""}${showEntrance ? " is-open" : ""}`}
          onClick={handleKnock}
          aria-label="Knock on the stone door"
        >
          <span className="landing-door-frame">
            <Image
              src="/door.png"
              alt="A heavy stone door set with dim runes and machine glow."
              fill
              className="landing-image"
            />
            <span className="landing-door-vignette" />
            <span className="landing-door-hint">
              {knockCount === 0 ? "...knock" : knockCount === 1 ? "...louder" : knockCount === 2 ? "...the lock yields" : "...enter"}
            </span>
          </span>
        </button>

        <div className="landing-door-dots" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span key={index} className={`landing-door-dot${index < knockCount ? " is-lit" : ""}`} />
          ))}
        </div>

        <p className="landing-door-note">The command floor is not advertised. It is discovered.</p>
      </section>

      <div className={`hidden-entrance${showEntrance ? " is-visible" : ""}`} aria-live="polite">
        <div className="hidden-entrance-card">
          <div className="hidden-entrance-runes">
            <span>⚙</span>
            <span>◯</span>
            <span>△</span>
          </div>
          <p className="hidden-entrance-title">The machinery recognizes your curiosity.</p>
          <p className="hidden-entrance-copy">A narrow stairwell opens beneath the stone floor.</p>
          <Link className="button-primary hidden-entrance-link" href="/runs">
            Descend To The Runs Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
