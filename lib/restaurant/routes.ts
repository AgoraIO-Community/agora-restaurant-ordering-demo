export interface RestaurantRoute {
  location: string;
  miles: number;
  minutes: number;
  source: 'demo' | 'live';
}

export interface RestaurantRouteProvider {
  lookup(location: string, mode: 'walk' | 'drive'): Promise<RestaurantRoute | null>;
}

const ROUTES = [
  { aliases: ['copley square', 'back bay', '02116'], name: 'Copley Square', miles: 0.5, walk: 10, drive: 5 },
  { aliases: ['boston common', 'downtown boston', '02108'], name: 'Boston Common', miles: 1.1, walk: 23, drive: 9 },
  { aliases: ['fenway park', 'fenway', '02215'], name: 'Fenway Park', miles: 1.4, walk: 28, drive: 11 },
  { aliases: ['logan airport', 'logan international airport', 'east boston', '02128'], name: 'Logan Airport', miles: 5.7, walk: 110, drive: 22 },
];

export const restaurantRouteProvider: RestaurantRouteProvider = {
  async lookup(location, mode) {
    const normalized = location.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const route = ROUTES.find(({ aliases }) => aliases.some((alias) => {
      const words = ' ' + normalized + ' ';
      return words.includes(' ' + alias + ' ');
    }));
    return route ? { location: route.name, miles: route.miles, minutes: route[mode], source: 'demo' } : null;
  },
};
