export const SCENARIO_KNOWLEDGE = {
  business: 'North Pier Pizza',
  timeZone: 'America/New_York',
  city: 'Boston',
  neighborhood: 'Back Bay',
  currency: 'USD',
  hours: '11:00 a.m. to 10:00 p.m. Boston time',
  menu: [
    { id: 'garden', name: 'Garden Pizza', prices: { medium: 1600, large: 2000 }, toppings: ['mushrooms', 'onions', 'bell peppers'] },
    { id: 'margherita', name: 'Margherita Pizza', prices: { medium: 1400, large: 1800 }, toppings: ['mozzarella', 'basil'] },
    { id: 'pepperoni', name: 'Pepperoni Pizza', prices: { medium: 1700, large: 2100 }, toppings: ['pepperoni', 'mozzarella'] },
    { id: 'knots', name: 'Garlic Knots', prices: { regular: 600 }, toppings: [] },
    { id: 'lemonade', name: 'House Lemonade', prices: { regular: 350 }, toppings: [], soldOut: true },
    { id: 'soda', name: 'Sparkling Lemon Soda', prices: { regular: 350 }, toppings: [] },
  ],
  routeExamples: ['Copley Square', 'Boston Common', 'Fenway Park', 'Logan Airport'],
} as const;
