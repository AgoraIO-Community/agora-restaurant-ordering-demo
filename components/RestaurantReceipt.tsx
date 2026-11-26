'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CartLine, OrderQuote, RestaurantState } from '@/lib/restaurant/types';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const bostonTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeStyle: 'short' });

function OrderLines({ items }: { items: CartLine[] }) {
  return (
    <ul className="restaurant-lines">
      {items.map((item, index) => (
        <li key={index}>
          <div>
            <strong>{item.quantity} × {item.name}</strong>
            <small>{[
              item.size === 'regular' ? '' : item.size,
              ...item.removeToppings.map(topping => 'No ' + topping),
              ...item.extraToppings.map(topping => 'Extra ' + topping),
            ].filter(Boolean).join(' · ')}</small>
          </div>
          <span>{currency.format(item.unitCents * item.quantity / 100)}</span>
        </li>
      ))}
    </ul>
  );
}

function QuoteDetails({ quote }: { quote: OrderQuote }) {
  return (
    <>
      <OrderLines items={quote.items} />
      <dl className="restaurant-totals">
        <div><dt>Tax</dt><dd>{currency.format(quote.taxCents / 100)}</dd></div>
        {quote.deliveryFeeCents > 0 && <div><dt>Delivery</dt><dd>{currency.format(quote.deliveryFeeCents / 100)}</dd></div>}
        <div className="restaurant-total"><dt>Total</dt><dd>{currency.format(quote.totalCents / 100)}</dd></div>
      </dl>
      <p className="restaurant-estimate">
        {quote.fulfillment === 'delivery' ? 'Delivery to ' + quote.route?.location : 'Pickup in Back Bay'}
        {' · '}{bostonTime.format(new Date(quote.estimatedAt))} Boston time
        {!quote.scheduledPrepAt && ' · ' + quote.estimateMinutes + ' min'}
      </p>
      {quote.scheduledPrepAt && <p className="restaurant-muted">Kitchen starts at {slotLabelForInstant(quote.scheduledPrepAt)}.</p>}
      {quote.route?.source === 'demo' && <p className="restaurant-muted">Simulated route</p>}
    </>
  );
}

function slotLabelForInstant(instant: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(instant)) + ' Boston time';
}

function slotLabel(startsAt: string) {
  const [date, time] = startsAt.split('T');
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(date + 'T' + time + ':00Z')) + ' Boston time';
}

export function RestaurantReceipt({ token, active }: { token: string; active: boolean }) {
  const [state, setState] = useState<RestaurantState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    async function read() {
      try {
        const response = await fetch('/api/restaurant/state', {
          headers: { Authorization: 'Bearer ' + token },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401) {
          setError('This demo session has expired.');
          return;
        }
        if (!response.ok) throw new Error('State lookup failed');
        const next = await response.json() as RestaurantState;
        if (!controller.signal.aborted) {
          setState(next);
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) setError('The demo details are temporarily unavailable.');
      }
      if (active && !controller.signal.aborted) timer = window.setTimeout(read, 1500);
    }
    void read();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [token, active]);

  const order = state?.orders.at(-1);
  const reservation = state?.reservations.at(-1);
  const cart = active ? state?.cart ?? [] : [];
  const quote = active ? state?.quote : undefined;
  const proposal = active ? state?.tableProposal : undefined;
  const options = active ? state?.tableOptions ?? [] : [];
  if (!quote && !cart.length && !order && !proposal && !options.length && !reservation && !error) return null;

  return (
    <section className="restaurant-details" aria-label="Order and reservation details">
      {error && <p role="status" className="restaurant-muted">{error}</p>}
      {quote ? (
        <ReceiptDetails title="Order quote" value={currency.format(quote.totalCents / 100)}>
          <QuoteDetails quote={quote} />
        </ReceiptDetails>
      ) : cart.length ? (
        <ReceiptDetails title="Current order" value={cart.reduce((total, item) => total + item.quantity, 0) + ' items'}>
          <OrderLines items={cart} />
        </ReceiptDetails>
      ) : order ? (
        <ReceiptDetails title="Demo order confirmed" value={order.number}>
          <QuoteDetails quote={order.quote} />
        </ReceiptDetails>
      ) : null}

      {proposal ? (
        <ReceiptDetails title="Table awaiting confirmation" value={proposal.partySize + ' guests'}>
          <p>{slotLabel(proposal.startsAt)}</p>
        </ReceiptDetails>
      ) : options.length ? (
        <ReceiptDetails title="Available tables" value={options.length + ' times'}>
          <ul className="restaurant-slots">
            {options.map(slot => <li key={slot.startsAt}>{slotLabel(slot.startsAt)}</li>)}
          </ul>
        </ReceiptDetails>
      ) : reservation ? (
        <ReceiptDetails title="Demo table confirmed" value={reservation.number}>
          <p>{reservation.slot.partySize} guests · {slotLabel(reservation.slot.startsAt)}</p>
        </ReceiptDetails>
      ) : null}
    </section>
  );
}

function ReceiptDetails({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return (
    <details className="restaurant-card">
      <summary>
        <span>{title}</span>
        <span className="restaurant-reference">{value}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </summary>
      <div className="restaurant-card-body">{children}</div>
    </details>
  );
}
