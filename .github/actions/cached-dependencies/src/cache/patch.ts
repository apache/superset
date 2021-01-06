/**
 * Monkey patch to safely import and use @action/cache modules
 */
import * as utils from '@actions/cache/src/utils/actionUtils';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import { InputName } from '../constants';
import { getInput } from '../utils/inputs';

interface KeyValueStore {
  [key: string]: any;
}

const { logWarning, isValidEvent } = utils;
const { getState, saveState } = core;

function getStateStoreFile() {
  const cacheName = getInput(InputName.Key);
  return `${os.tmpdir()}/cached-${cacheName}-states.json`;
}

/**
 * Load states from the persistent store.
 *
 * The default `core.saveState` only writes states as command output, and
 * `core.getState` is only possible to read the state in a later step via ENV
 * variables.
 *
 * So we use a temp file to save and load states, so to allow persistent
 * states within the same step.
 *
 * Since the state output is not uniq to caches, each cache should have their
 * own file for persistent states.
 */
function loadStates() {
  const stateStore = getStateStoreFile();
  const states: KeyValueStore = {};
  try {
    Object.assign(
      states,
      JSON.parse(fs.readFileSync(stateStore, { encoding: 'utf-8' })),
    );
    core.debug(`Loaded states from: ${stateStore}`)
  } catch (error) {
    // pass
    if (error.code !== 'ENOENT') {
      utils.logWarning(`Could not load states: ${stateStore}`)
      utils.logWarning(error.message);
    }
  }
  return states;
}

/**
 * Save states to the persistent storage.
 */
function persistState(name: string, value: any) {
  const states = loadStates();
  const stateStore = getStateStoreFile();
  const valueString = typeof value === 'string' ? value : JSON.stringify(value);

  // make sure value is always string
  states[name] = valueString;

  // persist state in the temp file
  fs.writeFileSync(stateStore, JSON.stringify(states, null, 2), {
    encoding: 'utf-8',
  });
  core.debug(`Persist state "${name}=${valueString}" to ${stateStore}`);

  // still pass the original value to the original function, though
  return saveState(name, value);
}

/**
 * Get states from persistent store, fallback to "official" states.
 */
function obtainState(name: string) {
  const states = loadStates();
  return states[name] || getState(name);
}

export function beginImport() {
  Object.defineProperty(utils, 'isValidEvent', { value: () => false });
  Object.defineProperty(utils, 'logWarning', { value: () => {} });
}

export function doneImport() {
  Object.defineProperty(utils, 'isValidEvent', { value: isValidEvent });
  Object.defineProperty(utils, 'logWarning', { value: logWarning });

  Object.defineProperty(core, 'saveState', { value: persistState });
  Object.defineProperty(core, 'getState', { value: obtainState });
}
