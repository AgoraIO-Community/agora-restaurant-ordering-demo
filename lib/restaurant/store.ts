import { createHash, randomBytes } from 'node:crypto';
import type { RestaurantState } from './types';

type Scope = 'read' | 'tool';

interface RestaurantSession {
  agentId?: string;
  data: RestaurantState;
}

interface Access {
  scope: Scope;
  expiresAt: number;
  session: RestaurantSession;
}

// Keep route bundles in this Next.js process on the same state.
const runtime = globalThis as typeof globalThis & {
  restaurantDemoStore?: {
    access: Map<string, Access>;
    bookedTables: Map<string, Set<string>>;
  };
};
const store = runtime.restaurantDemoStore ??= { access: new Map(), bookedTables: new Map() };

function digest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createRestaurantSession() {
  const now = Date.now();
  for (const [key, access] of store.access) {
    if (access.expiresAt <= now) store.access.delete(key);
  }

  const session: RestaurantSession = {
    data: { revision: 0, cart: [], tableOptions: [], orders: [], reservations: [] },
  };
  const toolToken = randomBytes(32).toString('hex');
  const readToken = randomBytes(32).toString('hex');
  store.access.set(digest(toolToken), { scope: 'tool', expiresAt: now + 12 * 60_000, session });
  store.access.set(digest(readToken), { scope: 'read', expiresAt: now + 60 * 60_000, session });
  return { toolToken, readToken };
}

export function revokeRestaurantTools(toolToken: string) {
  const key = digest(toolToken);
  if (store.access.get(key)?.scope === 'tool') store.access.delete(key);
}

export function bindRestaurantAgent(toolToken: string, agentId: string) {
  const session = sessionForToken(toolToken, 'tool');
  if (session) session.agentId = agentId;
}

export function revokeRestaurantToolsForAgent(agentId: string) {
  for (const [key, access] of store.access) {
    if (access.scope === 'tool' && access.session.agentId === agentId) store.access.delete(key);
  }
}

export function sessionForToken(token: string, scope: Scope) {
  const access = store.access.get(digest(token));
  return access?.scope === scope && access.expiresAt > Date.now() ? access.session : null;
}

export function updateRestaurantSession<T>(token: string, change: (state: RestaurantState) => T): T | null {
  const session = sessionForToken(token, 'tool');
  if (!session) return null;

  const next = structuredClone(session.data);
  const result = change(next);
  session.data = next;
  return result;
}

export function isTableBooked(startsAt: string, tableId: string) {
  return store.bookedTables.get(startsAt)?.has(tableId) ?? false;
}

export function bookTable(startsAt: string, tableId: string) {
  const tables = store.bookedTables.get(startsAt) ?? new Set<string>();
  tables.add(tableId);
  store.bookedTables.set(startsAt, tables);
}

export function bearerToken(request: Request) {
  const value = request.headers.get('Authorization');
  return value?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1] ?? '';
}
