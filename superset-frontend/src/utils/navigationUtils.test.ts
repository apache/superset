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
jest.mock('./pathUtils', () => ({
  ensureAppRoot: (url: string) => url,
}));

let navigateTo: typeof import('./navigationUtils').navigateTo;
let assignMock: jest.Mock;
let locationSpy: jest.SpyInstance;

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers();
  ({ navigateTo } = await import('./navigationUtils'));
  assignMock = jest.fn();
  locationSpy = jest
    .spyOn(window, 'location', 'get')
    .mockReturnValue({ ...window.location, assign: assignMock } as Location);
});

afterEach(() => {
  locationSpy.mockRestore();
  jest.useRealTimers();
});

test('ignores a repeated assign to the same URL within the dedupe window', () => {
  navigateTo('/dashboard/new', { assign: true });
  navigateTo('/dashboard/new', { assign: true });

  expect(assignMock).toHaveBeenCalledTimes(1);
  expect(assignMock).toHaveBeenCalledWith('/dashboard/new');
});

test('assigns different URLs in quick succession', () => {
  navigateTo('/dashboard/new', { assign: true });
  navigateTo('/chart/add', { assign: true });

  expect(assignMock).toHaveBeenCalledTimes(2);
});

test('assigns the same URL again once the dedupe window has elapsed', () => {
  navigateTo('/dashboard/new', { assign: true });
  jest.advanceTimersByTime(1000);
  navigateTo('/dashboard/new', { assign: true });

  expect(assignMock).toHaveBeenCalledTimes(2);
});
