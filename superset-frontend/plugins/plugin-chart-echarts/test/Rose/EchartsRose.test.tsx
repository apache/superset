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
import { act, render } from '@testing-library/react';
import {
  CategoricalColorNamespace,
  getLabelsColorMap,
} from '@superset-ui/core';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import EchartsRose from '../../src/Rose/EchartsRose';
import { RoseChartTransformedProps, RosePeriod } from '../../src/Rose/types';
import Echart from '../../src/components/Echart';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

// Entries are NOT in seriesNames order -- East/West/North -- deliberately,
// to prove colors come from priming the scale in seriesNames order rather
// than from whatever order the drilled pie happens to sort slices into.
const SERIES_NAMES = ['East', 'West', 'North'];
const PERIODS: RosePeriod[] = [
  {
    time: 1,
    label: '2021',
    entries: [
      { seriesName: 'West', value: 5, increment: 0.1 },
      { seriesName: 'North', value: 30, increment: 0.5 },
      { seriesName: 'East', value: 10, increment: 0.3 },
    ],
  },
  {
    time: 2,
    label: '2022',
    entries: [
      { seriesName: 'East', value: 7, increment: 0.2 },
      { seriesName: 'West', value: 3, increment: 0.1 },
      { seriesName: 'North', value: 1, increment: 0.05 },
    ],
  },
];

const ROSE_ECHART_OPTIONS = {
  legend: { data: SERIES_NAMES },
  series: [{ id: 'rose', type: 'bar' }],
};

const baseProps: RoseChartTransformedProps = {
  height: 400,
  width: 800,
  echartOptions: ROSE_ECHART_OPTIONS as any,
  refs: {},
  formData: { vizType: 'rose' } as any,
  periods: PERIODS,
  seriesNames: SERIES_NAMES,
  numberFormat: 'SMART_NUMBER',
  sliceId: 1,
  colorScheme: '',
  groupby: [],
  labelMap: {},
  setDataMask: jest.fn(),
  selectedValues: {},
  emitCrossFilters: false,
};

function lastEchartCall() {
  return mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1][0] as any;
}

function renderRose(props: RoseChartTransformedProps = baseProps) {
  return render(
    <ThemeProvider theme={supersetTheme}>
      <EchartsRose {...props} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockedEchart.mockClear();
  // getColor() remembers a label's color for a given sliceId in a
  // process-wide singleton (so a dashboard's colors stay consistent across
  // charts); without resetting it here, whichever test runs first would
  // permanently decide these labels' colors for every later test in this
  // file, masking a priming-order regression instead of catching it.
  getLabelsColorMap().reset();
});

test('renders the rose view unchanged until a period is clicked', () => {
  renderRose();

  expect(lastEchartCall().echartOptions).toBe(ROSE_ECHART_OPTIONS);
});

test('clicking a period drills into a pie of that period, sorted largest-first', () => {
  renderRose();

  act(() => {
    lastEchartCall().eventHandlers.click({ dataIndex: 0 });
  });

  const { echartOptions } = lastEchartCall();
  expect(echartOptions.title.text).toContain('2021');
  expect(echartOptions.series[0].data.map((d: any) => d.name)).toEqual([
    'North',
    'East',
    'West',
  ]);
  expect(echartOptions.series[0].data.map((d: any) => d.value)).toEqual([
    30, 10, 5,
  ]);
});

test('drilled slice colors match the rose colors, primed in seriesNames order', () => {
  // Compute the expected mapping first, from a clean slate, priming a scale
  // in seriesNames order exactly as the rose view does -- independent of
  // the pie's own value-sorted order (North/East/West by value here, vs.
  // East/West/North in seriesNames).
  const expectedColorFn = CategoricalColorNamespace.getScale('');
  const expectedColors: Record<string, string> = {};
  SERIES_NAMES.forEach(name => {
    expectedColors[name] = expectedColorFn(name, baseProps.sliceId);
  });

  // Reset before rendering so the component primes its own scale from the
  // same clean slate, rather than inheriting the mapping just computed
  // above (colors are remembered per sliceId in a process-wide singleton,
  // so without this reset the comparison below would be tautological).
  getLabelsColorMap().reset();
  renderRose();
  act(() => {
    lastEchartCall().eventHandlers.click({ dataIndex: 0 });
  });
  const { echartOptions } = lastEchartCall();

  echartOptions.series[0].data.forEach((slice: any) => {
    expect(slice.itemStyle.color).toBe(expectedColors[slice.name]);
  });
});

test('clicking again while drilled returns to the rose view', () => {
  renderRose();

  act(() => {
    lastEchartCall().eventHandlers.click({ dataIndex: 1 });
  });
  expect(lastEchartCall().echartOptions).not.toBe(ROSE_ECHART_OPTIONS);

  act(() => {
    lastEchartCall().eventHandlers.click({ dataIndex: 0 });
  });
  expect(lastEchartCall().echartOptions).toBe(ROSE_ECHART_OPTIONS);
});

test('clicking a different period while drilled returns to the rose view', () => {
  renderRose();

  act(() => {
    lastEchartCall().eventHandlers.click({ dataIndex: 0 });
  });
  expect(lastEchartCall().echartOptions.title.text).toContain('2021');

  // The toggle logic returns to the rose on any click while drilled,
  // rather than switching directly to a different period's pie.
  act(() => {
    lastEchartCall().eventHandlers.click({ dataIndex: 1 });
  });
  expect(lastEchartCall().echartOptions).toBe(ROSE_ECHART_OPTIONS);
});
