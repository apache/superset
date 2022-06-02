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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Loading from './index';

test('Rerendering correctly with default props', () => {
  render(<Loading />);
  const loading = screen.getByRole('status');
  const classNames = loading.getAttribute('class')?.split(' ');
  const imagePath = loading.getAttribute('src');
  const ariaLive = loading.getAttribute('aria-live');
  const ariaLabel = loading.getAttribute('aria-label');
  expect(loading).toBeInTheDocument();
  expect(imagePath).toBe('/static/assets/images/loading.gif');
  expect(classNames).toContain('floating');
  expect(classNames).toContain('loading');
  expect(ariaLive).toContain('polite');
  expect(ariaLabel).toContain('Loading');
});

test('Position must be a class', () => {
  render(<Loading position="normal" />);
  const loading = screen.getByRole('status');
  const classNames = loading.getAttribute('class')?.split(' ');
  expect(loading).toBeInTheDocument();
  expect(classNames).not.toContain('floating');
  expect(classNames).toContain('normal');
});

test('support for extra classes', () => {
  render(<Loading className="extra-class" />);
  const loading = screen.getByRole('status');
  const classNames = loading.getAttribute('class')?.split(' ');
  expect(loading).toBeInTheDocument();
  expect(classNames).toContain('loading');
  expect(classNames).toContain('floating');
  expect(classNames).toContain('extra-class');
});

test('Diferent image path', () => {
  render(<Loading image="/src/assets/images/loading.gif" />);
  const loading = screen.getByRole('status');
  const imagePath = loading.getAttribute('src');
  expect(loading).toBeInTheDocument();
  expect(imagePath).toBe('/src/assets/images/loading.gif');
});
