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
import { supersetTheme } from '@apache-superset/core/theme';
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
  expect(screen.getByText('-20')).toBeInTheDocument();
});

// `resolveComparisonColorKeys` / `getComparisonColorTokens` are unit-tested
// in utils.test.ts; these confirm PopKPI actually wires their result into
// the arrow indicator and the comparison pills, so dropping that wiring
// (and silently falling back to the legacy colors) fails here.
test('applies the legacy comparisonColorScheme to the arrow and comparison pills (backward compatibility)', () => {
  render(<PopKPI {...baseProps} comparisonColorScheme="Red" />);

  // 'Red' reverses the scheme: an increase paints with the error tokens.
  expect(screen.getByText('↑')).toHaveStyleRule(
    'color',
    supersetTheme.colorError,
  );
  const deltaPill = screen.getByText('△');
  expect(deltaPill).toHaveStyleRule('color', supersetTheme.colorErrorText);
  expect(deltaPill).toHaveStyleRule(
    'background-color',
    supersetTheme.colorErrorBg,
  );
});

test('a custom increaseColor hex wins over the legacy comparisonColorScheme', () => {
  render(
    <PopKPI
      {...baseProps}
      comparisonColorScheme="Red"
      increaseColor="#336699"
    />,
  );

  expect(screen.getByText('↑')).toHaveStyleRule('color', '#336699');
  const deltaPill = screen.getByText('△');
  expect(deltaPill).toHaveStyleRule('color', '#336699');
  expect(deltaPill).toHaveStyleRule('background-color', '#3366991A');
  // The "previous value" pill never takes the comparison color.
  expect(screen.getByText('#')).toHaveStyleRule(
    'color',
    supersetTheme.colorTextTertiary,
  );
});

test('a decrease paints the arrow and delta pill with the custom decreaseColor', () => {
  render(
    <PopKPI
      {...baseProps}
      percentDifferenceNumber={-0.2}
      valueDifference="-20"
      increaseColor="#336699"
      decreaseColor="#994422"
    />,
  );

  expect(screen.getByText('↓')).toHaveStyleRule('color', '#994422');
  const deltaPill = screen.getByText('△');
  expect(deltaPill).toHaveStyleRule('color', '#994422');
  expect(deltaPill).toHaveStyleRule('background-color', '#9944221A');
});

test('falls back to neutral styling when comparisonColorEnabled is false', () => {
  render(
    <PopKPI
      {...baseProps}
      comparisonColorEnabled={false}
      increaseColor="#336699"
    />,
  );

  expect(screen.getByText('↑')).toHaveStyleRule(
    'color',
    supersetTheme.colorTextTertiary,
  );
  const deltaPill = screen.getByText('△');
  expect(deltaPill).toHaveStyleRule('color', supersetTheme.colorTextTertiary);
  expect(deltaPill).toHaveStyleRule(
    'background-color',
    supersetTheme.colorBgContainer,
  );
});

test('no arrow renders when there is no difference', () => {
  render(<PopKPI {...baseProps} percentDifferenceNumber={0} />);

  expect(screen.queryByText('↑')).not.toBeInTheDocument();
  expect(screen.queryByText('↓')).not.toBeInTheDocument();
});
