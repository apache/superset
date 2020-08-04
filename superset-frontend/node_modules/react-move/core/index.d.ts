import * as React from "react";

/**
 * Timing must be placed on the "timing" key in the transition.
 */
export interface Timing {
  delay?: number;
  duration?: number;
  ease?: (t: number) => number;
}

/**
 * Events must be placed on the "events" key in the transition.
 */
export interface Events {
  start?: () => void;
  interrupt?: () => void;
  end?: () => void;
}

export interface CustomInterpolator {
  (t: number): any;
}

export interface NameSpace {
  [key: string]: Array<number> | Array<string> | number | string | CustomInterpolator ;
}

export interface Transition {
  [key: string]: Array<number> | Array<string> | number | string | CustomInterpolator | NameSpace | Events | Timing;
}

export interface TransitionFunction {
  (): Transition | Array<Transition>;
}

export interface PlainObject {
  [key: string]: number | string | PlainObject;
}

export interface PlainObjectFunction {
  (): PlainObject;
}
