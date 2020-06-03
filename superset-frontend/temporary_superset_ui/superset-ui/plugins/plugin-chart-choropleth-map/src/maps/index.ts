import { keyBy } from 'lodash/fp';
import { RawMapMetadata } from '../types';

// Edit here if you are adding a new map
const mapsInfo: Record<string, Omit<RawMapMetadata, 'key'>> = {
  belgium: {
    name: 'Belgium',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./belgium-topo.json'),
    keyField: 'properties.ISO',
  },
  brazil: {
    name: 'Brazil',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./brazil-topo.json'),
    keyField: 'properties.ISO',
  },
  bulgaria: {
    name: 'Bulgaria',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./bulgaria-topo.json'),
    keyField: 'properties.ISO',
  },
  canada: {
    name: 'Canada',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./canada-topo.json'),
    keyField: 'properties.NAME_1',
  },
  china: {
    name: 'China',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./china-topo.json'),
    keyField: 'properties.NAME_1',
  },
  france: {
    name: 'France',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./france-topo.json'),
    keyField: 'properties.ISO',
  },
  germany: {
    name: 'Germany',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./germany-topo.json'),
    keyField: 'properties.ISO',
  },
  india: {
    name: 'India',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./india-topo.json'),
    keyField: 'properties.ISO',
  },
  iran: {
    name: 'Iran',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./iran-topo.json'),
    keyField: 'properties.ISO',
  },
  italy: {
    name: 'Italy',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./italy-topo.json'),
    keyField: 'properties.ISO',
  },
  japan: {
    name: 'Japan',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./japan-topo.json'),
    keyField: 'properties.ISO',
  },
  korea: {
    name: 'Korea',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./korea-topo.json'),
    keyField: 'properties.ISO',
  },
  liechtenstein: {
    name: 'Liechtenstein',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./liechtenstein-topo.json'),
    keyField: 'properties.ISO',
  },
  morocco: {
    name: 'Morocco',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./morocco-topo.json'),
    keyField: 'properties.ISO',
  },
  myanmar: {
    name: 'Myanmar',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./myanmar-topo.json'),
    keyField: 'properties.ISO',
  },
  netherlands: {
    name: 'Netherlands',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./netherlands-topo.json'),
    keyField: 'properties.ISO',
  },
  portugal: {
    name: 'Portugal',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./portugal-topo.json'),
    keyField: 'properties.ISO',
  },
  russia: {
    name: 'Russia',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./russia-topo.json'),
    keyField: 'properties.ISO',
    rotate: [-9, 0, 0],
  },
  singapore: {
    name: 'Singapore',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./singapore-topo.json'),
    keyField: 'properties.ISO',
  },
  spain: {
    name: 'Spain',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./spain-topo.json'),
    keyField: 'properties.ISO',
  },
  switzerland: {
    name: 'Switzerland',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./switzerland-topo.json'),
    keyField: 'properties.ISO',
  },
  thailand: {
    name: 'Thailand',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./thailand-topo.json'),
    keyField: 'properties.NAME_1',
  },
  timorleste: {
    name: 'Timor-Leste',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./timorleste-topo.json'),
    keyField: 'properties.ISO',
  },
  uk: {
    name: 'United Kingdom',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./uk-topo.json'),
    keyField: 'properties.ISO',
  },
  ukraine: {
    name: 'Ukraine',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./ukraine-topo.json'),
    keyField: 'properties.NAME_1',
  },
  usa: {
    name: 'USA',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./usa-topo.json'),
    keyField: 'properties.STATE',
    projection: 'Albers',
  },
  world: {
    name: 'World Map',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./world-topo.json'),
    keyField: 'id',
    projection: 'Equirectangular',
    rotate: [-9, 0, 0],
  },
  zambia: {
    name: 'Zambia',
    type: 'topojson',
    // @ts-ignore
    load: () => import('./zambia-topo.json'),
    keyField: 'properties.name',
  },
};

/** List of available maps */
export const maps: RawMapMetadata[] = Object.entries(mapsInfo).map(
  ([key, metadata]) =>
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    ({ ...metadata, key } as RawMapMetadata),
);

/** All maps indexed by map key */
export const mapsLookup = keyBy((m: RawMapMetadata) => m.key)(maps);
