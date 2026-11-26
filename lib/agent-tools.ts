import type { LlmTool } from 'agora-agents';

const string = { type: 'string' };
const integer = { type: 'integer' };
const stringList = { type: 'array', items: string };
const item = {
  type: 'object',
  properties: { itemId: string, size: string, quantity: integer, removeToppings: stringList, extraToppings: stringList },
  required: ['itemId', 'size', 'quantity'],
};
type ToolDefinition = [name: string, description: string, properties: Record<string, unknown>, required?: string[]];

const definitions: ToolDefinition[] = [
  ['getMenu', 'Get item IDs, sizes, toppings, prices, inventory, hours and the current cart revision.', {}],
  ['updateCart', 'Replace the entire cart with its latest intended lines. Use the latest revision from getMenu or updateCart.', {
    revision: integer, items: { type: 'array', items: item },
  }, ['revision', 'items']],
  ['getStoreRoute', 'Get a simulated route to the Boston store from a demo location.', {
    location: string, mode: { type: 'string', enum: ['walk', 'drive'] },
  }, ['location', 'mode']],
  ['quoteOrder', 'Get the total and readiness estimate from the current cart. For delivery, provide a demo location.', {
    fulfillment: { type: 'string', enum: ['pickup', 'delivery'] }, location: string,
  }, ['fulfillment']],
  ['placeOrder', 'Submit the current quote after the customer explicitly agrees to the read-back.', {
    quoteId: string,
  }, ['quoteId']],
  ['findTables', 'Find seating by Boston date (YYYY-MM-DD), requested time (HH:mm), and party size. Once the caller chooses a time, look up that exact time to get the proposal ID.', {
    date: string, time: string, partySize: integer,
  }, ['date', 'partySize']],
  ['reserveTable', 'Book the proposed seating after the customer explicitly agrees to the read-back.', {
    proposalId: string,
  }, ['proposalId']],
];

export function getScenarioTools(origin?: string, token?: string): LlmTool[] {
  if (!origin || !token) return [];
  const url = new URL('/api/restaurant/tools', origin);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('RESTAURANT_TOOL_ORIGIN must be a public HTTPS origin.');
  }
  return definitions.map(([name, description, properties, required]) => ({
    type: 'function',
    function: {
      name, description,
      parameters: {
        type: 'object',
        properties: { input: { type: 'object', properties, ...(required ? { required } : {}) } },
        required: ['input'],
      },
    },
    server: {
      method: 'POST',
      url: url.href,
      headers: { Authorization: 'Bearer ' + token },
      body: { tool: name, args: '{{args.input}}' },
      timeout_ms: 5000,
    },
  }));
}
