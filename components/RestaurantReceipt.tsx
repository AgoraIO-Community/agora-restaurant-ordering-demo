'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CartLine, OrderQuote, RestaurantState } from '@/lib/restaurant/types';
import { ConversationPanel, type ConversationPanelProps, type TranscriptAttachment } from './agent-ui/conversation-panel';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

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
      {quote.fulfillment === 'dine-in' ? (
        <p className="restaurant-estimate">
          Dine-in{quote.reservationNumber && ' · ' + quote.reservationNumber}
          {quote.seatingTime && !quote.immediateSeating && ' · ' + slotLabel(quote.seatingTime)}
        </p>
      ) : quote.estimatedAt && (
        <p className="restaurant-estimate">
          {quote.fulfillment === 'delivery' ? 'Delivery to ' + quote.route?.location : 'Pickup in Back Bay'}
          {' · '}{quote.estimatedTimeLabel ?? slotLabelForInstant(quote.estimatedAt)}
          {!quote.scheduledPrepAt && ' · ' + quote.estimateMinutes + ' min'}
        </p>
      )}
      {quote.scheduledPrepAt && <p className="restaurant-muted">Kitchen starts at {quote.scheduledPrepTimeLabel ?? slotLabelForInstant(quote.scheduledPrepAt)}.</p>}
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

export function RestaurantTranscript({
  token,
  active,
  ...panel
}: ConversationPanelProps & { token?: string | null; active: boolean }) {
  const [state, setState] = useState<RestaurantState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token) return;
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

  const assistantMessages = panel.messages.filter(message => message.role === 'agent');
  const confirmed = [
    ...(state?.orders ?? []).map(order => ({
      id: order.number,
      confirmedAt: order.confirmedAt,
      content: (
        <ReceiptDetails title="Demo order confirmed" value={order.number}>
          <QuoteDetails quote={order.quote} />
        </ReceiptDetails>
      ),
    })),
    ...(state?.reservations ?? []).map(reservation => ({
      id: reservation.number,
      confirmedAt: reservation.confirmedAt,
      content: (
        <ReceiptDetails title="Demo table confirmed" value={reservation.number}>
          <p>{reservation.slot.partySize} guests · {reservation.slot.immediate ? 'Seating now' : slotLabel(reservation.slot.startsAt)}</p>
        </ReceiptDetails>
      ),
    })),
  ].sort((left, right) => left.confirmedAt - right.confirmedAt);

  const attachments: TranscriptAttachment[] = confirmed.map(({ id, confirmedAt, content }) => {
    // Spoken identifiers can include spaces or omit the hyphen in transcripts.
    const reference = id.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const message = assistantMessages.find(entry =>
      (entry.createdAt ?? 0) >= confirmedAt || entry.text.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(reference),
    );
    return { id, afterMessageId: message?.id, content };
  });

  const cart = active ? state?.cart ?? [] : [];
  const quote = active ? state?.quote : undefined;
  const proposal = active ? state?.tableProposal : undefined;
  const options = active ? state?.tableOptions ?? [] : [];
  if (quote || cart.length || proposal || options.length || error) {
    attachments.push({
      id: 'restaurant-draft',
      content: (
        <section className="restaurant-details" aria-label="Current order and table details">
          {error && <p role="status" className="restaurant-muted">{error}</p>}
          {quote ? (
            <ReceiptDetails title="Order quote" value={currency.format(quote.totalCents / 100)}>
              <QuoteDetails quote={quote} />
            </ReceiptDetails>
          ) : cart.length ? (
            <ReceiptDetails title="Current order" value={cart.reduce((total, item) => total + item.quantity, 0) + ' items'}>
              <OrderLines items={cart} />
            </ReceiptDetails>
          ) : null}
          {proposal ? (
            <ReceiptDetails title="Table awaiting confirmation" value={proposal.partySize + ' guests'}>
              <p>{proposal.immediate ? 'Seating now' : slotLabel(proposal.startsAt)}</p>
            </ReceiptDetails>
          ) : options.length ? (
            <ReceiptDetails title="Available tables" value={options.length + ' times'}>
              <ul className="restaurant-slots">
                {options.map(slot => <li key={slot.startsAt}>{slotLabel(slot.startsAt)}</li>)}
              </ul>
            </ReceiptDetails>
          ) : null}
        </section>
      ),
    });
  }
  return <ConversationPanel {...panel} attachments={attachments} />;
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
