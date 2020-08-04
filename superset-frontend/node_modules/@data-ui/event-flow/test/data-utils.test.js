import { TS, ENTITY_ID, EVENT_NAME, META } from '../src/constants';

import {
  binEventsByEntityId,
  findNthIndexOfX,
  createEvent,
  cleanEvents,
  collectSequencesFromNode,
} from '../src/utils/data-utils';

describe('cleanEvents', () => {
  const accessors = {
    [TS]: d => d.ts,
    [ENTITY_ID]: d => d.id,
    [EVENT_NAME]: d => d.name,
  };

  const dirty = [
    { i: 'am', a: 'raw', event: ['!!!'], ts: 3, id: 'id', name: 'name' },
    { i: 'am', a: 'raw', event: ['!!!'], ts: 1, id: 'id1', name: 'name' },
    { i: 'am', a: 'raw', event: ['!!!'], ts: 2, id: 'id2', name: 'name' },
  ];

  const clean = cleanEvents(dirty, accessors);

  it('should be defined', () => {
    expect(cleanEvents).toBeDefined();
  });

  it('should add TS, ENTITY_ID, EVENT_NAME, META keys to the events', () => {
    clean.forEach(e => {
      [TS, ENTITY_ID, EVENT_NAME, META].forEach(prop => {
        expect(e).toHaveProperty(prop);
      });
    });
  });

  it('should keep all event metadata under the META key', () => {
    const rawEvent = { i: 'am', a: 'raw', event: ['!!!'] };
    const e = createEvent(rawEvent, accessors);
    expect(e[META]).toEqual(rawEvent);
  });

  it('should sort by ts', () => {
    expect(clean[0][TS]).toBe(1);
    expect(clean[1][TS]).toBe(2);
    expect(clean[2][TS]).toBe(3);
  });

  it('should assign values using the passed accessor fns', () => {
    clean.forEach(e => {
      [TS, ENTITY_ID, EVENT_NAME].forEach(prop => {
        expect(e).toHaveProperty(prop, accessors[prop](e[META]));
      });
    });
  });
});

describe('binEventsByEntityId', () => {
  const u1 = [{ [ENTITY_ID]: 'u1' }, { [ENTITY_ID]: 'u1' }, { [ENTITY_ID]: 'u1' }];
  const u2 = [{ [ENTITY_ID]: 'u2' }, { [ENTITY_ID]: 'u2' }];
  const u3 = [{ [ENTITY_ID]: 'u3' }];
  const events = [...u1, ...u2, ...u3];

  it('should be defined', () => {
    expect(binEventsByEntityId).toBeDefined();
  });

  it('should bin events based on the `ENTITY_ID key`', () => {
    const { entityEvents } = binEventsByEntityId(events);
    expect(Object.keys(entityEvents)).toHaveLength(3);
    expect(entityEvents.u1).toEqual(u1);
    expect(entityEvents.u2).toEqual(u2);
    expect(entityEvents.u3).toEqual(u3);
  });

  it('should return an object with keys entityEvents and ignoredEvents', () => {
    const result = binEventsByEntityId([]);
    expect(result).toEqual(expect.objectContaining({ entityEvents: {}, ignoredEvents: {} }));
  });

  it('should return events for each unique entity', () => {
    const { entityEvents } = binEventsByEntityId([
      { [ENTITY_ID]: 1 },
      { [ENTITY_ID]: 1 },
      { [ENTITY_ID]: 2 },
      { [ENTITY_ID]: 4 },
    ]);
    expect(Object.keys(entityEvents)).toHaveLength(3);
  });

  it('entityEvents should be an object of arrays', () => {
    const { entityEvents } = binEventsByEntityId([{ [ENTITY_ID]: 1 }, { [ENTITY_ID]: 2 }]);
    expect(Array.isArray(entityEvents[1])).toBe(true);
    expect(Array.isArray(entityEvents[2])).toBe(true);
  });

  it('should ignore the specified event types', () => {
    const testEvents = [
      { [ENTITY_ID]: 1, [EVENT_NAME]: 'a' },
      { [ENTITY_ID]: 1, [EVENT_NAME]: 'b' },
      { [ENTITY_ID]: 2, [EVENT_NAME]: 'b' },
      { [ENTITY_ID]: 2, [EVENT_NAME]: 'b' },
    ];

    const unfiltered = binEventsByEntityId(testEvents);
    const filterAs = binEventsByEntityId(testEvents, { a: true });
    const filterBs = binEventsByEntityId(testEvents, { b: true });
    const filtered = binEventsByEntityId(testEvents, { a: true, b: true });

    expect(unfiltered.entityEvents[1]).toHaveLength(2);
    expect(unfiltered.entityEvents[2]).toHaveLength(2);

    expect(filterAs.entityEvents[1]).toHaveLength(1);
    expect(filterAs.entityEvents[2]).toHaveLength(2);

    expect(filterBs.entityEvents[1]).toHaveLength(1);
    expect(filterBs.entityEvents[2]).toBeUndefined();

    expect(filtered.entityEvents[1]).toBeUndefined();
    expect(filtered.entityEvents[2]).toBeUndefined();
  });
});

describe('findNthIndexOfX', () => {
  const things = [
    { name: 'a' },
    { name: 'a' },
    { name: 'b' },
    { name: 'b' },
    { name: 'c' },
    { name: 'a' },
    { name: 'a' },
  ];

  it('should be defined', () => {
    expect(findNthIndexOfX).toBeDefined();
  });

  it('should find the 1st occurrence of an event', () => {
    expect(findNthIndexOfX(things, 1, e => e.name === 'a')).toBe(0);
    expect(findNthIndexOfX(things, 1, e => e.name === 'b')).toBe(2);
    expect(findNthIndexOfX(things, 1, e => e.name === 'c')).toBe(4);
  });

  it('should find the 2nd occurrence of an event', () => {
    expect(findNthIndexOfX(things, 2, e => e.name === 'a')).toBe(1);
    expect(findNthIndexOfX(things, 2, e => e.name === 'b')).toBe(3);
  });

  it('should find the last occurrence of an event', () => {
    expect(findNthIndexOfX(things, -1, e => e.name === 'a')).toBe(things.length - 1);
    expect(findNthIndexOfX(things, -1, e => e.name === 'b')).toBe(3);
    expect(findNthIndexOfX(things, -1, e => e.name === 'c')).toBe(4);
    expect(findNthIndexOfX(things, 7, () => true)).toBe(6);
  });

  it('should find the 2nd to last occurrence of an event', () => {
    expect(findNthIndexOfX(things, -2, e => e.name === 'a')).toBe(things.length - 2);
    expect(findNthIndexOfX(things, -2, e => e.name === 'b')).toBe(2);
  });

  it('should return -1 if the event is not present', () => {
    expect(findNthIndexOfX(things, -1, e => e.name === 'z')).toBe(-1);
    expect(findNthIndexOfX(things, 10, e => e.name === 'a')).toBe(-1);
    expect(findNthIndexOfX(things, 3, e => e.name === 'b')).toBe(-1);
    expect(findNthIndexOfX(things, 2, e => e.name === 'c')).toBe(-1);
  });

  it('should return -1 for a zeroth occurrence of an event', () => {
    expect(findNthIndexOfX(things, 0, e => e.name === 'a')).toBe(-1);
  });

  it('should return -1 for when occurrence is outside of the array length range', () => {
    expect(findNthIndexOfX(things, 10, () => true)).toBe(-1);
    expect(findNthIndexOfX(things, -10, () => true)).toBe(-1);
  });
});

describe('collectSequencesFromNode', () => {
  const events = {
    u1: [1, 2, 3],
    u2: [4, 5, 6],
  };

  const node = {
    events: {
      e1: {
        [ENTITY_ID]: 'u1',
      },
      e2: {
        [ENTITY_ID]: 'u2',
      },
      e3: {
        [ENTITY_ID]: 'u1',
      },
    },
  };

  it('should be defined', () => {
    expect(collectSequencesFromNode).toBeDefined();
  });

  it('should return a sequence for each unique entity key', () => {
    const sequences = collectSequencesFromNode(node, events);
    expect(sequences).toHaveLength(2);
  });

  it('should collect sequences for each unique entity key', () => {
    const sequences = collectSequencesFromNode(node, events);
    expect(sequences).toContain(events.u1);
    expect(sequences).toContain(events.u2);
  });
});
