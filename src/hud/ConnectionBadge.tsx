import type { ConnState } from "../api/live";

const LABEL: Record<ConnState, string> = {
  connecting: "Connecting…",
  open: "Live",
  reconnecting: "Reconnecting…",
  closed: "Disconnected",
};

export function ConnectionBadge({ conn, retryInMs }: { conn: ConnState; retryInMs: number | null }) {
  return (
    <span className={`conn conn-${conn}`} title={retryInMs ? `retry in ${Math.round(retryInMs / 1000)}s` : undefined}>
      <i />
      {LABEL[conn]}
    </span>
  );
}
