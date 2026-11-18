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

import { act, renderHook, waitFor } from '@testing-library/react';
import useFrameLink from '../src/frames/useFrameLink';

test('a frame that never starts gets one new link, then an error', async () => {
  const fetchLink = vi
    .fn<() => Promise<string>>()
    .mockResolvedValueOnce('first link')
    .mockResolvedValueOnce('second link');
  const { result } = renderHook(() => useFrameLink(fetchLink, 'artifact'));
  await waitFor(() => expect(result.current.link).toBe('first link'));

  act(() => result.current.onHandshakeTimeout());
  await waitFor(() => expect(result.current.link).toBe('second link'));
  act(() => result.current.onHandshakeTimeout());

  expect(result.current.link).toBeUndefined();
  expect(result.current.error).toMatch(/did not start/);
  expect(fetchLink).toHaveBeenCalledTimes(2);
});

test('a reload starts the count of timeouts again', async () => {
  const fetchLink = vi.fn<() => Promise<string>>().mockResolvedValue('a link');
  const { result } = renderHook(() => useFrameLink(fetchLink, 'artifact'));
  await waitFor(() => expect(result.current.link).toBe('a link'));

  act(() => result.current.onHandshakeTimeout());
  await waitFor(() => expect(fetchLink).toHaveBeenCalledTimes(2));
  act(() => result.current.reload());
  await waitFor(() => expect(fetchLink).toHaveBeenCalledTimes(3));
  act(() => result.current.onHandshakeTimeout());

  await waitFor(() => expect(fetchLink).toHaveBeenCalledTimes(4));
  expect(result.current.error).toBeUndefined();
});
