import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  Activity,
  Ban,
  Circle,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
  Terminal,
  X
} from "lucide-react";
import { createDesktopApi } from "./bridgeApi";
import type {
  DesktopActionResponse,
  DesktopEventLogEntry,
  DesktopSessionCard,
  DesktopStateResponse,
  SessionCardStatus
} from "../../shared/protocol";

type ActivePane = "sessions" | "settings";

const desktopApi = createDesktopApi();

export function App(): ReactElement {
  const [state, setState] = useState<DesktopStateResponse | undefined>();
  const [activePane, setActivePane] = useState<ActivePane>("sessions");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionCardId, setActionCardId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setState(await desktopApi.getState());
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const runAction = useCallback(
    async (
      cardId: string | undefined,
      action: () => Promise<DesktopActionResponse>
    ) => {
      setActionCardId(cardId);
      try {
        const response = await action();
        setState(response.state);
        setError(undefined);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setActionCardId(undefined);
      }
    },
    []
  );

  const counts = useMemo(() => summarizeCards(state?.cards ?? []), [state]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1>Perpetual Context Protection</h1>
            <p>{state ? formatGeneratedAt(state.generatedAt) : "Bridge state pending"}</p>
          </div>
        </div>

        <nav className="pane-tabs" aria-label="Desktop panes">
          <button
            className={activePane === "sessions" ? "active" : ""}
            type="button"
            onClick={() => setActivePane("sessions")}
          >
            <Terminal size={17} />
            Sessions
          </button>
          <button
            className={activePane === "settings" ? "active" : ""}
            type="button"
            onClick={() => setActivePane("settings")}
          >
            <Settings size={17} />
            Settings
          </button>
        </nav>

        <div className="topbar-actions">
          <StatusPill
            label={state?.connection.bridgeOnline ? "Bridge online" : "Bridge offline"}
            tone={state?.connection.bridgeOnline ? "good" : "danger"}
          />
          <button
            className="icon-button"
            type="button"
            title="Refresh"
            aria-label="Refresh"
            disabled={isRefreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw size={18} className={isRefreshing ? "spin" : ""} />
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="session-zone" aria-label="Session cards">
          <div className="metrics-row">
            <Metric label="Windows" value={state?.connection.heartbeatCount ?? 0} />
            <Metric label="Sessions" value={state?.connection.sessionCount ?? 0} />
            <Metric label="Managed" value={counts.managed} />
            <Metric label="Armed" value={counts.armed} />
            <Metric label="Candidates" value={counts.candidate} />
          </div>

          {error ? (
            <div className="error-strip" role="status">
              <Ban size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          {activePane === "sessions" ? (
            <SessionsPane
              cards={state?.cards ?? []}
              busyCardId={actionCardId}
              onArm={(cardId) =>
                void runAction(cardId, () => desktopApi.armCard(cardId))
              }
              onPause={(cardId) =>
                void runAction(cardId, () => desktopApi.pauseCard(cardId))
              }
              onDismiss={(cardId) =>
                void runAction(cardId, () => desktopApi.dismissCard(cardId))
              }
              onArmAll={() => void runAction(undefined, () => desktopApi.armAll())}
            />
          ) : (
            <SettingsPane state={state} />
          )}
        </section>

        <aside className="event-zone" aria-label="Event log">
          <div className="section-heading">
            <div>
              <h2>Event Log</h2>
              <p>{state?.events.length ?? 0} entries</p>
            </div>
            <Activity size={19} />
          </div>
          <EventLog events={state?.events ?? []} />
        </aside>
      </main>
    </div>
  );
}

function SessionsPane(props: {
  cards: DesktopSessionCard[];
  busyCardId: string | undefined;
  onArm: (cardId: string) => void;
  onPause: (cardId: string) => void;
  onDismiss: (cardId: string) => void;
  onArmAll: () => void;
}): ReactElement {
  const armableCount = props.cards.filter((card) => card.canArmAll).length;

  return (
    <div className="pane-content">
      <div className="session-toolbar">
        <div>
          <h2>Session Cards</h2>
          <p>{armableCount} managed eligible</p>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={armableCount === 0}
          onClick={props.onArmAll}
        >
          <Play size={17} />
          Arm All
        </button>
      </div>

      {props.cards.length === 0 ? (
        <div className="empty-state">
          <Radio size={24} />
          <span>No VS Code heartbeats yet</span>
        </div>
      ) : (
        <div className="card-grid">
          {props.cards.map((card) => (
            <SessionCard
              key={card.id}
              card={card}
              isBusy={props.busyCardId === card.id}
              onArm={() => props.onArm(card.id)}
              onPause={() => props.onPause(card.id)}
              onDismiss={() => props.onDismiss(card.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard(props: {
  card: DesktopSessionCard;
  isBusy: boolean;
  onArm: () => void;
  onPause: () => void;
  onDismiss: () => void;
}): ReactElement {
  const card = props.card;

  return (
    <article className={`session-card observability-${card.observability}`}>
      <div className="card-main">
        <div className="card-title-row">
          <div className="agent-lockup">
            <div className="agent-icon" aria-hidden="true">
              <Terminal size={18} />
            </div>
            <div>
              <h3>{card.workspaceName}</h3>
              <p>{card.agentLabel}</p>
            </div>
          </div>
          <StatusDot status={card.status} />
        </div>

        <div className="card-facts">
          <Fact label="Observability" value={card.observability} />
          <Fact label="Status" value={card.status} />
          <Fact label="Chunks" value={String(card.chunkCount)} />
        </div>

        <p className="last-event">{card.lastEvent}</p>
        <p className="reason">{card.reason}</p>
      </div>

      <div className="card-actions">
        <button
          className="icon-button"
          type="button"
          title="Arm"
          aria-label={`Arm ${card.workspaceName}`}
          disabled={!card.canArm || props.isBusy}
          onClick={props.onArm}
        >
          <Play size={17} />
        </button>
        <button
          className="icon-button"
          type="button"
          title="Pause"
          aria-label={`Pause ${card.workspaceName}`}
          disabled={props.isBusy}
          onClick={props.onPause}
        >
          <Pause size={17} />
        </button>
        <button
          className="icon-button danger"
          type="button"
          title="Dismiss"
          aria-label={`Dismiss ${card.workspaceName}`}
          disabled={props.isBusy}
          onClick={props.onDismiss}
        >
          <X size={17} />
        </button>
      </div>
    </article>
  );
}

function SettingsPane(props: {
  state: DesktopStateResponse | undefined;
}): ReactElement {
  return (
    <div className="settings-pane">
      <div className="section-heading">
        <div>
          <h2>Profiles</h2>
          <p>{props.state?.profiles.length ?? 0} loaded</p>
        </div>
      </div>

      <div className="profile-list">
        {(props.state?.profiles ?? []).map((profile) => (
          <div className="profile-row" key={profile.id}>
            <div>
              <strong>{profile.displayName}</strong>
              <span>{profile.id}</span>
            </div>
            <code>{profile.compactCommand}</code>
          </div>
        ))}
      </div>

      <div className="settings-grid">
        <Fact label="Protocol" value={String(props.state?.protocolVersion ?? 1)} />
        <Fact
          label="Last heartbeat"
          value={
            props.state?.connection.lastHeartbeatAt
              ? formatTime(props.state.connection.lastHeartbeatAt)
              : "none"
          }
        />
      </div>
    </div>
  );
}

function EventLog(props: { events: DesktopEventLogEntry[] }): ReactElement {
  const events = [...props.events].reverse();

  if (events.length === 0) {
    return (
      <div className="empty-log">
        <Circle size={18} />
        <span>No events recorded</span>
      </div>
    );
  }

  return (
    <ol className="event-log">
      {events.map((event) => (
        <li key={event.id}>
          <time>{formatTime(event.timestamp)}</time>
          <span>{event.message}</span>
        </li>
      ))}
    </ol>
  );
}

function Metric(props: { label: string; value: number }): ReactElement {
  return (
    <div className="metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function Fact(props: { label: string; value: string }): ReactElement {
  return (
    <div className="fact">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function StatusPill(props: {
  label: string;
  tone: "good" | "danger" | "neutral";
}): ReactElement {
  return <span className={`status-pill ${props.tone}`}>{props.label}</span>;
}

function StatusDot(props: { status: SessionCardStatus }): ReactElement {
  return (
    <span className={`status-dot status-${props.status}`} title={props.status}>
      <Circle size={12} fill="currentColor" />
    </span>
  );
}

function summarizeCards(cards: DesktopSessionCard[]): {
  managed: number;
  armed: number;
  candidate: number;
} {
  return cards.reduce(
    (summary, card) => ({
      managed: summary.managed + (card.observability === "managed" ? 1 : 0),
      armed: summary.armed + (card.automationState === "armed" ? 1 : 0),
      candidate:
        summary.candidate + (card.observability === "candidate" ? 1 : 0)
    }),
    { managed: 0, armed: 0, candidate: 0 }
  );
}

function formatGeneratedAt(timestamp: string): string {
  return `Updated ${formatTime(timestamp)}`;
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
}
