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
import ChartVersionNotice from './ChartVersionNotice';

test('the live chart is labelled, not just the proposal', () => {
  // The silent default is the costly one: approving is not gated on having
  // turned the switch on, so an unlabelled live chart is a reviewer looking
  // at the old version with nothing on the page contradicting them.
  render(<ChartVersionNotice proposed={false} />, { useTheme: true });

  expect(screen.getByTestId('chart-version-notice')).toHaveTextContent(
    'Live version · what viewers see now',
  );
});

test('the proposal says it is not live', () => {
  render(<ChartVersionNotice proposed />, { useTheme: true });

  expect(screen.getByTestId('chart-version-notice')).toHaveTextContent(
    'Proposed version · not live until approved',
  );
});

test('the flip is announced', () => {
  // The switch's own `aria-checked` says the control moved, not what is now
  // on screen, and the chart itself is invisible to a screen reader.
  render(<ChartVersionNotice proposed />, { useTheme: true });

  expect(screen.getByRole('status')).toHaveTextContent(/Proposed version/);
});
