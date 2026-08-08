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
import PopKPI from './PopKPI';
import { PopKPIProps } from './types';

const baseProps: PopKPIProps = {
  height: 200,
  width: 400,
  data: [],
  metrics: [],
  metricName: 'Sales',
  showMetricName: true,
  headerText: '',
  boldText: true,
  bigNumber: '120',
  prevNumber: '100',
  valueDifference: '20',
  percentDifferenceFormattedString: '20%',
  compType: 'r',
  percentDifferenceNumber: 0.2,
  subtitleFontSize: 0.15,
  shift: '',
  headerFontSize: 'l',
  subheaderFontSize: 'm',
  comparisonColorEnabled: true,
};

test('renders the up arrow and metric values when the metric increased', () => {
  render(<PopKPI {...baseProps} />);

  expect(screen.getByText('↑')).toBeInTheDocument();
  expect(screen.getByText('120')).toBeInTheDocument();
  expect(screen.getByText('Sales')).toBeInTheDocument();
});

test('renders the down arrow when the metric decreased', () => {
  render(
    <PopKPI
      {...baseProps}
      percentDifferenceNumber={-0.2}
      valueDifference="-20"
    />,
  );

  expect(screen.getByText('↓')).toBeInTheDocument();
});

// The precise color resolution (legacy `comparisonColorScheme` fallback,
// custom hex precedence, the neutral disabled state) is covered by pure
// unit tests against `resolveComparisonColorKeys` / `getComparisonColorTokens`
// in utils.test.ts, since emotion's `css` prop styles aren't reliably
// observable through jsdom's computed styles. These tests instead confirm
// PopKPI renders without crashing across the same prop combinations.
test('renders without crashing with only the legacy comparisonColorScheme (backward compatibility)', () => {
  render(<PopKPI {...baseProps} comparisonColorScheme="Red" />);

  expect(screen.getByText('↑')).toBeInTheDocument();
});

test('renders without crashing with a custom increaseColor hex', () => {
  render(
    <PopKPI
      {...baseProps}
      comparisonColorScheme="Red"
      increaseColor="#336699"
    />,
  );

  expect(screen.getByText('↑')).toBeInTheDocument();
});

test('renders without crashing when comparisonColorEnabled is false', () => {
  render(
    <PopKPI
      {...baseProps}
      comparisonColorEnabled={false}
      increaseColor="#336699"
    />,
  );

  expect(screen.getByText('↑')).toBeInTheDocument();
});

test('no arrow renders when there is no difference', () => {
  render(<PopKPI {...baseProps} percentDifferenceNumber={0} />);

  expect(screen.queryByText('↑')).not.toBeInTheDocument();
  expect(screen.queryByText('↓')).not.toBeInTheDocument();
});
