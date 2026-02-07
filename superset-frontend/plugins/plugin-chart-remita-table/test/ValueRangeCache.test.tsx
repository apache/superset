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
import { render } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import transformProps from '../src/transformProps';
import testData from './testData';

// Mock d3-array to count extent/max calls
jest.mock('d3-array', () => {
  const real = jest.requireActual('d3-array');
  const counters = { extent: 0, max: 0 } as any;
  (global as any).__d3Counters = counters;
  return {
    ...real,
    extent: (...args: any[]) => {
      counters.extent += 1;
      return (real as any).extent(...args);
    },
    max: (...args: any[]) => {
      counters.max += 1;
      return (real as any).max(...args);
    },
  };
});

describe('valueRange cache', () => {
  it('computes ranges once and reuses on rerender', () => {
    const props = transformProps(testData.advanced);
    const TableChart = require('../src/TableChart').default;
    const { rerender } = render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...props}
          sticky={false}
          slice_id={'vrange-1'}
          split_actions={new Set()}
          non_split_actions={new Set()}
          table_actions={new Set()}
          enable_table_actions={false}
          enable_bulk_actions={false}
          include_row_numbers={false}
          selection_mode={'multiple'}
          bulk_action_id_column={'name'}
        />
      </ThemeProvider>,
    );

    const firstExtent = (global as any).__d3Counters.extent;
    const firstMax = (global as any).__d3Counters.max;

    // Rerender with same props object (no data/columns change)
    rerender(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...props}
          sticky={false}
          slice_id={'vrange-1'}
          split_actions={new Set()}
          non_split_actions={new Set()}
          table_actions={new Set()}
          enable_table_actions={false}
          enable_bulk_actions={false}
          include_row_numbers={false}
          selection_mode={'multiple'}
          bulk_action_id_column={'name'}
        />
      </ThemeProvider>,
    );

    const secondExtent = (global as any).__d3Counters.extent;
    const secondMax = (global as any).__d3Counters.max;

    // No additional extent/max calls expected on rerender with same data/columns
    expect(secondExtent).toBe(firstExtent);
    expect(secondMax).toBe(firstMax);
  });
});

