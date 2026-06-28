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

import { embedDashboard } from './index';
import { Switchboard } from '@superset-ui/switchboard';

jest.mock('@superset-ui/switchboard');

function makeFakeJWT(claims: any) {
  // not a valid jwt, but close enough for this code
  const tokenifiedClaims = Buffer.from(JSON.stringify(claims)).toString(
    'base64',
  );
  return `abc.${tokenifiedClaims}.xyz`;
}

describe('embedDashboard', () => {
  let mountPoint: HTMLElement;
  let mockSwitchboard: jest.Mocked<Switchboard>;

  beforeEach(() => {
    mountPoint = document.createElement('div');
    document.body.appendChild(mountPoint);

    mockSwitchboard = {
      emit: jest.fn(),
      get: jest.fn(),
      start: jest.fn(),
      defineMethod: jest.fn(),
    } as any;

    (Switchboard as jest.MockedClass<typeof Switchboard>).mockImplementation(
      () => mockSwitchboard,
    );

    // Mock MessageChannel API
    global.MessageChannel = jest.fn().mockImplementation(() => ({
      port1: {},
      port2: {},
    })) as any;

    // Mock iframe load event and sandbox
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'iframe') {
        // Mock sandbox DOMTokenList
        (element as any).sandbox = {
          add: jest.fn(),
        };
        // Mock contentWindow for postMessage
        Object.defineProperty(element, 'contentWindow', {
          writable: true,
          value: {
            postMessage: jest.fn(),
          },
        });
        setTimeout(() => {
          element.dispatchEvent(new Event('load'));
        }, 0);
      }
      return element;
    });
  });

  afterEach(() => {
    document.body.removeChild(mountPoint);
    jest.restoreAllMocks();
  });

  test('setDataMask emits dataMask to iframe', async () => {
    const fakeToken = makeFakeJWT({ exp: Date.now() / 1000 + 300 });
    const mockFetchGuestToken = jest.fn().mockResolvedValue(fakeToken);
    const testDataMask = {
      'NATIVE_FILTER-1': {
        filterState: {
          value: ['value1', 'value2'],
        },
      },
    };

    const dashboard = await embedDashboard({
      id: 'test-id',
      supersetDomain: 'https://superset.example.com',
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    dashboard.setDataMask(testDataMask);

    expect(mockSwitchboard.emit).toHaveBeenCalledWith('setDataMask', {
      dataMask: testDataMask,
    });
  });

  test('setDataMask emits empty dataMask', async () => {
    const fakeToken = makeFakeJWT({ exp: Date.now() / 1000 + 300 });
    const mockFetchGuestToken = jest.fn().mockResolvedValue(fakeToken);
    const emptyDataMask = {};

    const dashboard = await embedDashboard({
      id: 'test-id',
      supersetDomain: 'https://superset.example.com',
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    dashboard.setDataMask(emptyDataMask);

    expect(mockSwitchboard.emit).toHaveBeenCalledWith('setDataMask', {
      dataMask: emptyDataMask,
    });
  });

  test('setDataMask emits complex dataMask with multiple filters', async () => {
    const fakeToken = makeFakeJWT({ exp: Date.now() / 1000 + 300 });
    const mockFetchGuestToken = jest.fn().mockResolvedValue(fakeToken);
    const complexDataMask = {
      'NATIVE_FILTER-1': {
        filterState: {
          value: ['CA', 'NY'],
        },
      },
      'NATIVE_FILTER-2': {
        filterState: {
          value: [2023, 2024],
        },
      },
    };

    const dashboard = await embedDashboard({
      id: 'test-id',
      supersetDomain: 'https://superset.example.com',
      mountPoint,
      fetchGuestToken: mockFetchGuestToken,
    });

    dashboard.setDataMask(complexDataMask);

    expect(mockSwitchboard.emit).toHaveBeenCalledWith('setDataMask', {
      dataMask: complexDataMask,
    });
  });
});
