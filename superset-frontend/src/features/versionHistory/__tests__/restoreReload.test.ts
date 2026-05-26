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
import { reloadStrippingVersionUuid } from '../utils/restoreReload';

describe('reloadStrippingVersionUuid', () => {
  const originalLocation = window.location;
  const originalReplaceState = window.history.replaceState;
  let reloadSpy: jest.Mock;
  let replaceStateSpy: jest.Mock;

  beforeEach(() => {
    reloadSpy = jest.fn();
    replaceStateSpy = jest.fn();
    // jsdom's location.reload is non-writable; replace the whole object.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        href: 'http://example.test/explore?slice_id=7&version_uuid=abc',
        reload: reloadSpy,
      },
    });
    window.history.replaceState = replaceStateSpy;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    window.history.replaceState = originalReplaceState;
  });

  test('strips ?version_uuid synchronously and then reloads', () => {
    reloadStrippingVersionUuid();
    // replaceState fired BEFORE reload, with the param removed.
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    const [, , newUrl] = replaceStateSpy.mock.calls[0];
    expect(newUrl).not.toContain('version_uuid');
    expect(newUrl).toContain('slice_id=7');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    // Order: replaceState first, then reload.
    expect(replaceStateSpy.mock.invocationCallOrder[0]).toBeLessThan(
      reloadSpy.mock.invocationCallOrder[0],
    );
  });

  test('still reloads when the URL has no version_uuid', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        href: 'http://example.test/explore?slice_id=7',
        reload: reloadSpy,
      },
    });
    reloadStrippingVersionUuid();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
