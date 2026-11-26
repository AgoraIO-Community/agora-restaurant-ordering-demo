import type { RestaurantRoute } from './routes';

export type Fulfillment = 'pickup' | 'delivery' | 'dine-in';

export interface CartLine {
  itemId: string;
  name: string;
  size: string;
  quantity: number;
  removeToppings: string[];
  extraToppings: string[];
  unitCents: number;
}

export interface OrderQuote {
  id: string;
  items: CartLine[];
  fulfillment: Fulfillment;
  subtotalCents: number;
  taxCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  prepMinutes?: number;
  estimateMinutes?: number;
  estimatedAt?: string;
  estimatedTimeLabel?: string;
  reservationNumber?: string;
  seatingTime?: string;
  immediateSeating?: boolean;
  scheduledPrepAt?: string;
  scheduledPrepTimeLabel?: string;
  expiresAt: number;
  route?: RestaurantRoute;
}

export interface RestaurantOrder {
  confirmedAt: number;
  number: string;
  quote: OrderQuote;
}

export interface TableOption {
  startsAt: string;
  partySize: number;
}

export interface TableProposal extends TableOption {
  immediate?: boolean;
  id: string;
}

export interface TableReservation {
  confirmedAt: number;
  number: string;
  slot: TableProposal;
}

export interface RestaurantState {
  revision: number;
  cart: CartLine[];
  quote?: OrderQuote;
  tableOptions: TableOption[];
  tableProposal?: TableProposal;
  orders: RestaurantOrder[];
  reservations: TableReservation[];
}
