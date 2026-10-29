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
import { KeyboardEvent } from 'react';

/**
 * Builds an `onKeyDown` handler that invokes `callback` when the user presses
 * Enter or Space, mirroring a click for keyboard users. Pair it with an
 * element's `onClick` so `role="button"` (or similar) controls are operable
 * from the keyboard, satisfying `jsx-a11y/click-events-have-key-events`.
 *
 *   <div role="button" onClick={handleClick}
 *        onKeyDown={handleKeyboardActivation(handleClick)} />
 */
export function handleKeyboardActivation(
  callback: (event: KeyboardEvent) => void,
) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      // Prevent the page from scrolling on Space and stop any duplicate
      // default activation on Enter.
      event.preventDefault();
      // Ignore auto-repeat keydown events fired while the key is held, so
      // a long press activates the callback once, matching a mouse click.
      if (event.repeat) {
        return;
      }
      callback(event);
    }
  };
}

export default handleKeyboardActivation;
