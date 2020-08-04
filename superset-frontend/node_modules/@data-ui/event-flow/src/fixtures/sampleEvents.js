import { TS, EVENT_NAME, ENTITY_ID } from '../constants';

function intBetween(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

const eventNames = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const startDate = Number(new Date('2017-01-05'));

export function generateEvents({
  user,
  eventCardinality = 5,
  minEvents = 2,
  maxEvents = 20,
  minElapsedMs = 5000,
  maxElapsedMs = 1000 * 60 * 60 * 24, // 1 day
  eventNameLength = 10,
}) {
  const nEvents = intBetween(minEvents, maxEvents);
  const events = [];
  let currDate = startDate;
  for (let i = 0; i < nEvents; i += 1) {
    const elapsedMs = intBetween(minElapsedMs, maxElapsedMs);
    const eventIndex = intBetween(
      0,
      Math.random() < 0.7 ? eventCardinality - intBetween(1, eventCardinality) : eventCardinality,
    );
    const event = eventNames.slice(eventIndex, eventIndex + eventNameLength);

    currDate += elapsedMs;

    events.push({
      [ENTITY_ID]: user,
      [TS]: new Date(currDate),
      [EVENT_NAME]: event,
    });
  }

  return events;
}

export function generateEventsForUsers({
  nUsers = 5,
  minEvents = 2,
  maxEvents = 10,
  minElapsedMs = 1000 * 60,
  maxElapsedMs = 1000 * 60 * 60 * 24, // 1 day
  eventCardinality = 5,
}) {
  let allEvents = [];
  const userEvents = {};

  let user;
  for (let i = 0; i < nUsers; i += 1) {
    user = `user${i}`;

    const events = generateEvents({
      user,
      minEvents,
      maxEvents,
      minElapsedMs,
      maxElapsedMs,
      eventCardinality,
    });

    userEvents[user] = events;
    allEvents = allEvents.concat(events);
  }

  return { userEvents, allEvents };
}

export default {
  twentyUsers: generateEventsForUsers({ nUsers: 20 }),
  fiftyUsers: generateEventsForUsers({ nUsers: 50 }),
  hundredUsers: generateEventsForUsers({ nUsers: 100 }),
  variableLength: generateEventsForUsers({
    nUsers: 50,
    maxElapsedMs: 5 * 1000 * 60 * 60 * 24,
  }),
  manyEvents: generateEventsForUsers({
    nUsers: 50,
    minEvents: 10,
    maxEvents: 30,
  }),
  manyEventTypes: generateEventsForUsers({ nUsers: 50, eventCardinality: 15 }),
};
