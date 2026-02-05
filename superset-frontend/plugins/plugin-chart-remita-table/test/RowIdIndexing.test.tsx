/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';

function makeData(rows: number) {
  const data = Array.from({ length: rows }).map((_, i) => ({
    __rid: `row-${i + 1}`,
    name: `Name ${i + 1}`,
    sum__num: i + 1,
  }));
  return data;
}

describe('Row ID indexing (rowById Map)', () => {
  it('uses __rid fallback when bulk_action_id_column missing', async () => {
    const data = makeData(5);
    const props = transformProps({
      width: 400,
      height: 300,
      datasource: {
        id: 0,
        name: '',
        type: 'table',
        columns: [],
        metrics: [],
        columnFormats: {},
        verboseMap: {},
      } as any,
      rawFormData: {
        datasource: '11__table',
        viz_type: 'table',
        query_mode: 'raw',
        columns: ['name', 'sum__num'],
      } as any,
      queriesData: [
        {
          data,
          colnames: ['name', 'sum__num'],
          coltypes: [1, 0],
        } as any,
      ],
      hooks: {
        onAddFilter: () => {},
        setDataMask: () => {},
        onContextMenu: () => {},
      },
      filterState: { filters: {} },
      ownState: {},
      emitCrossFilters: false,
    } as any);

    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...props}
          sticky={false}
          slice_id={'rid-1'}
          selection_enabled={true}
          enable_bulk_actions={true}
          // Intentionally point id column to a missing key to ensure __rid is used
          bulk_action_id_column={'id'}
          split_actions={new Set()}
          non_split_actions={new Set()}
          enable_table_actions={false}
          table_actions={new Set()}
          table_actions_id_column={'id'}
        />
      </ThemeProvider>,
    );

    // Click the first row checkbox by tbody selector
    const boxes = document.querySelectorAll('tbody input.selectedRows_rid-1_check[type="checkbox"]');
    const rowBox = boxes[0] as HTMLInputElement;
    expect(rowBox).toBeDefined();
    // Toggle selection on
    rowBox.click();
    expect(rowBox.checked).toBe(true);
  });
});
