/**
 * client.ts — Talking to the LastMile controller.
 *
 * Everything crossing this boundary is treated as untrusted: responses are
 * shape-checked before use rather than cast, because a controller on a
 * different version returning a slightly different payload should degrade to
 * the demo simulation rather than render NaN across the dashboard.
 */
import type {
  ControllerEvent,
  ControllerStatus,
  PolicyClass,
  TopologyPayload,
} from './types';

export const DEFAULT_CONTROLLER_URL = 'http://127.0.0.1:8080';

/** How long to wait for /health before deciding the controller is absent. */
const HEALTH_TIMEOUT_MS = 2500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate a status payload. Returns null rather than throwing, so a bad
 * frame degrades into "keep the previous snapshot" instead of unmounting the
 * dashboard.
 */
export function parseStatus(raw: unknown): ControllerStatus | null {
  if (!isRecord(raw)) return null;
  if (!isFiniteNumber(raw.networkLoad)) return null;
  if (!Array.isArray(raw.queues)) return null;
  if (!Array.isArray(raw.connectedSwitches)) return null;

  const queues = raw.queues.filter(
    (q): q is ControllerStatus['queues'][number] =>
      isRecord(q) && typeof q.priority === 'string' && isFiniteNumber(q.txBytes),
  );

  return {
    version: typeof raw.version === 'string' ? raw.version : '0',
    timestamp: isFiniteNumber(raw.timestamp) ? raw.timestamp : Date.now() / 1000,
    source: 'controller',
    qosActive: raw.qosActive === true,
    connectedSwitches: raw.connectedSwitches.filter(isFiniteNumber),
    expectedSwitches: Array.isArray(raw.expectedSwitches)
      ? raw.expectedSwitches.filter(isFiniteNumber)
      : [],
    // Clamped: a controller reporting 130% would otherwise overflow the gauge.
    networkLoad: Math.max(0, Math.min(100, raw.networkLoad)),
    queues,
    observedShares: isRecord(raw.observedShares)
      ? (raw.observedShares as Record<string, number>)
      : {},
  };
}

export function parseEvent(raw: unknown): ControllerEvent | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.label !== 'string') return null;

  return {
    version: typeof raw.version === 'string' ? raw.version : '0',
    timestamp: isFiniteNumber(raw.timestamp) ? raw.timestamp : Date.now() / 1000,
    seq: isFiniteNumber(raw.seq) ? raw.seq : 0,
    kind: typeof raw.kind === 'string' ? raw.kind : 'infra',
    priority: typeof raw.priority === 'string'
      ? (raw.priority as ControllerEvent['priority'])
      : null,
    label: raw.label,
  };
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.json();
}

/**
 * Is a controller reachable at this base URL?
 *
 * Deliberately short-fused: this runs on page load to decide whether live
 * mode is even possible, and a slow negative answer would stall the whole
 * dashboard behind a request that was always going to fail.
 */
export async function probeController(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const payload = await getJson(`${baseUrl}/lastmile/health`, controller.signal);
    return isRecord(payload) && payload.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPolicy(baseUrl: string): Promise<PolicyClass[]> {
  const payload = await getJson(`${baseUrl}/lastmile/policy`);
  if (!isRecord(payload) || !Array.isArray(payload.classes)) return [];
  return payload.classes as PolicyClass[];
}

export async function fetchTopology(baseUrl: string): Promise<TopologyPayload | null> {
  const payload = await getJson(`${baseUrl}/lastmile/topology`);
  if (!isRecord(payload) || !Array.isArray(payload.departments)) return null;
  return payload as unknown as TopologyPayload;
}

export interface StreamHandlers {
  onStatus: (status: ControllerStatus) => void;
  onEvent: (event: ControllerEvent) => void;
  onError: () => void;
}

/**
 * Subscribe to the controller's server-sent event stream.
 *
 * SSE rather than WebSockets: the flow is strictly one-way, the browser
 * reconnects on its own, and it is plain HTTP with no upgrade handshake to
 * negotiate through a lab proxy.
 *
 * Returns an unsubscribe function.
 */
export function subscribe(baseUrl: string, handlers: StreamHandlers): () => void {
  const source = new EventSource(`${baseUrl}/lastmile/events`);

  const handle = <T,>(parse: (raw: unknown) => T | null, sink: (value: T) => void) =>
    (message: MessageEvent) => {
      try {
        const parsed = parse(JSON.parse(message.data));
        if (parsed) sink(parsed);
      } catch {
        // A single malformed frame is not a reason to tear down the stream.
      }
    };

  source.addEventListener('status', handle(parseStatus, handlers.onStatus));
  source.addEventListener('log', handle(parseEvent, handlers.onEvent));
  source.onerror = () => handlers.onError();

  return () => source.close();
}

/**
 * Resolve the requested data source from the URL.
 *
 *   ?mode=live                     connect to the default controller
 *   ?controller=http://host:8080   connect to a specific one
 *   anything else                  browser simulation
 *
 * Demo is the default because the deployed build has no backend, and a
 * portfolio link that spends its first seconds failing to reach 127.0.0.1 is
 * worse than one that simply runs.
 */
export function resolveDataSource(search: string): { mode: 'demo' | 'live'; url: string } {
  const params = new URLSearchParams(search);
  const explicitUrl = params.get('controller');
  const mode = params.get('mode');

  if (explicitUrl) {
    return { mode: 'live', url: explicitUrl.replace(/\/$/, '') };
  }
  if (mode === 'live') {
    return { mode: 'live', url: DEFAULT_CONTROLLER_URL };
  }
  return { mode: 'demo', url: DEFAULT_CONTROLLER_URL };
}
