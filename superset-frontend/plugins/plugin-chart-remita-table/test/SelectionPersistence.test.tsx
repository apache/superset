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
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import testData from './testData';

describe('Selection persistence across pagination', () => {
  afterEach(() => {
    cleanup();
    // clear any persisted selection
    try { localStorage.clear(); } catch {}
  });

  it('persists selection to localStorage and restores on remount when enabled', async () => {
    const sliceId = 'persist-1';
    const baseProps: any = transformProps({
      ...testData.basic,
      rawFormData: {
        ...(testData.basic as any).rawFormData,
        server_pagination: true,
        server_page_length: 10,
      },
    } as any);

    // Initial mount with retention enabled
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...baseProps}
          sticky={false}
          slice_id={sliceId}
          selection_enabled={true}
          retain_selection_across_navigation={true}
          enable_bulk_actions={true}
          bulk_action_id_column={'name'}
          split_actions={new Set()}
          non_split_actions={new Set()}
          enable_table_actions={false}
          table_actions={new Set()}
          table_actions_id_column={'name'}
        />
      </ThemeProvider>,
    );

    // Select first row
    const rowBoxes = document.querySelectorAll(`tbody input.selectedRows_${sliceId}_check[type="checkbox"]`);
    const rowBox = rowBoxes[0] as HTMLInputElement;
    expect(rowBox).toBeDefined();
    await userEvent.click(rowBox);

    // Give debounce time to persist
    await new Promise(res => setTimeout(res, 400));
    const stored = localStorage.getItem(`selectedRows_${sliceId}`);
    expect(stored).toBeTruthy();

    // Unmount and remount -> selection should be restored
    cleanup();
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...baseProps}
          sticky={false}
          slice_id={sliceId}
          selection_enabled={true}
          retain_selection_across_navigation={true}
          enable_bulk_actions={true}
          bulk_action_id_column={'name'}
          split_actions={new Set()}
          non_split_actions={new Set()}
          enable_table_actions={false}
          table_actions={new Set()}
          table_actions_id_column={'name'}
        />
      </ThemeProvider>,
    );

    const rowBoxes2 = document.querySelectorAll(`tbody input.selectedRows_${sliceId}_check[type="checkbox"]`);
    const rowBox2 = rowBoxes2[0] as HTMLInputElement;
    expect(rowBox2).toBeDefined();
    expect(rowBox2.checked).toBe(true);
  });
});
