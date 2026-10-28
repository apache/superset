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
import { fireEvent } from './testing-library';

/** Dispatch pointer metadata even when JSDOM does not implement PointerEvent. */
export const pointerEvent = (
  type: string,
  target: Element,
  pointerId = 1,
  pointerType = 'mouse',
) =>
  fireEvent(
    target,
    Object.assign(
      new MouseEvent(type, { bubbles: true, cancelable: true, detail: 1 }),
      { pointerId, pointerType },
    ),
  );

/** Dispatch a compatibility click with no pointer identity, as a MouseEvent. */
export const mouseClick = (target: Element) =>
  fireEvent(
    target,
    new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }),
  );

/** Emulate a native button's Enter default action unless it was prevented. */
export const keyDown = (target: HTMLElement, key: string, repeat = false) => {
  if (fireEvent.keyDown(target, { key, repeat }) && key === 'Enter') {
    fireEvent.click(target, { detail: 0 });
  }
};

/** Emulate a native button's Space default action unless it was prevented. */
export const keyUp = (target: HTMLElement, key: string) => {
  if (fireEvent.keyUp(target, { key }) && key === ' ') {
    fireEvent.click(target, { detail: 0 });
  }
};
