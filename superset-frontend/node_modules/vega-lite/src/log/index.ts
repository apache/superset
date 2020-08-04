/**
 * Vega-Lite's singleton logger utility.
 */

import {logger, LoggerInterface, Warn} from 'vega-util';
import * as message_ from './message';

export const message = message_;

/**
 * Main (default) Vega Logger instance for Vega-Lite.
 */
const main = logger(Warn);
let current: LoggerInterface = main;

/**
 * Logger tool for checking if the code throws correct warning.
 */
export class LocalLogger implements LoggerInterface {
  public warns: any[] = [];
  public infos: any[] = [];
  public debugs: any[] = [];

  public level() {
    return this;
  }

  public warn(...args: readonly any[]) {
    this.warns.push(...args);
    return this;
  }

  public info(...args: readonly any[]) {
    this.infos.push(...args);
    return this;
  }

  public debug(...args: readonly any[]) {
    this.debugs.push(...args);
    return this;
  }

  public error(...args: readonly any[]): this {
    throw Error(...args);
  }
}

export function wrap(f: (logger: LocalLogger) => void) {
  return () => {
    current = new LocalLogger();
    f(current as LocalLogger);
    reset();
  };
}

/**
 * Set the singleton logger to be a custom logger.
 */
export function set(newLogger: LoggerInterface) {
  current = newLogger;
  return current;
}

/**
 * Reset the main logger to use the default Vega Logger.
 */
export function reset() {
  current = main;
  return current;
}

export function warn(...args: readonly any[]) {
  current.warn(...args);
}

export function info(...args: readonly any[]) {
  current.info(...args);
}

export function debug(...args: readonly any[]) {
  current.debug(...args);
}
