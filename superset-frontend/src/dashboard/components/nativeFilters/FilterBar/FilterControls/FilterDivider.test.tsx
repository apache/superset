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

/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect*"] }] */

import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import FilterDivider from './FilterDivider';

const SHORT_TITLE = 'Sample title';
const LONG_TITLE =
  'Sample title that is very long, it goes on and on and on and on and on and on and on';

const LONG_DESCRIPTION =
  'Sample description that is even longer, it goes on and on and on and on and on and on and on and on and on and on.';

test('vertical mode, short title', () => {
  render(<FilterDivider title={SHORT_TITLE} description="" />);
  const title = screen.getByRole('heading', { name: SHORT_TITLE });
  expect(title).toBeVisible();
  expect(title).toHaveTextContent(SHORT_TITLE);
});

test('vertical mode, long title and description', () => {
  render(<FilterDivider title={LONG_TITLE} description={LONG_DESCRIPTION} />);
  const title = screen.getByRole('heading', { name: LONG_TITLE });
  expect(title).toBeVisible();
  expect(title).toHaveTextContent(LONG_TITLE);
  const description = screen.getByTestId('divider-description');
  expect(description).toBeVisible();
  expect(description).toHaveTextContent(LONG_DESCRIPTION);
});

test('horizontal mode, short title', () => {
  render(<FilterDivider horizontal title={SHORT_TITLE} description="" />);
  const verticalRule = screen.getByTestId('divider-vertical-rule');
  expect(verticalRule).toBeVisible();
  const title = screen.getByRole('heading', { name: SHORT_TITLE });
  expect(title).toBeVisible();
  expect(title).toHaveTextContent(SHORT_TITLE);
  const descriptionIcon = screen.queryByTestId('divider-description-icon');
  expect(descriptionIcon).not.toBeInTheDocument();
});

test.todo('horizontal mode, long title');
test.todo('horizontal mode, short title and description');
test.todo('horizontal mode, long title and description');
test.todo('horizontal mode, overflow dropdown, short title');
test.todo('horizontal mode, overflow dropdown, long title');
test.todo('horizontal mode, overflow dropdown, short title and description');
test.todo('horizontal mode, overflow dropdown, long title and description');
