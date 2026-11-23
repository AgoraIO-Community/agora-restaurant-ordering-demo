# Takeout & Delivery Ordering architecture

The browser uses Agora RTC for media and RTM for transcripts and Agent events. Next.js routes sign tokens and start or stop the managed Agent. The Invite route supplies the scenario prompt and uses the empty list from `lib/agent-tools.ts`.

The [workflow](lib/agent-config.ts) combines the scenario instructions with [fictional reference material](lib/scenario-knowledge.ts) and shared conversational guidance. [Presentation](lib/presentation.ts) provides the user-facing description and practice request.

The Agent keeps the current draft in conversational context. Do not collect a delivery address, phone number or payment details. Do not quote an all-in total, claim delivery coverage or promise allergen safety. Do not claim an order was submitted, paid for or sent to the kitchen.

The canonical offline check is `pnpm run verify`. Live acceptance uses a configured Agora project and checks the prompt behavior in a browser call.
