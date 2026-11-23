# Agora Restaurant Ordering Demo

## 1. What you build

Explore a sample menu and build a pickup or delivery order draft.

## 2. Prerequisites

Use Node.js 24, pnpm 9.15.9 and an Agora project with Conversational AI enabled.

## 3. Configure the app

Copy `env.local.example` to `.env.local`. Enter the App ID and App Certificate in the fields listed in [README.md](README.md).

## 4. Run the app

Run `pnpm install --frozen-lockfile` and `pnpm dev`. Open the local page and allow microphone access.

## 5. Try a conversation

Say “I would like two Garden Pizzas for delivery.” Then say “Change that to one Garden Pizza and make it pickup.” Ask for a recap of the corrected draft.

## 6. Understand the boundary

The browser session uses fictional reference data and a spoken draft. Do not collect a delivery address, phone number or payment details. Do not quote an all-in total, claim delivery coverage or promise allergen safety. Do not claim an order was submitted, paid for or sent to the kitchen.

## 7. Customize the scenario

Edit [the workflow](lib/agent-config.ts), [the fictional reference](lib/scenario-knowledge.ts) or [the UI copy](lib/presentation.ts).

## 8. Verify

Run `pnpm run verify`. Exercise the initial request and correction in a real browser call to validate speech behavior.
