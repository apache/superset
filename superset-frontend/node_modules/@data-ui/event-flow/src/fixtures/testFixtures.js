import { buildGraph } from '../utils/graph-utils';
import { buildAllScales } from '../utils/scale-utils';
import { TS, EVENT_NAME, ENTITY_ID } from '../constants';

export const events = [
  {
    [TS]: new Date('2017-03-22 18:33:10'),
    [EVENT_NAME]: 'a',
    [ENTITY_ID]: 'u1',
  },
  {
    [TS]: new Date('2017-03-22 18:34:10'),
    [EVENT_NAME]: 'b',
    [ENTITY_ID]: 'u1',
  },
  {
    [TS]: new Date('2017-03-22 18:35:10'),
    [EVENT_NAME]: 'c',
    [ENTITY_ID]: 'u1',
  },
  {
    [TS]: new Date('2017-03-22 18:36:10'),
    [EVENT_NAME]: 'd',
    [ENTITY_ID]: 'u1',
  },
];

export const width = 500;
export const height = 500;

export const graph = buildGraph({ cleanedEvents: events });
export const scales = buildAllScales(graph, width, height);
