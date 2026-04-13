"use client";

export type StreamTraceStage =
  | "stream_start"
  | "sse_chunk"
  | "anim_emit"
  | "store_onUpdate"
  | "segment_update_start"
  | "segment_update_done"
  | "optimizer_enqueue"
  | "optimizer_flush"
  | "store_batch_apply_start"
  | "store_batch_apply_done"
  | "assistant_render_commit"
  | "markdown_render_commit"
  | "paint_approx"
  | "stream_finish";

export type StreamTraceUpdateMeta = {
  traceId: string;
  sessionId?: string;
  messageId: string;
  seq: number;
  emittedAt: number;
  contentLength: number;
  chunkLength: number;
  remainLength: number;
  model?: string;
  source?: string;
};

export type StreamTraceStartInfo = {
  traceId: string;
  sessionId?: string;
  messageId: string;
  model?: string;
  source?: string;
};

export type StreamTraceEvent = {
  id: number;
  traceId: string;
  stage: StreamTraceStage;
  ts: number;
  relTs: number;
  seq?: number;
  sessionId?: string;
  messageId?: string;
  model?: string;
  source?: string;
  contentLength?: number;
  chunkLength?: number;
  remainLength?: number;
  note?: string;
};

type TraceTransitionName =
  | "anim_emit -> store_onUpdate"
  | "store_onUpdate -> segment_update_done"
  | "segment_update_done -> optimizer_enqueue"
  | "optimizer_enqueue -> optimizer_flush"
  | "optimizer_flush -> store_batch_apply_done"
  | "store_batch_apply_done -> assistant_render_commit"
  | "assistant_render_commit -> markdown_render_commit"
  | "markdown_render_commit -> paint_approx"
  | "anim_emit -> paint_approx";

type TraceTransitionSummary = {
  transition: TraceTransitionName;
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

type StreamTraceSummary = {
  traceId: string;
  eventCount: number;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  transitions: TraceTransitionSummary[];
};

type StreamTraceApi = {
  enable: () => void;
  disable: () => void;
  clear: () => void;
  isEnabled: () => boolean;
  events: (traceId?: string) => StreamTraceEvent[];
  latestMeta: (messageId: string) => StreamTraceUpdateMeta | undefined;
  summary: (traceId?: string) => StreamTraceSummary | StreamTraceSummary[];
  exportJSON: (traceId?: string) => string;
  printSummary: (traceId?: string) => void;
};

const TRACE_STORAGE_KEY = "qadchat:stream-trace:enabled";
const TRACE_QUERY_KEY = "__streamTrace";
const MAX_TRACE_EVENTS = 12000;

const traceStarts = new Map<string, number>();
const traceInfos = new Map<string, StreamTraceStartInfo>();
const traceFinishedAt = new Map<string, number>();
const latestMetaByMessageId = new Map<string, StreamTraceUpdateMeta>();
const traceEvents: StreamTraceEvent[] = [];
const dedupeKeys = new Set<string>();

let globalEventId = 0;

function canUseDOM() {
  return typeof window !== "undefined";
}

function now() {
  if (canUseDOM() && typeof window.performance?.now === "function") {
    return window.performance.now();
  }
  return Date.now();
}

function readLocalEnabled() {
  if (!canUseDOM()) return false;

  try {
    if (window.__QADCHAT_STREAM_TRACE_ENABLED__) {
      return true;
    }

    if (window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      if (params.get(TRACE_QUERY_KEY) === "1") {
        return true;
      }
    }

    return window.localStorage.getItem(TRACE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function installGlobalApi() {
  if (!canUseDOM() || window.__QADCHAT_STREAM_TRACE__) return;

  window.__QADCHAT_STREAM_TRACE__ = {
    enable() {
      setStreamTraceEnabled(true);
    },
    disable() {
      setStreamTraceEnabled(false);
    },
    clear() {
      clearStreamTraceData();
    },
    isEnabled() {
      return isStreamTraceEnabled();
    },
    events(traceId?: string) {
      return getStreamTraceEvents(traceId);
    },
    latestMeta(messageId: string) {
      return getLatestMessageTrace(messageId);
    },
    summary(traceId?: string) {
      return traceId
        ? summarizeTrace(traceId)
        : Array.from(traceStarts.keys()).map((id) => summarizeTrace(id));
    },
    exportJSON(traceId?: string) {
      return exportStreamTraceJSON(traceId);
    },
    printSummary(traceId?: string) {
      printStreamTraceSummary(traceId);
    },
  };
}

if (canUseDOM()) {
  installGlobalApi();
}

export function createStreamTraceId(sessionId: string, messageId: string) {
  return `${sessionId}:${messageId}`;
}

export function isStreamTraceEnabled() {
  installGlobalApi();
  return readLocalEnabled();
}

export function setStreamTraceEnabled(enabled: boolean) {
  if (!canUseDOM()) return;

  installGlobalApi();
  window.__QADCHAT_STREAM_TRACE_ENABLED__ = enabled;

  try {
    if (enabled) {
      window.localStorage.setItem(TRACE_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(TRACE_STORAGE_KEY);
    }
  } catch {}
}

export function clearStreamTraceData() {
  traceEvents.length = 0;
  traceStarts.clear();
  traceInfos.clear();
  traceFinishedAt.clear();
  latestMetaByMessageId.clear();
  dedupeKeys.clear();
  globalEventId = 0;
}

export function startStreamTrace(info: StreamTraceStartInfo) {
  if (!isStreamTraceEnabled()) return;

  installGlobalApi();

  if (!traceStarts.has(info.traceId)) {
    const startedAt = now();
    traceStarts.set(info.traceId, startedAt);
    traceInfos.set(info.traceId, info);
    pushTraceEvent({
      traceId: info.traceId,
      stage: "stream_start",
      ts: startedAt,
      sessionId: info.sessionId,
      messageId: info.messageId,
      model: info.model,
      source: info.source,
      note: "trace initialized",
    });
  }
}

export function finishStreamTrace(
  traceId: string,
  payload?: Partial<StreamTraceEvent>,
) {
  if (!isStreamTraceEnabled()) return;

  const finishedAt = now();
  traceFinishedAt.set(traceId, finishedAt);

  pushTraceEvent({
    traceId,
    stage: "stream_finish",
    ts: finishedAt,
    ...payload,
  });

  printStreamTraceSummary(traceId);
}

export function recordStreamTraceStage(
  stage: StreamTraceStage,
  payload: Omit<Partial<StreamTraceEvent>, "stage" | "ts" | "relTs"> & {
    traceId: string;
  },
) {
  if (!isStreamTraceEnabled()) return;

  pushTraceEvent({
    ...payload,
    stage,
    ts: now(),
  });
}

export function setLatestMessageTrace(meta: StreamTraceUpdateMeta) {
  if (!isStreamTraceEnabled()) return;

  latestMetaByMessageId.set(meta.messageId, meta);
}

export function getLatestMessageTrace(messageId: string) {
  return latestMetaByMessageId.get(messageId);
}

export function getStreamTraceEvents(traceId?: string) {
  if (!traceId) {
    return [...traceEvents];
  }

  return traceEvents.filter((event) => event.traceId === traceId);
}

export function exportStreamTraceJSON(traceId?: string) {
  const data = traceId
    ? {
        traceId,
        summary: summarizeTrace(traceId),
        events: getStreamTraceEvents(traceId),
      }
    : {
        traces: Array.from(traceStarts.keys()).map((id) => summarizeTrace(id)),
        events: getStreamTraceEvents(),
      };

  return JSON.stringify(data, null, 2);
}

export function printStreamTraceSummary(traceId?: string) {
  if (!isStreamTraceEnabled()) return;

  if (traceId) {
    const summary = summarizeTrace(traceId);
    const events = getStreamTraceEvents(traceId);
    console.groupCollapsed(
      `[StreamTrace] ${traceId} events=${
        summary.eventCount
      } duration=${formatMs(summary.durationMs)}`,
    );
    console.table(summary.transitions);
    console.table(events.slice(-20));
    console.groupEnd();
    return;
  }

  const summaries = Array.from(traceStarts.keys()).map((id) =>
    summarizeTrace(id),
  );
  console.table(
    summaries.map((item) => ({
      traceId: item.traceId,
      eventCount: item.eventCount,
      durationMs: round(item.durationMs),
    })),
  );
}

function pushTraceEvent(
  event: Omit<StreamTraceEvent, "id" | "relTs"> & { ts: number },
) {
  const dedupeKey =
    typeof event.seq === "number" && event.messageId
      ? `${event.traceId}:${event.stage}:${event.messageId}:${event.seq}`
      : null;

  if (dedupeKey) {
    if (dedupeKeys.has(dedupeKey)) return;
    dedupeKeys.add(dedupeKey);
  }

  const startedAt = traceStarts.get(event.traceId) ?? event.ts;
  const traceEvent: StreamTraceEvent = {
    id: ++globalEventId,
    relTs: round(event.ts - startedAt),
    ...event,
  };

  traceEvents.push(traceEvent);
  trimTraceEvents();
}

function trimTraceEvents() {
  if (traceEvents.length <= MAX_TRACE_EVENTS) return;

  const overflow = traceEvents.length - MAX_TRACE_EVENTS;
  const removed = traceEvents.splice(0, overflow);
  const removedTraceIds = new Set(removed.map((event) => event.traceId));

  for (const traceId of removedTraceIds) {
    if (!traceEvents.some((event) => event.traceId === traceId)) {
      traceStarts.delete(traceId);
      traceInfos.delete(traceId);
      traceFinishedAt.delete(traceId);
    }
  }

  if (dedupeKeys.size > MAX_TRACE_EVENTS * 2) {
    dedupeKeys.clear();
    for (const event of traceEvents) {
      if (typeof event.seq !== "number" || !event.messageId) continue;
      dedupeKeys.add(
        `${event.traceId}:${event.stage}:${event.messageId}:${event.seq}`,
      );
    }
  }
}

function summarizeTrace(traceId: string): StreamTraceSummary {
  const events = getStreamTraceEvents(traceId).sort((a, b) => a.ts - b.ts);
  const startedAt = traceStarts.get(traceId) ?? events[0]?.ts ?? now();
  const finishedAt = traceFinishedAt.get(traceId);

  return {
    traceId,
    eventCount: events.length,
    startedAt: round(startedAt),
    finishedAt: finishedAt ? round(finishedAt) : undefined,
    durationMs:
      finishedAt && startedAt
        ? round(Math.max(0, finishedAt - startedAt))
        : undefined,
    transitions: buildTransitionSummaries(events),
  };
}

function buildTransitionSummaries(events: StreamTraceEvent[]) {
  const bySeq = new Map<number, Map<StreamTraceStage, StreamTraceEvent>>();

  for (const event of events) {
    if (typeof event.seq !== "number") continue;
    let seqMap = bySeq.get(event.seq);
    if (!seqMap) {
      seqMap = new Map();
      bySeq.set(event.seq, seqMap);
    }

    if (!seqMap.has(event.stage)) {
      seqMap.set(event.stage, event);
    }
  }

  const transitions: Array<{
    name: TraceTransitionName;
    from: StreamTraceStage;
    to: StreamTraceStage;
  }> = [
    {
      name: "anim_emit -> store_onUpdate",
      from: "anim_emit",
      to: "store_onUpdate",
    },
    {
      name: "store_onUpdate -> segment_update_done",
      from: "store_onUpdate",
      to: "segment_update_done",
    },
    {
      name: "segment_update_done -> optimizer_enqueue",
      from: "segment_update_done",
      to: "optimizer_enqueue",
    },
    {
      name: "optimizer_enqueue -> optimizer_flush",
      from: "optimizer_enqueue",
      to: "optimizer_flush",
    },
    {
      name: "optimizer_flush -> store_batch_apply_done",
      from: "optimizer_flush",
      to: "store_batch_apply_done",
    },
    {
      name: "store_batch_apply_done -> assistant_render_commit",
      from: "store_batch_apply_done",
      to: "assistant_render_commit",
    },
    {
      name: "assistant_render_commit -> markdown_render_commit",
      from: "assistant_render_commit",
      to: "markdown_render_commit",
    },
    {
      name: "markdown_render_commit -> paint_approx",
      from: "markdown_render_commit",
      to: "paint_approx",
    },
    {
      name: "anim_emit -> paint_approx",
      from: "anim_emit",
      to: "paint_approx",
    },
  ];

  return transitions.map(({ name, from, to }) => {
    const deltas: number[] = [];

    for (const [, seqMap] of bySeq) {
      const fromEvent = seqMap.get(from);
      const toEvent = seqMap.get(to);
      if (!fromEvent || !toEvent || toEvent.ts < fromEvent.ts) continue;
      deltas.push(toEvent.ts - fromEvent.ts);
    }

    deltas.sort((a, b) => a - b);

    return {
      transition: name,
      count: deltas.length,
      avgMs: round(average(deltas)),
      p50Ms: round(percentile(deltas, 0.5)),
      p95Ms: round(percentile(deltas, 0.95)),
      maxMs: round(deltas[deltas.length - 1]),
    };
  });
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * ratio) - 1),
  );
  return values[index];
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Number(value.toFixed(2));
}

function formatMs(value?: number) {
  return `${round(value)}ms`;
}
