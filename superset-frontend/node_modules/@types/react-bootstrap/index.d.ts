// Type definitions for react-bootstrap 0.32
// Project: https://github.com/react-bootstrap/react-bootstrap, https://react-bootstrap.github.io
// Definitions by: Walker Burgin <https://github.com/walkerburgin>,
//                 Vincent Siao <https://github.com/vsiao>,
//                 Danilo Barros <https://github.com/danilojrr>,
//                 Batbold Gansukh <https://github.com/Batbold-Gansukh>,
//                 Raymond May Jr. <https://github.com/octatone>,
//                 Cheng Sieu Ly <https://github.com/chengsieuly>,
//                 Mercedes Retolaza <https://github.com/mretolaza>,
//                 Kat Busch <https://github.com/katbusch>,
//                 Vito Samson <https://github.com/vitosamson>,
//                 Karol Janyst <https://github.com/LKay>
//                 Aaron Beall <https://github.com/aaronbeall>
//                 Johann Rakotoharisoa <https://github.com/jrakotoharisoa>
//                 Andrew Makarov <https://github.com/r3nya>
//                 Duong Tran <https://github.com/t49tran>
//                 Erik Zivkovic <https://github.com/bes>
//                 Collin Green <https://github.com/collingreen>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 2.8

import * as React from 'react';

export type Omit<T, K extends keyof T> = Pick<T, ({ [P in keyof T]: P } & { [P in K]: never } & { [x: string]: never, [x: number]: never })[keyof T]>;

export type Sizes = 'xs' | 'xsmall' | 'sm' | 'small' | 'medium' | 'lg' | 'large';

export interface SelectCallback extends React.EventHandler<any> {
  (eventKey: any, e: React.SyntheticEvent<{}>): void;
  /**
   * @deprecated
   * This signature is a hack so can still derive from HTMLProps.
   * It does not reflect the underlying event and should not be used.
   */
  (e: React.MouseEvent<{}>): void;
}

export interface TransitionCallbacks {
  onEnter?(node: HTMLElement): any;
  onEntered?(node: HTMLElement): any;
  onEntering?(node: HTMLElement): any;
  onExit?(node: HTMLElement): any;
  onExited?(node: HTMLElement): any;
  onExiting?(node: HTMLElement): any;
}

export * from './lib';
export as namespace ReactBootstrap;
