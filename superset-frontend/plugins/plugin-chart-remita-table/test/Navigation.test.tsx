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
import userEvent from '@testing-library/user-event';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import testData from './testData';

describe('Navigation actions', () => {
  beforeEach(() => {
    // @ts-ignore
    window.open = jest.fn();
  });

  it('opens non-publish action in new tab when configured', async () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...transformProps(testData.basic)}
          sticky={false}
          slice_id={'test-slice'}
          // Header button action: non-publish with URL + openInNewTab
          enable_bulk_actions={false}
          non_split_actions={new Set([
            {
              key: 'go',
              label: 'Go',
              style: 'primary',
              boundToSelection: false,
              visibilityCondition: 'all',
              publishEvent: false,
              actionUrl: '/path',
              openInNewTab: true,
              type: 'button',
            },
          ])}
          enable_table_actions={false}
          table_actions={new Set()}
          table_actions_id_column={'name'}
        />
      </ThemeProvider>,
    );

    const btn = await screen.findByRole('button', { name: /go/i });
    await userEvent.click(btn);
    expect(window.open).toHaveBeenCalled();
  });

  it('uses chart-level openInNewTab when per-action is not set', async () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...transformProps({
            ...testData.basic,
            rawFormData: {
              ...(testData.basic as any).rawFormData,
              open_action_url_in_new_tab: true,
            },
          } as any)}
          sticky={false}
          slice_id={'test-slice'}
          enable_bulk_actions={false}
          non_split_actions={new Set([
            {
              key: 'go2',
              label: 'Go2',
              style: 'primary',
              boundToSelection: false,
              visibilityCondition: 'all',
              publishEvent: false,
              actionUrl: '/path2',
              type: 'button',
            },
          ])}
          enable_table_actions={false}
          table_actions={new Set()}
          table_actions_id_column={'name'}
        />
      </ThemeProvider>,
    );

    const btn = await screen.findByRole('button', { name: /go2/i });
    await userEvent.click(btn);
    expect(window.open).toHaveBeenCalled();
  });

  it('enriches payload with resolvedUrl containing filters and extras', async () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...transformProps({
            ...testData.basic,
            // Inject filterState with filters and extraFormData
            filterState: {
              filters: { region: ['East', 'West'] },
              extraFormData: { time_range: 'Last week' },
            } as any,
          } as any)}
          sticky={false}
          slice_id={'test-slice'}
          enable_bulk_actions={false}
          non_split_actions={new Set([
            {
              key: 'nav',
              label: 'Navigate',
              style: 'primary',
              boundToSelection: false,
              visibilityCondition: 'all',
              publishEvent: false,
              actionUrl: '/superset/dashboard/slug',
              type: 'button',
            },
          ])}
          enable_table_actions={false}
          table_actions={new Set()}
          table_actions_id_column={'name'}
        />
      </ThemeProvider>,
    );

    const btn = await screen.findByRole('button', { name: /navigate/i });
    await userEvent.click(btn);

    // The inline alert JSON should include resolvedUrl with appended query params
    const alertNode = await screen.findByText((_, node) => {
      const text = node?.textContent || '';
      return text.includes('"resolvedUrl"') && text.includes('region=East,West') && text.includes('time_range=Last%20week');
    });
    expect(alertNode).toBeInTheDocument();
  });
});
