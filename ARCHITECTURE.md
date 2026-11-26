# Restaurant ordering and reservations

Agora RTC carries audio. RTM carries transcripts and agent events. Next.js signs tokens and manages the agent lifecycle. When `RESTAURANT_TOOL_ORIGIN` is set, the invitation registers functions that call `POST /api/restaurant/tools` using a per-call bearer token.

The business routes keep the cart, latest quote, and confirmation results in process memory. Order confirmation accepts the current unexpired quote ID. Table confirmation checks availability and records the reservation synchronously. Retrying a confirmed ID returns its existing number. The browser uses a separate read token for `GET /api/restaurant/state`.

When the stop endpoint succeeds or Agora reports that the agent is already stopping or stopped, the app revokes the tool token. The browser can still retrieve confirmed orders and reservations with its read token. That token expires one hour after session creation.

The demo routes are behind `RestaurantRouteProvider` in [routes.ts](lib/restaurant/routes.ts). Its async lookup returns travel time, distance and the source. The business logic uses that contract for route answers and delivery quotes. The included provider uses Boston fixtures.

Run voice invitation, callbacks, and page reads in the same Next.js process. Restarting that process clears the demo sessions and reservations.
