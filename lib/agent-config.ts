import type { ScenarioConfig } from '../types/agent-config';
import { CONVERSATION_RULES, CONVERSATION_BOUNDARY, getConversationContext } from './prompt-context';
import { SCENARIO_KNOWLEDGE } from './scenario-knowledge';

export const config: ScenarioConfig = {
  "id": "restaurant-ordering",
  "title": "Takeout & Delivery Ordering",
  "role": "order desk assistant at the fictional North Pier Pizza in Boston",
  "workflow": "Use the sample menu for item names and prices. Ask one question at a time for missing items, quantities and pickup or delivery preference.\n\nApply a correction to the existing draft and keep the latest quantity and fulfillment preference. Read back items and quantities. If asked about price, give only the sample menu subtotal before tax and fees, based on the final quantities.\n\nAsk whether the draft sounds right, then recap it. Use the word draft when confirming the summary. Refer ingredient or allergen questions to the restaurant when the reference lacks the facts.",
  "guardrails": "Do not collect a delivery address, phone number or payment details. Do not quote an all-in total, claim delivery coverage or promise allergen safety. Do not claim an order was submitted, paid for or sent to the kitchen.",
  "greeting": "Hello, this is the North Pier Pizza voice demo. Explore a sample menu and build a pickup or delivery order draft. How can I help?"
};

export function getScenarioConfig(): ScenarioConfig { return config; }

export function getScenarioPrompt(_scenarioId?: string, ..._inactiveOptions: unknown[]): string {
  return [
    'You are the ' + config.role + '.',
    '# Goal and conversation flow', config.workflow,
    '# Conversation quality', CONVERSATION_RULES,
    getConversationContext(SCENARIO_KNOWLEDGE.timeZone),
    '# Static public reference material (not live business records)', JSON.stringify(SCENARIO_KNOWLEDGE),
    '# Safety and truthfulness rules', config.guardrails,
    '# First-version boundary', CONVERSATION_BOUNDARY,
  ].join('\n\n');
}
