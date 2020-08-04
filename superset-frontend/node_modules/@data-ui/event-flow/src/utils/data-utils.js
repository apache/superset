/* eslint no-param-reassign: 0 */
import { TS, ENTITY_ID, EVENT_NAME, META, FILTERED_EVENTS } from '../constants';

/*
 * Creates an event with standard shape from a raw record/event object
 */
export function createEvent(rawEvent, accessors) {
  return {
    [TS]: accessors[TS](rawEvent),
    [EVENT_NAME]: accessors[EVENT_NAME](rawEvent),
    [ENTITY_ID]: accessors[ENTITY_ID](rawEvent),
    [META]: Object.entries(rawEvent).reduce((result, [key, value]) => {
      try {
        // try to parse json for ease of parsing downstream
        result[key] = JSON.parse(value);
      } catch (e) {
        result[key] = value;
      }

      return result;
    }, {}),
  };
}

/*
 * Returns a unique node id for a given (eventId, depth) tuple
 */
export function getEventUuid(event, index) {
  return `${event[EVENT_NAME]}__${index}__${event[ENTITY_ID]}`;
}

/*
 * Event comparator for sorting events
 */
function eventSortComparator(a, b) {
  return a[TS] - b[TS];
}

/*
 * Bins all events in the passed array by entity Id.
 * **note** that this method shallow copies all events
 *
 * @param {Array} array of events
 *
 */
export function binEventsByEntityId(events, ignoreEventTypes = {}) {
  const entityEvents = {};
  const ignoredEvents = {};

  events.forEach(event => {
    const type = event[EVENT_NAME];
    const id = event[ENTITY_ID];

    if (ignoreEventTypes[type]) {
      ignoredEvents[id] = event;
    } else {
      entityEvents[id] = entityEvents[id] || [];
      entityEvents[id].push({ ...event });
    }
  });

  return { entityEvents, ignoredEvents };
}

/*
 * Maps raw events to a consistent shape and sorts them by TS
 *
 * Accessors should be an object with the following shape:
 *  {
 *   [TS]: fn(e) => date, the ts of the event
 *   [EVENT_NAME]: fn(e) => name,
 *   [ENTITY_ID]: fn(e) => id,
 *  }
 */
export function cleanEvents(rawEvents, accessors) {
  return rawEvents.map(event => createEvent(event, accessors)).sort(eventSortComparator);
}

/*
 * Returns the index for the Nth occurence (1-index-based)
 * of elements that passes the passed filter fn. If n is negative, will return
 * the index of the Nth occurence relative to the end of the array
 *
 * @param {Array<any>} array, array to find element within
 * @param {number} n, the 1-index based occurrence of the element of interest
 * @param {fn(element) => bool} filter, the function to test if an element matches
 */
export function findNthIndexOfX(array, n = 1, filter) {
  if (n < 0) {
    const revIndex = findNthIndexOfX([...array].reverse(), -n, filter);

    return revIndex === -1 ? -1 : array.length - 1 - revIndex;
  }
  let occurrences = 0;

  return array.findIndex(event => {
    if (filter(event)) {
      occurrences += 1;
      if (occurrences === n) {
        return true;
      }

      return false;
    }

    return false;
  });
}

/*
 * Given a node, returns all events from all entities included in the node
 */
export function collectSequencesFromNode(node, entityEvents) {
  const entitiesSeen = {};
  const sequences = [];

  if (node && node.events) {
    Object.keys(node.events).forEach(eventId => {
      const event = node.events[eventId];
      const entityId = event.ENTITY_ID;
      if (!entitiesSeen[entityId]) {
        sequences.push(entityEvents[entityId]); // push all events from this entity
        entitiesSeen[entityId] = true;
      }
    });
  }

  return sequences;
}

function recursivelyCountEvents(nodes, eventCounts = {}) {
  if (!nodes || Object.keys(nodes).length === 0) return;
  Object.entries(nodes).forEach(([nodeName, node]) => {
    if (node.events && Object.keys(node.events).length > 0) {
      Object.values(node.events).forEach(event => {
        const name = nodeName === FILTERED_EVENTS ? FILTERED_EVENTS : event[EVENT_NAME];

        eventCounts[name] = eventCounts[name] || 0;
        eventCounts[name] +=
          nodeName === FILTERED_EVENTS ? Object.keys(Object.values(event)).length : 1;
      });
      recursivelyCountEvents(node.children, eventCounts);
    }
  });
}

/*
 * Recursively traverses the graph from the starting node, counting events by type along the way
 * Returns the following meta data:
 *    countLookup: {Object} EVENT_NAME: count
 *    countArray: {Array<Object>} array of { label, value }
 *    countTotal: {Number}
 *
}
 */
export function getEventCountLookup(nodes) {
  const eventCountLookup = {};
  recursivelyCountEvents(nodes, eventCountLookup);
  const eventCountTotal = Object.values(eventCountLookup).reduce((sum, curr) => sum + curr, 0);

  return {
    eventCountTotal,
    eventCountLookup,
  };
}
