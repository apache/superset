import {SignalRef} from 'vega';

export type Rename = (oldSignalName: string) => string;

/**
 * A class that behaves like a SignalRef but lazily generates the signal.
 * The provided generator function should use `Model.getSignalName` to use the correct signal name.
 */
export class SignalRefWrapper implements SignalRef {
  constructor(exprGenerator: () => string) {
    Object.defineProperty(this, 'signal', {
      enumerable: true,
      get: exprGenerator
    });
  }

  public signal: string; // for ts

  public static fromName(rename: Rename, signalName: string) {
    return new SignalRefWrapper(() => rename(signalName));
  }
}
