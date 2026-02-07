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
import testData from './testData';
import userEvent from '@testing-library/user-event';

describe('URL building + param sanitization', () => {
  it('sanitizes dashboardQueryParams and builds a safe resolvedUrl', async () => {
    const tp = transformProps({
      ...testData.basic,
      filterState: {
        filters: {
          status: ["<script>alert(1)</script>", "javascript:evil()", "a,b"],
        },
        extraFormData: {
          time_range: 'Last week<script>',
          granularity: 'day',
        },
      },
      rawFormData: {
        ...(testData.basic as any).rawFormData,
        include_dashboard_filters: true,
      },
    } as any);

    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...tp}
          sticky={false}
          slice_id={'url-sec-1'}
          enable_table_actions={true}
          table_actions_id_column={'name'}
          table_actions={new Set([
            {
              key: 'go',
              label: 'Go',
              valueColumns: ['name'],
              actionUrl: '/do/thing',
              includeDashboardFilters: true,
              publishEvent: true,
            },
          ])}
        />
      </ThemeProvider>,
    );

    // Open row action menu and click 'Go'
    const moreButtons = await screen.findAllByRole('button', { name: /more options/i });
    await userEvent.click(moreButtons[0]);
    const goItem = await screen.findByRole('menuitem', { name: /go/i });
    await userEvent.click(goItem);

    // The inline alert shows payload JSON containing resolvedUrl and queryParams
    const alert = await screen.findByText((_, node) => {
      const txt = node?.textContent || '';
      // base URL should be resolved against current origin
      const origin = window.location.origin.replace(/\//g, '\\/');
      const reOrigin = new RegExp(`${origin}.*\/do\/thing\\?`);
      return (
        reOrigin.test(txt) &&
        // status should be CSV of sanitized values (no angle brackets or protocol prefixes), commas preserved
        /status=scriptalert\(1\)script,javascriptevil\(\),a,b/.test(txt) &&
        // time_range sanitized (no script tag)
        /time_range=Last%20weekscript/.test(txt) &&
        // granularity present
        /granularity=day/.test(txt)
      );
    }, { timeout: 5000 });
    expect(alert).toBeInTheDocument();
  });
});

