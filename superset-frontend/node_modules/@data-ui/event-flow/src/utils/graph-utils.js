/* eslint no-param-reassign: 1 */
import { mean as d3Mean } from 'd3-array';

import { binEventsByEntityId, getEventUuid, getEventCountLookup } from './data-utils';

import {
  TS,
  TS0,
  TS_PREV,
  TS_NEXT,
  EVENT_NAME,
  EVENT_UUID,
  EVENT_COUNT,
  ELAPSED_MS,
  ELAPSED_MS_ROOT,
  FILTERED_EVENTS,
} from '../constants';

/*
 * Returns a unique node id for a given (eventName, depth) tuple
 */
export function getNodeId(eventName, depth) {
  return `${eventName}__${depth}`;
}

/*
 * Returns the node corresponding to the passed event and depth
 * Initializes the node if it doesn't already exist
 */
export function getNodeFromEvent(allNodes, id, eventName, depth) {
  const node = allNodes[id] || {
    // lazy init
    id,
    name: eventName,
    parent: null,
    children: {},
    events: {},
    depth,
    [EVENT_COUNT]: 0,
  };

  return node;
}

/*
 * Parses all events associcated with a single entity/user, building the graph
 * in the process
 */
export function buildNodesFromEntityEvents(events, startIndex, nodes) {
  // @todo refactor this to be more DRY
  let depth = 0;
  let index = startIndex;
  let firstNode = null;
  let tempNode = null;
  let currNode = null;
  let event;
  let eventName;
  let eventUuid;
  const ts0 = events[startIndex] && events[startIndex][TS];
  let nodeId = '';

  // traverse events >= starting index
  while (index < events.length) {
    event = events[index];
    eventName = event[EVENT_NAME];
    eventUuid = getEventUuid(event, index);
    nodeId += eventName;

    tempNode = getNodeFromEvent(nodes, nodeId, eventName, depth);
    tempNode.events[eventUuid] = event;
    event[EVENT_UUID] = eventUuid;
    event[TS0] = ts0;
    event[TS_PREV] = (events[index - 1] || {})[TS];
    event[TS_NEXT] = (events[index + 1] || {})[TS];
    event[ELAPSED_MS] = depth === 0 ? 0 : event[TS] - event[TS_PREV];
    event[ELAPSED_MS_ROOT] = event[TS] - ts0;

    tempNode.parent = currNode;
    if (currNode) currNode.children[tempNode.id] = tempNode;

    currNode = tempNode;
    firstNode = firstNode || currNode;
    nodes[currNode.id] = currNode;
    depth += 1;
    index += 1;
  }

  // traverse events < starting index
  nodeId = `-${(firstNode && firstNode.id) || ''}`;
  currNode = firstNode;
  index = startIndex - 1;
  depth = -1;
  while (index >= 0) {
    event = events[index];
    eventName = event[EVENT_NAME];
    eventUuid = getEventUuid(event, index);
    nodeId += eventName;

    tempNode = getNodeFromEvent(nodes, nodeId, eventName, depth);
    tempNode.events[eventUuid] = event;
    event[EVENT_UUID] = eventUuid;
    event[TS0] = ts0;
    event[TS_PREV] = (events[index - 1] || {})[TS];
    event[TS_NEXT] = (events[index + 1] || {})[TS];
    event[ELAPSED_MS] = event[TS] - event[TS_NEXT];
    event[ELAPSED_MS_ROOT] = event[TS] - ts0;

    tempNode.parent = currNode;
    if (currNode) currNode.children[tempNode.id] = tempNode;

    currNode = tempNode;
    nodes[currNode.id] = currNode;
    depth -= 1;
    index -= 1;
  }
}

/*
 * Recursively adds metadata attributes to the passed nodes, recurses on node.children:
 *  EVENT_COUNT
 *  ELAPSED_MS (mean)
 *  ELAPSED_MS_ROOT (mean)
 */
export function addMetaDataToNodes(nodes, allNodes) {
  if (!nodes || !Object.keys(nodes).length) return;

  Object.keys(nodes).forEach(id => {
    const node = nodes[id];
    node[EVENT_COUNT] = Object.keys(node.events || {}).length;
    node[ELAPSED_MS] = d3Mean(Object.values(node.events || {}), d => d[ELAPSED_MS]);

    /*
     * if you simply compute the mean of ELAPSED_MS_ROOT across all events,
     * leaf nodes may have am ELAPSED_MS_ROOT that is LESS than the leaf's parent node
     * eg parent node has 3 events:
     *    2 with very long elapsed to root + 1 with a shorter value -> long average
     *    if leaf node only includes the event with a shorter value -> less than parent avg
     *
     * building ELAPSED_MS_ROOT from the sum of ELAPSED_MS prevents this
     */
    if (node.parent) {
      node[ELAPSED_MS_ROOT] = node[ELAPSED_MS] + node.parent[ELAPSED_MS_ROOT];
    } else {
      node[ELAPSED_MS_ROOT] = d3Mean(Object.values(node.events || {}), d => d[ELAPSED_MS_ROOT]);
    }

    addMetaDataToNodes(node.children, allNodes); // recurse
  });
}

export function getRoot(nodes) {
  const children = Object.keys(nodes).filter(n => nodes[n] && nodes[n].depth === 0);
  const root = {};

  return Object.assign(root, {
    name: 'root',
    id: 'root',
    parent: null,
    depth: NaN,
    events: {},
    ELAPSED_MS_ROOT: 0,
    ELAPSED_MS: 0,
    children: children.reduce((result, currNodeKey) => {
      nodes[currNodeKey].parent = root;
      result[currNodeKey] = nodes[currNodeKey];

      return result;
    }, {}),
  });
}

/*
 * Iterates over all nodes and trims the graph of nodes with fewer
 * than the min specified event count.  * Specifically this function deletes all references to
 * such nodes in allNodes + and in node.childrenThis is useful for simplifying the vis + DOM perf.
 */
export function trimNodesByEventCount({
  allNodes,
  minEventCount = 1,
  metaData = {
    hiddenEvents: {},
    hiddenNodes: {},
  },
}) {
  if (!allNodes || Object.keys(allNodes).length === 0) return metaData;

  Object.entries(allNodes).forEach(([nodeName, node]) => {
    const count = node.events ? Object.keys(node.events).length : 0;
    if (count < minEventCount) {
      metaData.hiddenNodes[nodeName] = node;
      Object.assign(metaData.hiddenEvents, node.events);

      delete allNodes[nodeName];
      if (node.parent) delete node.parent.children[nodeName];
    }
  });

  return metaData;
}

/*
 * Parses raw events and builds a graph of 'aggregate' nodes.
 * raw events should be
 *    *cleaned* meaning they have ts, entity id, and event name keys
 *    in no particular order, they are binned by entity id and sorted by TS
 */
export function buildGraph({
  cleanedEvents,
  getStartIndex = () => 0,
  ignoreEventTypes = {},
  minEventCount,
}) {
  console.time('buildGraph');
  const nodes = {};
  const filteredEvents = {};

  // note this shallow copies
  const { entityEvents, ignoredEvents } = binEventsByEntityId(cleanedEvents, ignoreEventTypes);

  Object.keys(entityEvents).forEach(id => {
    const events = entityEvents[id];
    const initialEventIndex = getStartIndex(events);
    entityEvents[id].zeroIndex = initialEventIndex;
    if (initialEventIndex > -1 && typeof events[initialEventIndex] !== 'undefined') {
      buildNodesFromEntityEvents(events, initialEventIndex, nodes);
    } else {
      // keep a ref to all events so that event type meta data includes all events
      let i = 0;
      filteredEvents[id] = events.reduce((all, curr) => {
        all[i] = curr;
        i += 1;

        return all;
      }, {});
    }
  });

  const root = getRoot(nodes);
  addMetaDataToNodes(root.children, nodes);

  const { hiddenNodes, hiddenEvents } = trimNodesByEventCount({
    allNodes: nodes,
    minEventCount,
  });

  console.log(
    'hidden',
    Object.keys(hiddenNodes).length,
    'nodes',
    Object.keys(hiddenEvents).length,
    'events',
  );

  // given that a node size respresents an event count, the "filtered" node should
  // contain only one event / the root event for the filtered sequence
  const numFiltered = Object.keys(filteredEvents).length;

  if (numFiltered) {
    nodes[FILTERED_EVENTS] = {
      ...getNodeFromEvent(nodes, FILTERED_EVENTS, FILTERED_EVENTS, 0),
      [EVENT_COUNT]: numFiltered,
      [ELAPSED_MS]: 0,
      [ELAPSED_MS_ROOT]: 0,
      events: filteredEvents,
      parent: root,
    };

    root.children[FILTERED_EVENTS] = nodes[FILTERED_EVENTS];
  }

  root[EVENT_COUNT] = Object.keys(root.children).reduce(
    (sum, curr) => sum + nodes[curr][EVENT_COUNT],
    0,
  );

  const { eventCountLookup, eventCountTotal } = getEventCountLookup(root.children);

  console.timeEnd('buildGraph');

  return {
    root,
    nodes,
    entityEvents,
    filtered: numFiltered,
    metaData: {
      hiddenNodes,
      hiddenEvents: {
        ...hiddenEvents,
        ...ignoredEvents,
      },
      eventCountLookup,
      eventCountTotal,
      eventCountArray: Object.entries(eventCountLookup).map(([label, value]) => ({
        label,
        value,
      })),
    },
  };
}

/*
 * Given a node, returns an array of ancestors from the root to the node
 */
export function ancestorsFromNode(node) {
  let curr = node;
  const ancestors = [];
  while (curr && curr.id !== 'root') {
    ancestors.push(curr);
    curr = curr.parent;
  }

  return ancestors.reverse();
}
