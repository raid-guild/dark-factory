import type { AgentPresence } from "@/lib/coord/types";

type Props = {
  presence: AgentPresence[];
};

export function PresenceBar({ presence }: Props) {
  return (
    <section className="presence-wrap">
      <p className="type-label-sm">AGENT PRESENCE</p>
      <div className="presence-row">
        {presence.map((item) => (
          <article key={item.agent_id} className="presence-card">
            <p className="presence-name">{item.agent_name}</p>
            <p className={`presence-status presence-${item.status}`}>{item.status}</p>
            {item.current_task_id ? <p className="presence-task">Task: {item.current_task_id}</p> : null}
            <p className="presence-heartbeat">Last beat: {new Date(item.last_heartbeat_at).toLocaleTimeString()}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
