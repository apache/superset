/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * A global `moduleNameMapper` stand-in for the real `gridstack` package
 * (wired in `jest.config.js`) — jsdom has no layout engine, so the real
 * `GridStack.init` cannot run in a test at all (it measures the container).
 * Every test that mounts `RootGrid` goes through this, not just
 * `RootGrid.test.tsx` itself.
 *
 * Mimics only the surface `useGridStack.ts` actually calls, plus a
 * `__trigger` escape hatch a test uses to fire the gesture-end callbacks a
 * real drag/resize would otherwise fire — there is no synthetic drag in
 * jsdom to produce those for us.
 */
export interface MockGridStackNode {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface MockGridItemHTMLElement extends HTMLElement {
  gridstackNode?: MockGridStackNode;
}

type Handler = (event: Event, el: MockGridItemHTMLElement) => void;

export class MockGridStack {
  static instances: MockGridStack[] = [];

  options: Record<string, unknown>;

  container: HTMLElement;

  private handlers: Record<string, Handler[]> = {};

  private items: MockGridItemHTMLElement[] = [];

  static init(
    options: Record<string, unknown>,
    container: HTMLElement,
  ): MockGridStack {
    const grid = new MockGridStack(options, container);
    MockGridStack.instances.push(grid);
    return grid;
  }

  constructor(options: Record<string, unknown>, container: HTMLElement) {
    this.options = options;
    this.container = container;
  }

  on = jest.fn((event: string, cb: Handler) => {
    (this.handlers[event] ||= []).push(cb);
  });

  makeWidget = jest.fn(
    (el: MockGridItemHTMLElement, node: MockGridStackNode) => {
      el.gridstackNode = { ...node };
      if (!this.items.includes(el)) this.items.push(el);
      return el;
    },
  );

  update = jest.fn(
    (el: MockGridItemHTMLElement, node: Partial<MockGridStackNode>) => {
      el.gridstackNode = { ...el.gridstackNode, ...node };
    },
  );

  removeWidget = jest.fn((el: MockGridItemHTMLElement) => {
    this.items = this.items.filter(item => item !== el);
  });

  batchUpdate = jest.fn();

  column = jest.fn((count: number) => {
    this.options.column = count;
  });

  margin = jest.fn();

  cellHeight = jest.fn();

  getGridItems = jest.fn((): MockGridItemHTMLElement[] => this.items);

  destroy = jest.fn();

  /** Fires every callback registered for `event` via `on`, as if `el` had just finished that gesture. */
  __trigger(event: string, el: MockGridItemHTMLElement): void {
    (this.handlers[event] ?? []).forEach(cb => cb({} as Event, el));
  }
}

export function __resetGridStackMock(): void {
  MockGridStack.instances = [];
}

/** The instance the most recent `RootGrid` mount created — there is exactly one per mounted grid. */
export function __getLastGridStackInstance(): MockGridStack | undefined {
  return MockGridStack.instances[MockGridStack.instances.length - 1];
}

export const GridStack = MockGridStack;
