import moment from 'moment';
import uuidv4 from 'uuid/v4';

import { LOCAL_STORAGE_SESSIONS_KEY,
  LOCAL_STORAGE_KEY_PREFIX, MAX_NUM_SESSIONS } from './constants';

export function getSessions() {
  let sessions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_SESSIONS_KEY));
  if (!Array.isArray(sessions)) {
    sessions = [];
  } else {
    sessions = sessions.filter(x => !!x && !!x.ts).sort((a, b) => b.ts - a.ts);
  }
  return sessions;
}

function saveSessions(sessions) {
  localStorage.setItem(LOCAL_STORAGE_SESSIONS_KEY, JSON.stringify(sessions));
  return sessions;
}

function cleanup(sessions) {
  // Cleanup old sessions
  Object.keys(localStorage)
      .filter(x => x.startsWith(LOCAL_STORAGE_KEY_PREFIX) &&
          !sessions.find(s => `${LOCAL_STORAGE_KEY_PREFIX}${s.id}` === x))
      .forEach(x => localStorage.removeItem(x));
  saveSessions(sessions);
}

export function deleteSessions() {
  cleanup([]);
}

export function deleteSession(id) {
  const sessions = getSessions();
  cleanup(sessions.filter(x => x.id !== id));
}

export function createNewSession(name, id) {
  let sessions = getSessions();
  if (sessions.length > MAX_NUM_SESSIONS) {
    localStorage.removeItem(sessions[sessions.length - 1]);
    sessions.pop();
  }
  const newSession = { ts: moment.now(), id: id || uuidv4(), name };
  sessions = [newSession, ...sessions];
  cleanup(sessions);
  return newSession;
}

export function updateSession(id, name) {
  const sessions = getSessions();
  let session = sessions.find(x => x.id === id);
  if (session) {
    session.name = name || session.name;
    session.ts = moment.now();
    saveSessions(sessions);
  } else {
    session = createNewSession(name, id);
  }
  window.document.title = `Swivel - ${session.name} (${session.id.substring(0, 7)})`;
}

export function getSessionKey(bootstrapData) {
  let swivelSession = null;
  const sessions = getSessions();

  const createNew = bootstrapData.new ||
      bootstrapData.reset ||
      bootstrapData.lz_form_data ||
      bootstrapData.form_data;

  const now = moment.now();
  // Read the current session from Local Storage
  if (bootstrapData.session &&
      sessions.find(x => x.id === bootstrapData.session)) {
    // Session was passed in with bootstrapData
    const s = sessions.find(x => x.id === bootstrapData.session);
    s.ts = now;
    swivelSession = s.id;
  } else if (sessions.length && !createNew) {
    // Get the most recent session.
    const s = sessions[0];
    swivelSession = s.id;
    s.ts = now;
  }

  // Create a new Session
  if (!swivelSession || createNew) {
    swivelSession = createNewSession('').id;
  } else {
    saveSessions(sessions);
  }

  window.history.pushState('', '', `${location.pathname}?session=${swivelSession}`);
  return swivelSession;
}
