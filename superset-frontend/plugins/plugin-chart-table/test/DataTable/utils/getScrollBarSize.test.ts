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
import getScrollBarSize, {
  CUSTOM_SCROLLBAR_SIZE,
  getCustomScrollBarSize,
} from '../../../src/DataTable/utils/getScrollBarSize';

test('getScrollBarSize measures the native scrollbar without any custom styling probe', () => {
  const appendSpy = jest.spyOn(document.head, 'append');

  getScrollBarSize(true);

  expect(appendSpy).not.toHaveBeenCalled();

  appendSpy.mockRestore();
});

test('getCustomScrollBarSize measures the probe using the shared custom scrollbar size', () => {
  const appendSpy = jest.spyOn(document.head, 'append');

  getCustomScrollBarSize(true);

  const styleEl = appendSpy.mock.calls
    .map(args => args[0])
    .find((node): node is HTMLStyleElement => node instanceof HTMLStyleElement);
  expect(styleEl?.textContent).toContain(`width: ${CUSTOM_SCROLLBAR_SIZE}px`);

  appendSpy.mockRestore();
});

test('CUSTOM_SCROLLBAR_SIZE matches the custom scrollbar width rendered in the sticky table', () => {
  // useSticky.tsx's scrollBarStyles must stay in sync with this constant so
  // the sticky header's shrink amount always matches the body's real
  // scrollbar width.
  expect(CUSTOM_SCROLLBAR_SIZE).toBe(8);
});
