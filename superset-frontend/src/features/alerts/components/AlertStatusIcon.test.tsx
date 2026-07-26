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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import AlertStatusIcon from './AlertStatusIcon';
import { AlertState } from '../types';

const renderIcon = (state: string, isReportEnabled = false) =>
  render(<AlertStatusIcon state={state} isReportEnabled={isReportEnabled} />);

test('renders a check icon for the Success state', () => {
  const { container } = renderIcon(AlertState.Success);
  expect(container.querySelector('[data-icon="check"]')).toBeInTheDocument();
});

test('renders a close icon for the Error state', () => {
  const { container } = renderIcon(AlertState.Error);
  expect(container.querySelector('[data-icon="close"]')).toBeInTheDocument();
});

test('renders a warning icon for the Grace state', () => {
  const { container } = renderIcon(AlertState.Grace);
  expect(container.querySelector('[data-icon="warning"]')).toBeInTheDocument();
});

// Regression for issue #29622: a report that has never run has
// last_state="Not triggered" (the backend default), which previously rendered
// a green success check and looked like a successful run. It should now render
// a neutral calendar icon instead.
test('renders a neutral calendar icon (not a success check) for the Not triggered state', () => {
  const { container } = renderIcon(AlertState.Noop);
  expect(container.querySelector('[data-icon="calendar"]')).toBeInTheDocument();
  expect(
    container.querySelector('[data-icon="check"]'),
  ).not.toBeInTheDocument();
});

test('renders the neutral calendar icon for an unknown/never-run state', () => {
  const { container } = renderIcon('');
  expect(container.querySelector('[data-icon="calendar"]')).toBeInTheDocument();
  expect(
    container.querySelector('[data-icon="check"]'),
  ).not.toBeInTheDocument();
});

test('labels the Not triggered state "Report not yet run" for reports', async () => {
  renderIcon(AlertState.Noop, /* isReportEnabled */ true);
  userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByText('Report not yet run')).toBeInTheDocument();
  // Guards the isReportEnabled split: before this fix the Noop label was
  // unconditionally "Nothing triggered" for reports too.
  expect(screen.queryByText('Nothing triggered')).not.toBeInTheDocument();
});

test('labels the Not triggered state "Nothing triggered" for alerts', async () => {
  renderIcon(AlertState.Noop, /* isReportEnabled */ false);
  userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByText('Nothing triggered')).toBeInTheDocument();
});
