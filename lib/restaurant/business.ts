import { randomBytes } from 'node:crypto';
import { SCENARIO_KNOWLEDGE as restaurant } from '../scenario-knowledge';
import { restaurantRouteProvider } from './routes';
import { bookTable, isTableBooked, sessionForToken, updateRestaurantSession } from './store';
import type { CartLine, RestaurantState, TableOption } from './types';

export class RestaurantProblem extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

const tables = [
  { id: '2A', seats: 2 }, { id: '2B', seats: 2 }, { id: '4A', seats: 4 }, { id: '6A', seats: 6 },
];
const seatings = ['11:00', '12:30', '14:00', '15:30', '17:00', '18:30', '20:00'];
const localFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: restaurant.timeZone,
  dateStyle: 'short',
  timeStyle: 'short',
});
const bostonOffset = new Intl.DateTimeFormat('en-US', {
  timeZone: restaurant.timeZone,
  timeZoneName: 'longOffset',
});
const bostonDateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: restaurant.timeZone,
  dateStyle: 'medium',
  timeStyle: 'short',
});
const quoteLifetime = 3 * 60 * 1000;
const deliveryRadiusMiles = 3;
const toppings = [...new Set(restaurant.menu.flatMap(item => [...item.toppings]))];

type Args = Record<string, unknown>;

function text(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 150) {
    throw new RestaurantProblem('invalid_input', 'Provide a valid ' + field + '.');
  }
  return value.trim();
}

function quantity(value: unknown, field: string, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    throw new RestaurantProblem('invalid_input', field + ' must be a whole number between 1 and ' + max + '.');
  }
  return value;
}

function options(value: unknown, allowed: readonly string[], label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(choice => typeof choice === 'string' && allowed.includes(choice))) {
    throw new RestaurantProblem('invalid_modifier', 'Available ' + label + ': ' + (allowed.join(', ') || 'none') + '.');
  }
  return [...new Set<string>(value)];
}

function cartLine(value: unknown): CartLine {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RestaurantProblem('invalid_input', 'Provide each item, size and quantity.');
  }
  const item = value as Args;
  const spec = restaurant.menu.find(entry => entry.id === item.itemId);
  if (!spec) throw new RestaurantProblem('unknown_item', 'Use a menu item ID from getMenu.');
  if ('soldOut' in spec && spec.soldOut) {
    throw new RestaurantProblem('sold_out', spec.name + ' is sold out. Look up available alternatives.');
  }
  const size = text(item.size, 'size');
  const unitCents = (spec.prices as Record<string, number>)[size];
  if (typeof unitCents !== 'number') {
    throw new RestaurantProblem('invalid_size', spec.name + ' sizes: ' + Object.keys(spec.prices).join(', ') + '.');
  }
  const removeToppings = options(item.removeToppings, spec.toppings, 'toppings to remove');
  const extraToppings = options(item.extraToppings, spec.toppings.length ? toppings : [], 'extra toppings');
  return {
    itemId: spec.id, name: spec.name, size, quantity: quantity(item.quantity, 'Quantity', 20),
    removeToppings, extraToppings, unitCents: unitCents + extraToppings.length * 200,
  };
}

function requireUpdate<T>(token: string, change: (state: RestaurantState) => T) {
  const result = updateRestaurantSession(token, change);
  if (result === null) throw new RestaurantProblem('unauthorized', 'The voice tool session has expired.');
  return result;
}

function currentState(token: string) {
  const session = sessionForToken(token, 'tool');
  if (!session) throw new RestaurantProblem('unauthorized', 'The voice tool session has expired.');
  return session.data;
}

async function findRoute(value: unknown, mode: 'drive' | 'walk') {
  const route = await restaurantRouteProvider.lookup(text(value, 'Boston location'), mode);
  if (!route) {
    throw new RestaurantProblem('unknown_location', 'For a simulated route, use ' + restaurant.routeExamples.join(', ') + '.');
  }
  return route;
}

function kitchenTiming(now: number, pizzas: number) {
  const local = localFormatter.format(new Date(now));
  const minutes = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  const basicPrep = Math.max(8, Math.ceil(pizzas / 2) * 9);
  if (basicPrep + 4 > (22 - 11) * 60) {
    throw new RestaurantProblem('order_too_large', 'The kitchen cannot finish this order in one day. Ask the caller to reduce the quantity.');
  }
  const prepMinutes = basicPrep + (minutes >= 17 * 60 && minutes < 20 * 60 ? 10 : 4);
  if (minutes >= 11 * 60 && minutes + prepMinutes <= 22 * 60) {
    return { startsAt: now, prepMinutes };
  }

  const morning = new Date(local.slice(0, 10) + 'T16:00:00Z');
  if (minutes >= 11 * 60) morning.setUTCDate(morning.getUTCDate() + 1);
  const offset = bostonOffset.formatToParts(morning).find(part => part.type === 'timeZoneName')?.value;
  const startsAt = Date.parse(morning.toISOString().slice(0, 10) + 'T11:00:00' + offset?.replace('GMT', ''));
  return { startsAt, prepMinutes: basicPrep + 4 };
}

async function quoteOrder(token: string, args: Args) {
  const fulfillment = args.fulfillment;
  if (fulfillment !== 'pickup' && fulfillment !== 'delivery' && fulfillment !== 'dine-in') {
    throw new RestaurantProblem('invalid_input', 'Ask whether the order is for dine-in, pickup, or delivery.');
  }

  const revision = requireUpdate(token, state => {
    if (!state.cart.length) throw new RestaurantProblem('empty_cart', 'Add the requested items first.');
    state.quote = undefined;
    state.revision += 1;
    return state.revision;
  });
  const route = fulfillment === 'delivery' ? await findRoute(args.location, 'drive') : undefined;
  if (route && route.miles > deliveryRadiusMiles) {
    throw new RestaurantProblem('outside_delivery_area', 'This location is outside our demo delivery area. Offer pickup.');
  }

  return requireUpdate(token, state => {
    if (revision !== state.revision) {
      throw new RestaurantProblem('cart_changed', 'Read the latest cart and request a new quote.');
    }
    const now = Date.now();
    const pizzas = state.cart.reduce((total, item) => total + (item.size === 'regular' ? 0 : item.quantity), 0);
    const reservation = fulfillment === 'dine-in' && typeof args.reservationNumber === 'string'
      ? state.reservations.find(entry => entry.number === args.reservationNumber)
      : undefined;
    if (fulfillment === 'dine-in' && (args.reservationNumber ? !reservation : args.alreadySeated !== true)) {
      throw new RestaurantProblem('seating_required', 'Confirm the caller already has a table or reserve one before quoting a dine-in order.');
    }
    const { startsAt, prepMinutes } = kitchenTiming(now, pizzas);
    const estimatedAt = startsAt + (prepMinutes + (route ? 5 + route.minutes : 0)) * 60_000;
    const estimateMinutes = Math.ceil((estimatedAt - now) / 60_000);
    const subtotalCents = state.cart.reduce((total, item) => total + item.quantity * item.unitCents, 0);
    const taxCents = Math.round(subtotalCents * 0.07);
    const deliveryFeeCents = route ? 399 : 0;
    state.quote = {
      id: randomBytes(12).toString('hex'),
      items: state.cart, fulfillment,
      subtotalCents, taxCents, deliveryFeeCents, totalCents: subtotalCents + taxCents + deliveryFeeCents,
      ...(fulfillment === 'dine-in' ? {} : {
        prepMinutes, estimateMinutes, estimatedAt: new Date(estimatedAt).toISOString(),
        estimatedTimeLabel: bostonDateTime.format(new Date(estimatedAt)) + ' Boston time',
        ...(startsAt > now ? {
          scheduledPrepAt: new Date(startsAt).toISOString(),
          scheduledPrepTimeLabel: bostonDateTime.format(new Date(startsAt)) + ' Boston time',
        } : {}),
      }),
      ...(reservation ? {
        reservationNumber: reservation.number,
        seatingTime: reservation.slot.startsAt,
        immediateSeating: reservation.slot.immediate,
      } : {}),
      expiresAt: now + quoteLifetime, ...(route ? { route } : {}),
    };
    return { quote: state.quote, revision: state.revision, currency: restaurant.currency, timeZone: restaurant.timeZone };
  });
}

function tableFor(slot: TableOption) {
  return tables.find(table => table.seats >= slot.partySize && !isTableBooked(slot.startsAt, table.id));
}

function minuteOfDay(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function currentSeating(localNow: string) {
  const minute = minuteOfDay(localNow.slice(11));
  if (minute < 11 * 60 || minute >= 22 * 60) return undefined;
  return seatings.findLast(seating => minuteOfDay(seating) <= minute);
}

function findTables(token: string, args: Args) {
  // Supersede the previous search even when the new request fails validation.
  requireUpdate(token, state => {
    state.tableOptions = [];
    state.tableProposal = undefined;
  });
  const date = text(args.date, 'local date');
  const partySize = quantity(args.partySize, 'Party size', 6);
  const time = args.time == null ? undefined : text(args.time, 'local time');
  const now = localFormatter.format(new Date(Date.now())).replace(' ', 'T');
  const lastDate = localFormatter.format(new Date(Date.now() + 28 * 86_400_000)).slice(0, 10);
  const parsed = new Date(date + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(+parsed) ||
    parsed.toISOString().slice(0, 10) !== date || date < now.slice(0, 10) || date > lastDate) {
    throw new RestaurantProblem('invalid_date', 'Choose a Boston date within the next 28 days.');
  }
  if (time && time !== 'now' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new RestaurantProblem('invalid_time', 'Provide a local time as HH:mm.');
  }

  return requireUpdate(token, state => {
    const immediate = time === 'now' && date === now.slice(0, 10);
    const current = immediate ? currentSeating(now) : undefined;
    const byPreference = time && time !== 'now' ? [...seatings].sort((a, b) =>
      Math.abs(minuteOfDay(a) - minuteOfDay(time)) - Math.abs(minuteOfDay(b) - minuteOfDay(time))) : seatings;
    const slots = byPreference.map(seating => ({ startsAt: date + 'T' + seating, partySize }))
      .filter(slot => slot.startsAt > now && tableFor(slot));
    const walkIn = current ? { startsAt: date + 'T' + current, partySize } : undefined;
    const requested = walkIn && tableFor(walkIn) ? walkIn : slots.find(slot => slot.startsAt === date + 'T' + time);
    state.tableOptions = slots.slice(0, 3);
    state.tableProposal = requested
      ? { ...requested, id: randomBytes(12).toString('hex'), ...(requested === walkIn ? { immediate: true } : {}) }
      : undefined;
    return { options: state.tableOptions, proposal: state.tableProposal, timeZone: restaurant.timeZone };
  });
}

export async function runRestaurantTool(token: string, tool: string, args: Args) {
  const state = currentState(token);
  switch (tool) {
    case 'getMenu':
      return { ...restaurant, pricesIn: 'USD cents', cart: state.cart, revision: state.revision };
    case 'getStoreRoute':
      return { route: await findRoute(args.location, args.mode === 'walk' ? 'walk' : 'drive') };
    case 'updateCart': {
      const items = args.items;
      if (!Array.isArray(items) || items.length > 12) {
        throw new RestaurantProblem('invalid_input', 'Provide up to 12 cart lines.');
      }
      const revision = args.revision;
      const cart = items.map(cartLine);
      return requireUpdate(token, latest => {
        if (latest.revision !== revision) {
          throw new RestaurantProblem('cart_changed', 'Read the latest cart with getMenu before updating.');
        }
        latest.cart = cart;
        latest.revision += 1;
        latest.quote = undefined;
        return { cart: latest.cart, revision: latest.revision };
      });
    }
    case 'quoteOrder':
      return quoteOrder(token, args);
    case 'placeOrder': {
      const quoteId = text(args.quoteId, 'quote ID');
      return requireUpdate(token, latest => {
        const repeat = latest.orders.find(order => order.quote.id === quoteId);
        if (repeat) return { order: repeat };
        if (!latest.quote || latest.quote.id !== quoteId || latest.quote.expiresAt <= Date.now()) {
          throw new RestaurantProblem('stale_quote', 'Request and read back a new quote before confirming.');
        }
        const order = { number: 'NP-' + randomBytes(5).toString('hex').toUpperCase(), quote: latest.quote, confirmedAt: Date.now() };
        latest.orders.push(order);
        latest.cart = [];
        latest.quote = undefined;
        latest.revision += 1;
        return { order };
      });
    }
    case 'findTables':
      return findTables(token, args);
    case 'reserveTable': {
      const proposalId = text(args.proposalId, 'table proposal ID');
      return requireUpdate(token, latest => {
        const repeat = latest.reservations.find(reservation => reservation.slot.id === proposalId);
        if (repeat) return { reservation: repeat };
        const slot = latest.tableProposal;
        const now = localFormatter.format(new Date(Date.now())).replace(' ', 'T');
        const currentSlot = now.slice(0, 10) + 'T' + currentSeating(now);
        const validSlot = slot && (slot.immediate ? slot.startsAt === currentSlot : slot.startsAt > now);
        if (!slot || slot.id !== proposalId || !validSlot) {
          throw new RestaurantProblem('stale_proposal', 'Look up and confirm an available seating time.');
        }
        const table = tableFor(slot);
        if (!table) throw new RestaurantProblem('table_unavailable', 'That seating just filled. Look up alternatives.');
        const reservation = { number: 'NPT-' + randomBytes(5).toString('hex').toUpperCase(), slot, confirmedAt: Date.now() };
        // Selection and booking run synchronously in the same process.
        bookTable(slot.startsAt, table.id);
        latest.reservations.push(reservation);
        latest.tableOptions = [];
        latest.tableProposal = undefined;
        return { reservation };
      });
    }
    default:
      throw new RestaurantProblem('unknown_tool', 'This restaurant tool is unavailable.');
  }
}
