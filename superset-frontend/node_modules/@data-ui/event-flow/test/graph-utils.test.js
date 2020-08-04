import { TS0, TS_PREV, TS_NEXT, TS, EVENT_NAME, ENTITY_ID } from '../src/constants';

import {
  buildNodesFromEntityEvents,
  buildGraph,
  getNodeFromEvent,
  addMetaDataToNodes,
  getRoot,
  ancestorsFromNode,
} from '../src/utils/graph-utils';

const user1 = [
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

const user2 = [
  {
    [TS]: new Date('2017-03-22 18:33:10'),
    [EVENT_NAME]: 'a',
    [ENTITY_ID]: 'u2',
  },
  {
    [TS]: new Date('2017-03-22 18:34:10'),
    [EVENT_NAME]: 'b',
    [ENTITY_ID]: 'u2',
  },
  {
    [TS]: new Date('2017-03-22 18:35:10'),
    [EVENT_NAME]: 'b',
    [ENTITY_ID]: 'u2',
  },
  {
    [TS]: new Date('2017-03-22 18:36:10'),
    [EVENT_NAME]: 'c',
    [ENTITY_ID]: 'u2',
  },
  {
    [TS]: new Date('2017-03-22 18:37:10'),
    [EVENT_NAME]: 'd',
    [ENTITY_ID]: 'u2',
  },
];

describe('getNodeFromEvent', () => {
  it('should be defined', () => {
    expect(getNodeFromEvent).toBeDefined();
  });

  it('should return an object', () => {
    expect(typeof getNodeFromEvent({}, '123', 0)).toBe('object');
  });

  it('should not initialize nodes that already exits', () => {
    const depth = 0;
    const nodes = {};
    const node = getNodeFromEvent(nodes, 'id', 'eventName', depth);
    nodes[node.id] = node;

    // id defines unique-ness
    expect(getNodeFromEvent(nodes, 'id', 'eventName', depth)).toBe(node);
    expect(getNodeFromEvent(nodes, 'id', 'eventName', depth + 1)).toBe(node);
    expect(getNodeFromEvent(nodes, 'id2', 'eventName', depth)).not.toBe(node);
  });
});

describe('buildNodesFromEntityEvents', () => {
  it('should be defined', () => {
    expect(buildNodesFromEntityEvents).toBeDefined();
  });

  it('should parse all events from the first event', () => {
    const nodes = {};
    buildNodesFromEntityEvents(user1, 0, nodes);
    expect(Object.keys(nodes)).toHaveLength(4);
  });

  it('should parse all events from the last event', () => {
    const nodes = {};
    buildNodesFromEntityEvents(user1, 3, nodes);
    expect(Object.keys(nodes)).toHaveLength(4);
  });

  it('should parse all events from an arbitrary event', () => {
    const nodes = {};
    buildNodesFromEntityEvents(user1, 2, nodes);
    expect(Object.keys(nodes)).toHaveLength(4);
  });

  it('should create one node for each unique event sequence', () => {
    const nodes = {};
    buildNodesFromEntityEvents(user1, 0, nodes);
    expect(Object.keys(nodes)).toHaveLength(4);

    buildNodesFromEntityEvents(user1, 3, nodes); // all new indices
    expect(Object.keys(nodes)).toHaveLength(8);

    buildNodesFromEntityEvents(user2, 0, nodes); // some overlapping nodes
    expect(Object.keys(nodes)).toHaveLength(11);
  });

  it('should add proper parent and children references', () => {
    const startIndex = 1;
    const nodes = {};
    buildNodesFromEntityEvents(user1, startIndex, nodes);

    const ordered = Object.keys(nodes)
      .sort((a, b) => nodes[a].depth - nodes[b].depth)
      .map(nId => nodes[nId]);

    // negative depth nodes
    expect(ordered[0].parent).toBe(ordered[1]);
    expect(ordered[1].children[ordered[0].id]).toBe(ordered[0]);

    // root
    expect(ordered[1].parent).toBeFalsy();

    // positive depth nodes
    expect(ordered[1].children[ordered[2].id]).toEqual(ordered[2]);
    expect(ordered[2].parent).toEqual(ordered[1]);

    expect(ordered[2].children[ordered[3].id]).toEqual(ordered[3]);
    expect(ordered[3].parent).toEqual(ordered[2]);

    expect(ordered[3].children).toEqual({});
  });

  it('should add proper depth attributes', () => {
    const startIndex = 2;
    const nodes = {};
    buildNodesFromEntityEvents(user1, startIndex, nodes);

    const depths = Object.keys(nodes).map(nId => nodes[nId].depth);
    const expectedDepths = Array(user1.length)
      .fill()
      .map((_, i) => i - startIndex);

    expect(depths).toEqual(expect.arrayContaining(expectedDepths));
  });

  it('should add event referenecs to nodes', () => {
    const nodes = {};
    buildNodesFromEntityEvents(user1, 0, nodes);

    expect(Object.keys(nodes)).toHaveLength(user1.length);

    // for each node
    Object.keys(nodes).forEach(nId => {
      expect(Object.keys(nodes[nId].events)).toHaveLength(1);

      // for all events on the node
      Object.keys(nodes[nId].events).forEach(eId => {
        // expect event array to contain that event
        const event = nodes[nId].events[eId];
        expect(user1).toEqual(expect.arrayContaining([event]));
      });
    });
  });

  it('should add TS0, TS_NEXT, and TS_PREV properties to events', () => {
    const nodes = {};
    buildNodesFromEntityEvents(user1, 0, nodes);

    Object.keys(nodes).forEach(nId => {
      const eventKeys = Object.keys(nodes[nId].events);

      eventKeys.forEach(eId => {
        [TS0, TS_PREV, TS_NEXT].forEach(prop => {
          const event = nodes[nId].events[eId];
          expect(event).toHaveProperty(prop);
        });
      });
    });
  });
});

describe('addMetaDataToNodes', () => {
  it('should be defined', () => {
    expect(addMetaDataToNodes).toBeDefined();
  });

  // @todo
  // validate elapsed times
});

describe('getRoot', () => {
  it('should be defined', () => {
    expect(getRoot).toBeDefined();
  });

  it('should only add nodes with depth === 0 to the root', () => {
    const nodes = {
      1: { depth: -1 },
      2: { depth: 0 },
      3: { depth: 1 },
    };
    expect(getRoot(nodes).children).toMatchObject({ 2: { depth: 0 } });
  });
});

describe('ancestorsFromNode', () => {
  const startIndex = 1;
  const nodes = {};
  buildNodesFromEntityEvents(user1, startIndex, nodes);
  const ordered = Object.keys(nodes).sort((a, b) => nodes[a].depth - nodes[b].depth);

  it('should be defined', () => {
    expect(ancestorsFromNode).toBeDefined();
  });

  it('should return events in root -> child order', () => {
    const key = ordered[ordered.length - 1];
    const leaf = nodes[key];
    const expectedEvents = ordered.slice(startIndex).map(k => nodes[k]);

    expect(ancestorsFromNode(leaf)).toEqual(expectedEvents);
  });

  it('should work for negative-depth nodes', () => {
    const negativeKey = ordered[0];
    const negativeNode = nodes[negativeKey];
    const expectedEvents = ordered
      .slice(0, startIndex + 1)
      .map(k => nodes[k])
      .reverse();

    expect(ancestorsFromNode(negativeNode)).toEqual(expectedEvents);
  });

  it('should return just the node if it is a root node', () => {
    const key = ordered[startIndex];
    const root = nodes[key];

    expect(ancestorsFromNode(root)).toEqual([root]);
  });
});

describe('buildGraph', () => {
  it('should be defined', () => {
    expect(buildGraph).toBeDefined();
  });

  it('should return a graph with root, nodes, entityEvents, filtered, and metaData keys', () => {
    const graph = buildGraph({ cleanedEvents: [...user1, ...user2] });
    expect(graph).toEqual(
      expect.objectContaining({
        root: expect.any(Object),
        nodes: expect.any(Object),
        entityEvents: expect.any(Object),
        filtered: expect.any(Number),
        metaData: expect.any(Object),
      }),
    );
  });
});
