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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';

import RowCountLabel from '.';

test('RowCountLabel renders singular result', () => {
  render(<RowCountLabel rowcount={1} limit={100} />);
  const expectedText = '1 row';
  expect(screen.getByText(expectedText)).toBeInTheDocument();
  userEvent.hover(screen.getByText(expectedText));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('RowCountLabel renders plural result', () => {
  render(<RowCountLabel rowcount={2} limit={100} />);
  const expectedText = '2 rows';
  expect(screen.getByText(expectedText)).toBeInTheDocument();
  userEvent.hover(screen.getByText(expectedText));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('RowCountLabel renders formatted result', () => {
  render(<RowCountLabel rowcount={1000} limit={10000} />);
  const expectedText = '1k rows';
  expect(screen.getByText(expectedText)).toBeInTheDocument();
  userEvent.hover(screen.getByText(expectedText));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('RowCountLabel renders limit with danger and tooltip', async () => {
  render(<RowCountLabel rowcount={100} limit={100} />);
  const expectedText = '100 rows';
  expect(screen.getByText(expectedText)).toBeInTheDocument();
  userEvent.hover(screen.getByText(expectedText));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('The row limit');
  expect(tooltip).toHaveStyle('background: rgba(0, 0, 0, 0.902);');
});

test('RowCountLabel renders loading', () => {
  render(<RowCountLabel loading />);
  const expectedText = 'Loading...';
  expect(screen.getByText(expectedText)).toBeInTheDocument();
  userEvent.hover(screen.getByText(expectedText));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
