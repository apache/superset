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
import { readFileSync } from 'fs';
import path from 'path';
import reportRenderedChartIds, { layoutChartIds } from './reportRenderedCharts';

/*
 * Browser half of the report rendered-charts parity check. The server half,
 * tests/unit_tests/utils/test_report_rendered_charts_parity.py, runs the same
 * cases through `report_state_charts`.
 */

type ParityCase = {
  name: string;
  layout?: string;
  position_json?: string | null;
  slices: number[];
  state: unknown;
  tabs_enabled: boolean;
  expected: number[];
};

const fixture: {
  layouts: Record<string, unknown>;
  cases: ParityCase[];
} = JSON.parse(
  readFileSync(
    path.join(__dirname, '../../../spec/fixtures/reportRenderedCharts.json'),
    'utf8',
  ),
);

const positionJson = (parityCase: ParityCase) =>
  'position_json' in parityCase
    ? (parityCase.position_json ?? null)
    : JSON.stringify(fixture.layouts[parityCase.layout as string]);

test.each(fixture.cases.map(parityCase => [parityCase.name, parityCase]))(
  'renders the charts the server does: %s',
  (_name, parityCase) => {
    const {
      slices,
      state,
      tabs_enabled: tabsEnabled,
      expected,
    } = parityCase as ParityCase;
    expect(
      reportRenderedChartIds(
        positionJson(parityCase as ParityCase),
        slices,
        state,
        tabsEnabled,
      ),
    ).toEqual(expected);
  },
);

test('layout chart ids skip what the layout does not place as a chart', () => {
  expect(layoutChartIds(JSON.stringify(fixture.layouts.nested)).sort()).toEqual(
    [1, 2, 3, 4],
  );
  expect(layoutChartIds('not json')).toEqual([]);
  expect(layoutChartIds(JSON.stringify(fixture.layouts.repeated_node))).toEqual(
    [],
  );
});
