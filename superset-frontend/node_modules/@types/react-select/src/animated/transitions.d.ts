import * as React from 'react';
import { Transition } from 'react-transition-group';

export type fn = () => void;
export interface BaseTransition {
  /** Whether we are in a transition. */
  in: boolean;
  /** Function to be called once transition finishes. */
  onExited: fn;
}

// ==============================
// Fade Transition
// ==============================

export type FadeProps = BaseTransition & {
  component: React.ComponentType<any>,
  duration: number,
};
export const Fade: React.ComponentType<FadeProps>;

// ==============================
// Collapse Transition
// ==============================

export const collapseDuration: number;

export type TransitionState = 'exiting' | 'exited';
export type Width = number | 'auto';
export interface CollapseProps { children: any; in: boolean; }
export interface CollapseState { width: Width; }

// wrap each MultiValue with a collapse transition; decreases width until
// finally removing from DOM
export class Collapse extends React.Component<CollapseProps, CollapseState> {
  duration: number;
  transition: {
    exiting: any,
    exited: any,
  };

  // width must be calculated; cannot transition from `undefined` to `number`
  getWidth: (ref: React.Ref<any>) => void;

  // get base styles
  getStyle: (width: Width) => any;

  // get transition styles
  getTransition: (state: TransitionState) => any;
}
