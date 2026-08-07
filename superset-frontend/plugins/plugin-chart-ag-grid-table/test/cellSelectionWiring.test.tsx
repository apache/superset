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
import { render, waitFor } from '@superset-ui/core/spec';
import { ProviderWrapper } from '../../plugin-chart-table/test/testHelpers';
import testData from '../../plugin-chart-table/test/testData';

// Capture the props the grid is rendered with, so we can assert the
// cell-selection wiring without depending on AG Grid's DOM rendering.
const captured: { props?: Record<string, any> } = {};

// Mock the narrow ThemedAgGridReact module (which the components barrel
// re-exports) rather than the whole barrel, to avoid its circular-init.
jest.mock('@superset-ui/core/components/ThemedAgGridReact', () => ({
  __esModule: true,
  ThemedAgGridReact: (props: Record<string, any>) => {
    captured.props = props;
    return null;
  },
  AgGridReact: function AgGridReact() {
    return null;
  },
  AllCommunityModule: {},
  ClientSideRowModelModule: {},
  ModuleRegistry: { registerModules: () => undefined },
  setupAGGridModules: () => undefined,
  defaultModules: [],
  themeQuartz: {},
  colorSchemeDark: {},
  colorSchemeLight: {},
}));

// Imported after the mock is declared (jest.mock is hoisted above imports).
// eslint-disable-next-line import/first
import AgGridTableChart from '../src/AgGridTableChart';
// eslint-disable-next-line import/first
import transformProps from '../src/transformProps';

function renderChart() {
  captured.props = undefined;
  render(
    ProviderWrapper({
      children: (
        <AgGridTableChart
          {...transformProps(testData.basic)}
          setDataMask={jest.fn()}
          slice_id={1}
        />
      ),
    }),
  );
}

test('interactive table selects the cell on click (text selection disabled) and wires a copy handler', async () => {
  renderChart();
  await waitFor(() => expect(captured.props).toBeDefined());

  // #106389: clicking selects the cell, not its text.
  expect(captured.props?.enableCellTextSelection).toBe(false);
  // A key-down handler must be wired to restore copy-a-value.
  expect(typeof captured.props?.onCellKeyDown).toBe('function');
});

test('the wired onCellKeyDown copies the focused cell value on Ctrl/Cmd+C', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });

  renderChart();
  await waitFor(() => expect(captured.props?.onCellKeyDown).toBeDefined());

  // Shape mirrors AG Grid's real CellKeyDownEvent: no pre-formatted value; the
  // displayed text is produced by the column's valueFormatter.
  captured.props?.onCellKeyDown({
    event: { key: 'c', metaKey: true },
    value: 2871,
    colDef: { valueFormatter: () => '2,871' },
  });

  expect(writeText).toHaveBeenCalledWith('2,871');
});
