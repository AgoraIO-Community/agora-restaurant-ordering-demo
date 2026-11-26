import assert from 'node:assert/strict';
import { Agent, AgoraClient } from 'agora-agents';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/restaurant/state/route';
import { POST } from '../app/api/restaurant/tools/route';
import { createRestaurantSession } from '../lib/restaurant/store';
import type { RestaurantState } from '../lib/restaurant/types';

type Session = ReturnType<typeof createRestaurantSession>;

async function invoke(token: string, tool: string, args: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/restaurant/tools', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token },
    body: JSON.stringify({ tool, args }),
  }));
}

async function call(session: Session, tool: string, args: Record<string, unknown> = {}) {
  const response = await invoke(session.toolToken, tool, args);
  assert.equal(response.status, 200);
  return response.json();
}

const item = { itemId: 'garden', size: 'large', quantity: 1, removeToppings: ['onions'] };

async function snapshotFor(readToken: string): Promise<RestaurantState> {
  const response = await GET(new Request('http://localhost/api/restaurant/state', {
    headers: { Authorization: 'Bearer ' + readToken },
  }));
  assert.equal(response.status, 200);
  return response.json();
}

async function verifyRejectedOrExpiredRequests() {
  const session = createRestaurantSession();
  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/New_York', dateStyle: 'short',
  }).format(new Date(Date.now() + 2 * 86_400_000));
  const args = { date, time: '17:00', partySize: 2 };
  const booking = await call(session, 'findTables', args);
  assert.ok(booking.proposal);
  assert.equal((await call(session, 'findTables', { ...args, date: 'invalid' })).code, 'invalid_date');
  assert.equal((await snapshotFor(session.readToken)).tableProposal, undefined, 'Invalid search must clear the old proposal');
  assert.equal((await call(session, 'reserveTable', { proposalId: booking.proposal.id })).code, 'stale_proposal');

  await call(session, 'updateCart', { revision: 0, items: [item] });
  const quoted = await call(session, 'quoteOrder', { fulfillment: 'pickup' });
  const originalNow = Date.now;
  Date.now = () => quoted.quote.expiresAt;
  try {
    assert.equal((await call(session, 'placeOrder', { quoteId: quoted.quote.id })).code, 'stale_quote');
    assert.equal((await snapshotFor(session.readToken)).quote, undefined, 'Expired quotes must disappear from the state API');
  } finally {
    Date.now = originalNow;
  }

  const largeCart = await call(session, 'updateCart', {
    revision: quoted.revision, items: Array.from({ length: 12 }, () => ({ ...item, quantity: 20 })),
  });
  assert.equal(largeCart.ok, true);
  assert.equal((await call(session, 'quoteOrder', { fulfillment: 'pickup' })).code, 'order_too_large');
}

async function main() {
  await verifyRejectedOrExpiredRequests();
  const a = createRestaurantSession();
  const b = createRestaurantSession();
  assert.equal((await invoke(a.readToken, 'getMenu', {})).status, 401);
  assert.equal((await GET(new Request('http://localhost', {
    headers: { Authorization: 'Bearer ' + a.toolToken },
  }))).status, 401);
  const menu = await call(a, 'getMenu');
  assert.equal(menu.revision, 0);
  assert.equal((await call(a, 'updateCart', { revision: 0, items: [{ ...item, size: 'constructor' }] })).code, 'invalid_size');
  assert.equal((await call(a, 'updateCart', { revision: 0, items: [{ itemId: 'lemonade', size: 'regular', quantity: 1 }] })).code, 'sold_out');
  assert.equal((await call(a, 'updateCart', { revision: 0, items: [item] })).ok, true);
  const pickup = await call(a, 'quoteOrder', { fulfillment: 'pickup' });
  assert.equal(pickup.quote.totalCents, 2140);
  if (pickup.quote.scheduledPrepAt) {
    assert.equal(Date.parse(pickup.quote.estimatedAt) - Date.parse(pickup.quote.scheduledPrepAt), pickup.quote.prepMinutes * 60_000);
  } else {
    assert.equal(pickup.quote.estimateMinutes, pickup.quote.prepMinutes);
  }
  assert.equal((await call(a, 'updateCart', { revision: pickup.revision, items: [{ ...item, quantity: 6 }] })).ok, true);
  assert.equal((await call(a, 'placeOrder', { quoteId: pickup.quote.id })).code, 'stale_quote');
  const largePickup = await call(a, 'quoteOrder', { fulfillment: 'pickup' });
  assert.ok(largePickup.quote.prepMinutes > pickup.quote.prepMinutes);
  const placedPickup = await call(a, 'placeOrder', { quoteId: largePickup.quote.id });
  assert.ok(placedPickup.order.number.startsWith('NP-'));

  const revision = (await call(a, 'getMenu')).revision;
  await call(a, 'updateCart', { revision, items: [item] });
  const route = await call(a, 'getStoreRoute', { location: 'Copley Square', mode: 'walk' });
  assert.equal(route.route.source, 'demo');
  const delivery = await call(a, 'quoteOrder', { fulfillment: 'delivery', location: 'Boston Common' });
  if (delivery.quote.scheduledPrepAt) {
    assert.equal(Date.parse(delivery.quote.estimatedAt) - Date.parse(delivery.quote.scheduledPrepAt),
      (delivery.quote.prepMinutes + 5 + 9) * 60_000);
  } else {
    assert.equal(delivery.quote.estimateMinutes, delivery.quote.prepMinutes + 5 + 9);
  }
  assert.equal((await call(a, 'quoteOrder', { fulfillment: 'delivery', location: 'Logan Airport' })).code, 'outside_delivery_area');
  assert.equal((await call(a, 'placeOrder', { quoteId: delivery.quote.id })).code, 'stale_quote');
  const fresh = await call(a, 'quoteOrder', { fulfillment: 'delivery', location: 'Boston Common' });
  const bookings = await Promise.all([1, 2].map(() => call(a, 'placeOrder', { quoteId: fresh.quote.id })));
  assert.equal(bookings[0].order.number, bookings[1].order.number);

  const date = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/New_York', dateStyle: 'short',
  }).format(new Date(Date.now() + 2 * 86_400_000));
  const bookingArgs = { date, time: '18:30', partySize: 6 };
  const first = await call(a, 'findTables', bookingArgs);
  const second = await call(b, 'findTables', bookingArgs);
  const results = await Promise.all([
    call(a, 'reserveTable', { proposalId: first.proposal.id }),
    call(b, 'reserveTable', { proposalId: second.proposal.id }),
  ]);
  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => result.code === 'table_unavailable').length, 1);
  const winner = results[0].ok ? a : b;
  const winnerProposal = results[0].ok ? first : second;
  const repeat = await call(winner, 'reserveTable', { proposalId: winnerProposal.proposal.id });
  assert.equal(repeat.reservation.number, results.find(result => result.ok).reservation.number);
  const read = await GET(new Request('http://localhost', { headers: { Authorization: 'Bearer ' + a.readToken } }));
  const snapshot = await read.json() as RestaurantState;
  assert.equal(snapshot.orders.length, 2);
  assert.equal(snapshot.orders[1].quote.fulfillment, 'delivery');
  assert.deepEqual(snapshot.cart, []);
  assert.equal(snapshot.reservations.length, results[0].ok ? 1 : 0);

  process.env.RESTAURANT_TOOL_ORIGIN = 'https://restaurant.example.com';
  process.env.NEXT_PUBLIC_AGORA_APP_ID = '0123456789abcdef0123456789abcdef';
  process.env.NEXT_AGORA_APP_CERTIFICATE = 'fedcba9876543210fedcba9876543210';
  const start = (await import('../app/api/invite-agent/route')).POST;
  const create = Agent.prototype.createSession;
  let captured: Agent | undefined;
  Agent.prototype.createSession = (function (this: Agent) {
    captured = this;
    return { start: async () => 'test-agent' };
  }) as unknown as typeof Agent.prototype.createSession;
  try {
    const response = await start(new NextRequest('http://localhost/api/invite-agent', {
      method: 'POST', body: JSON.stringify({ channel_name: 'test', requester_id: '123' }),
    }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(captured?.advancedFeatures?.enable_tools, true);
    const tool = captured?.llm?.tools?.find(definition => definition.function.name === 'getMenu');
    assert.equal(tool?.server.url, 'https://restaurant.example.com/api/restaurant/tools');
    assert.equal(tool?.server.body?.args, '{{args.input}}');
    assert.match(captured?.instructions || '', /placeOrder/);
    const toolToken = tool?.server.headers?.Authorization.slice('Bearer '.length);
    assert.ok(toolToken);
    assert.notEqual(toolToken, result.restaurant_read_token);
    assert.equal((await invoke(toolToken, 'getMenu', {})).status, 200);
    const stop = (await import('../app/api/stop-conversation/route')).POST;
    const originalStop = AgoraClient.prototype.stopAgent;
    const requestStop = () => stop(new Request('http://localhost/api/stop-conversation', {
      method: 'POST', body: JSON.stringify({ agent_id: result.agent_id }),
    }));
    try {
      AgoraClient.prototype.stopAgent = async () => { throw new Error('Temporary stop failure'); };
      assert.equal((await requestStop()).status, 500);
      assert.equal((await invoke(toolToken, 'getMenu', {})).status, 200);
      AgoraClient.prototype.stopAgent = async () => { throw { statusCode: 404 }; };
      assert.equal((await requestStop()).status, 200);
      assert.equal((await invoke(toolToken, 'updateCart', { revision: 0, items: [item] })).status, 401);
    } finally {
      AgoraClient.prototype.stopAgent = originalStop;
    }

    assert.equal((await GET(new Request('http://localhost', {
      headers: { Authorization: 'Bearer ' + result.restaurant_read_token },
    }))).status, 200);
  } finally {
    Agent.prototype.createSession = create;
  }
  console.log('Restaurant pickup, delivery, stale quotes, idempotency, table capacity, and Agora tool registration passed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
