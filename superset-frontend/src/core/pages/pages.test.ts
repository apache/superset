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
import { act, renderHook } from '@testing-library/react';
import { logging } from '@apache-superset/core/utils';
import { pages, usePage } from 'src/core';

const PAGE = 'extensions.acme.reports.report';
const Report = () => null;

test('pages register and unregister by id', () => {
  const registration = pages.registerPage(PAGE, Report);

  expect(pages.getPage(PAGE)).toBe(Report);

  registration.dispose();

  expect(pages.getPage(PAGE)).toBeUndefined();
});

test('replacing a page warns, and disposing the old one keeps the new', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation();
  const Other = () => null;
  const first = pages.registerPage(PAGE, Report);
  const second = pages.registerPage(PAGE, Other);

  first.dispose();

  expect(pages.getPage(PAGE)).toBe(Other);
  expect(warn).toHaveBeenCalledWith(
    `Page "${PAGE}" already has a component. Replacing it.`,
  );
  second.dispose();
  warn.mockRestore();
});

test('registering the same page again does not warn', () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation();
  const first = pages.registerPage(PAGE, Report);
  const again = pages.registerPage(PAGE, Report);

  expect(warn).not.toHaveBeenCalled();
  again.dispose();
  first.dispose();
  warn.mockRestore();
});

test('usePage follows the page as it registers and goes', () => {
  const { result } = renderHook(() => usePage(PAGE));
  expect(result.current).toBeUndefined();

  let registration = { dispose: () => {} };
  act(() => {
    registration = pages.registerPage(PAGE, Report);
  });
  expect(result.current).toBe(Report);

  act(() => registration.dispose());
  expect(result.current).toBeUndefined();
});
