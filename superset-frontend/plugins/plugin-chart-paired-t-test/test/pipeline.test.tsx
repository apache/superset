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
import { render } from 'spec/helpers/testing-library';
import transformProps from '../src/transformProps';
import PairedTTest from '../src/PairedTTest';

// Deterministic p-value so significance/formatting are stable.
jest.mock('../src/statistics', () => ({
  __esModule: true,
  studentTwoSidedPValue: () => 0.02,
}));

// A realistic /api/v1/chart/data timeseries response for main.birth_names:
// groupby=[gender], two adhoc SUM metrics, epoch-ms __timestamp, 44 years.
const adhoc = (col: string) => ({
  expressionType: 'SIMPLE',
  column: { column_name: col },
  aggregate: 'SUM',
  label: `SUM(${col})`,
});
const rows: Record<string, unknown>[] = [];
for (let y = 0; y < 44; y += 1) {
  const ts = Date.UTC(1965 + y, 0, 1);
  rows.push({
    __timestamp: ts,
    gender: 'boy',
    'SUM(num_boys)': 1000000 + y,
    'SUM(num_girls)': 0,
  });
  rows.push({
    __timestamp: ts,
    gender: 'girl',
    'SUM(num_boys)': 0,
    'SUM(num_girls)': 900000 + y,
  });
}

const buildProps = (formDataExtra: Record<string, unknown> = {}) =>
  transformProps({
    formData: {
      groupby: ['gender'],
      metrics: [adhoc('num_boys'), adhoc('num_girls')],
      significanceLevel: 0.05,
      liftvaluePrecision: '4',
      pvaluePrecision: '6',
      ...formDataExtra,
    },
    queriesData: [{ data: rows }],
  } as any) as any;

test('transformProps reshapes flat v1 records into per-metric series keyed by metric label', () => {
  const props = buildProps();
  expect(props.metrics).toEqual(['SUM(num_boys)', 'SUM(num_girls)']);
  expect(Object.keys(props.data)).toEqual(['SUM(num_boys)', 'SUM(num_girls)']);
  // one series per group tuple (boy / girl)
  expect(props.data['SUM(num_boys)']).toHaveLength(2);
  expect(props.data['SUM(num_boys)'].map((s: any) => s.group)).toEqual([
    ['boy'],
    ['girl'],
  ]);
});

test('the full pipeline renders a body row per group for each metric table', () => {
  const { container } = render(<PairedTTest {...buildProps()} />);
  // two metric tables, each with two group rows (boy / girl)
  const bodyRows = container.querySelectorAll('tbody tr');
  expect(bodyRows).toHaveLength(4);
  expect(container.querySelectorAll('td[label="gender"]')).toHaveLength(4);
});

test('renders rows even when precision/significance controls are absent from formData', () => {
  // Guards the "headers render but no rows" failure mode: missing optional
  // controls must not blank the table body.
  const props = buildProps({
    significanceLevel: undefined,
    liftvaluePrecision: undefined,
    pvaluePrecision: undefined,
  });
  const { container } = render(<PairedTTest {...props} />);
  expect(container.querySelectorAll('tbody tr')).toHaveLength(4);
});
