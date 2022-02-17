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
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/dom';
import { render } from '@testing-library/react';
import fetchMock from 'fetch-mock';

jest.useFakeTimers();

import { useWindowActivatedAuthCheck } from './useWindowActivatedAuthCheck';

const HookTester = () => {
  useWindowActivatedAuthCheck();
  return <>hook tester</>;
};

describe('useWindowActivatedAuthCheck', () => {
  beforeEach(() => {
    // jsdom doesn't support window location, so just gonna fake it here real simple-like
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://example.com/fake-test-page',
        pathname: '/fake-test-page',
        search: '?foo=bar',
      },
      writable: true,
    });
  });

  afterEach(() => {
    fetchMock.restore();
  });

  it('redirects when the user tabs back after logging out elsewhere', async () => {
    fetchMock.get('glob:*/api/v1/me/', { status: 401 });

    render(<HookTester />);

    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => {
      expect(window.location.href).toEqual(
        '/login?next=/fake-test-page?foo=bar',
      );
    });
  });

  it('does not redirect if the user is still logged in', async () => {
    fetchMock.get('glob:*/api/v1/me/', {
      status: 200,
      json: { username: 'test_user' },
    });

    render(<HookTester />);

    fireEvent(document, new Event('visibilitychange'));

    await jest.runAllTimers();

    expect(window.location.href).toEqual('http://example.com/fake-test-page');
  });
});
