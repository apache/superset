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
import { render, screen } from 'spec/helpers/testing-library';
import FilterDivider from './FilterDivider';

test('renders short title and description in vertical mode', () => {
  render(
    <FilterDivider title="Sample title" description="Sample description" />,
  );

  expect(screen.getByRole('heading', { name: 'Sample title' })).toBeVisible();
  expect(screen.getByText('Sample description')).toBeVisible();
});

test('renders long title and description in vertical mode', () => {
  render(
    <FilterDivider
      title="Sample title that is very long, it goes on and on and on and on and on"
      description="Sample description that is even longer, it goes on and on and on and on and on and on and on and on."
    />,
  );

  expect(
    screen.getByRole('heading', {
      name: 'Sample title that is very long, it goes on and on and on and on and on',
    }),
  ).toBeVisible();

  expect(
    screen.getByText(
      'Sample description that is even longer, it goes on and on and on and on and on and on and on and on.',
    ),
  ).toBeVisible();
});
