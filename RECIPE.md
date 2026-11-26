# Agora Restaurant Ordering & Reservations Demo

## 1. What you build

Order from a sample pizza menu for pickup or delivery, or reserve a table.

## 2. Prerequisites

Use Node.js 24, pnpm 9.15.9 and an Agora project with Conversational AI enabled.

## 3. Configure the app

Copy `env.local.example` to `.env.local`. Enter the App ID, App Certificate, and public HTTPS tool origin as described in [README.md](README.md).

## 4. Run the app

Run `pnpm install --frozen-lockfile` and `pnpm dev`. Open the local page and allow microphone access.

## 5. Try a conversation

Ask for a large Garden Pizza delivered to Copley Square, then switch to pickup and confirm the new quote. Also try booking a table for four tomorrow at 6:30 p.m.

## 6. Understand the boundary

Orders, table reservations, and routes use demo data. Use a sample Boston landmark for delivery. Keep the exercise free of payment details and personal contact information.

## 7. Customize the scenario

Edit [the workflow](lib/agent-config.ts), [the fictional reference](lib/scenario-knowledge.ts) or [the UI copy](lib/presentation.ts).

## 8. Verify

Run `pnpm run verify`. Exercise the initial request and correction in a real browser call to validate speech behavior.
