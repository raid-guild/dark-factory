import Link from "next/link";

export default function Home() {
  return (
    <main className="container-custom">
      <p className="type-label-sm">RAIDGUILD COORDINATION RUNTIME</p>
      <h1 className="type-display-lg">Dark Factory</h1>
      <p className="type-body-md">
        API-first multi-agent orchestration. Base path: <code>/api/v1</code>
      </p>
      <div className="home-actions">
        <Link className="button-primary" href="/runs">
          Open Workflow Board
        </Link>
        <Link className="button-secondary" href="/api/v1/workflow-runs">
          Hit API Endpoint
        </Link>
      </div>
    </main>
  );
}
