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
import { act } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { renderHook } from '@testing-library/react';
import { useDraftToken } from './useDraftToken';

/**
 * `BrowserRouter`, not `MemoryRouter`: the hook reads the token from
 * `window.location.hash`, which an in-memory history never touches. The app
 * runs on a browser router, where the router and the address bar agree.
 */
const atHash = (hash: string) => {
  window.location.hash = hash;
  return renderHook(() => useDraftToken(), {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
  });
};

afterEach(() => {
  window.location.hash = '';
});

test('the token is read from the url fragment', () => {
  const { result } = atHash('#draft=tok-123');

  expect(result.current.token).toBe('tok-123');
});

test('no fragment means no draft is open', () => {
  expect(atHash('').result.current.token).toBeUndefined();
  // A fragment that isn't a draft token is ignored.
  expect(atHash('#other=1').result.current.token).toBeUndefined();
});

test('opening a draft exposes its token straight away', () => {
  // Replacing the hash fires no `hashchange`, so the hook cannot rely on the
  // listener alone -- the token has to be set when `open` is called.
  const { result } = atHash('');

  act(() => result.current.open('tok-456'));

  expect(result.current.token).toBe('tok-456');
  // And in the url, which is what makes a plan shareable and survive a
  // refresh: hook state alone would be lost on reload.
  expect(window.location.hash).toBe('#draft=tok-456');
});

test('clearing closes the draft', () => {
  const { result } = atHash('#draft=tok-123');

  act(() => result.current.clear());

  expect(result.current.token).toBeUndefined();
});
