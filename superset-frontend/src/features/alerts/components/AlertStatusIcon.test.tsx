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
import AlertStatusIcon from './AlertStatusIcon';
import { AlertState } from '../types';

test('renders visually-hidden screen-reader text for Success state (alert)', () => {
  render(
    <AlertStatusIcon state={AlertState.Success} isReportEnabled={false} />,
  );
  expect(
    screen.getByText('Alert triggered, notification sent'),
  ).toBeInTheDocument();
});

test('renders visually-hidden screen-reader text for Success state (report)', () => {
  render(
    <AlertStatusIcon state={AlertState.Success} isReportEnabled />,
  );
  expect(screen.getByText('Report sent')).toBeInTheDocument();
});

test('renders visually-hidden screen-reader text for Working state (alert)', () => {
  render(
    <AlertStatusIcon state={AlertState.Working} isReportEnabled={false} />,
  );
  expect(screen.getByText('Alert running')).toBeInTheDocument();
});

test('renders visually-hidden screen-reader text for Error state (report)', () => {
  render(
    <AlertStatusIcon state={AlertState.Error} isReportEnabled />,
  );
  expect(screen.getByText('Report failed')).toBeInTheDocument();
});

test('renders visually-hidden screen-reader text for Noop state', () => {
  render(
    <AlertStatusIcon state={AlertState.Noop} isReportEnabled={false} />,
  );
  expect(screen.getByText('Nothing triggered')).toBeInTheDocument();
});

test('renders visually-hidden screen-reader text for Grace state', () => {
  render(
    <AlertStatusIcon state={AlertState.Grace} isReportEnabled={false} />,
  );
  expect(
    screen.getByText('Alert Triggered, In Grace Period'),
  ).toBeInTheDocument();
});

test('sr-only span is visually hidden via CSS clip', () => {
  render(
    <AlertStatusIcon state={AlertState.Success} isReportEnabled={false} />,
  );
  // Look up the sr-only text directly so the assertion doesn't depend on
  // the wrapper structure (Tooltip's DOM has changed in past upgrades).
  const srText = screen.getByText('Alert triggered, notification sent');
  expect(srText).toBeInTheDocument();
  // Assert on the clip-based hiding rule explicitly — earlier the test only
  // checked text content, which would still pass if the sr-only style
  // accidentally got dropped.
  expect(srText).toHaveStyle({ position: 'absolute' });
});
