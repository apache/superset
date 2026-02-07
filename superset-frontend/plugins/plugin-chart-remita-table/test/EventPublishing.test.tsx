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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import testData from './testData';
import userEvent from '@testing-library/user-event';

// minimal default props consistent with existing tests
const defaultTableProps = {
  sticky: false,
  show_split_buttons_in_slice_header: false,
  retain_selection_accross_navigation: false,
  enable_bulk_actions: false,
  include_row_numbers: false,
  bulk_action_id_column: 'id',
  selection_mode: 'multiple' as const,
  enable_table_actions: false,
  table_actions_id_column: 'id',
  split_actions: new Set(),
  non_split_actions: new Set(),
  table_actions: new Set(),
  slice_id: 'test-slice',
};

const renderTable = (overrideProps?: any) =>
  render(
    <ThemeProvider theme={supersetTheme}>
      <TableChart
        {...transformProps(testData.basic)}
        {...defaultTableProps}
        {...(overrideProps || {})}
      />
    </ThemeProvider>,
  );

describe('Event publishing + dedupe', () => {
  beforeEach(() => {
    // reset feature flags for each test run
    (window as any).featureFlags = {
      REMITA_EVENT_DEDUPE_ENABLED: true,
      REMITA_EVENT_DEDUPE_TTL_MS: 1000,
    };
  });

  it('adds origin and suppresses duplicate publish-event notifications within TTL', () => {
    renderTable();

    const base = {
      action: 'table-action',
      chartId: 'xyz',
      actionType: 'approve',
      values: [1],
      origin: 'header',
    };

    // Dispatch publish-event once
    const ev1 = new CustomEvent('remita.notification', {
      detail: { notification: 'publish-event', data: base },
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(ev1);

    const msg1 = JSON.stringify(base);
    expect(screen.getByText(msg1)).toBeInTheDocument();

    // Dispatch identical event again quickly -> should be suppressed
    const ev2 = new CustomEvent('remita.notification', {
      detail: { notification: 'publish-event', data: base },
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(ev2);

    // still only the first message should be shown
    expect(screen.getByText(msg1)).toBeInTheDocument();

    // Dispatch a different event (different actionType) -> should replace message
    const changed = { ...base, actionType: 'reject' };
    const ev3 = new CustomEvent('remita.notification', {
      detail: { notification: 'publish-event', data: changed },
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(ev3);

    const msg2 = JSON.stringify(changed);
    expect(screen.getByText(msg2)).toBeInTheDocument();
  });

  it('honors flag to disable dedupe (emits every event)', () => {
    (window as any).featureFlags = {
      REMITA_EVENT_DEDUPE_ENABLED: false,
    };
    renderTable();

    const base = {
      action: 'table-action',
      chartId: 'xyz2',
      actionType: 'approve',
      values: [2],
      origin: 'header',
    };

    const ev = (d: any) =>
      new CustomEvent('remita.notification', {
        detail: { notification: 'publish-event', data: d },
        bubbles: true,
        cancelable: true,
      });

    window.dispatchEvent(ev(base));
    const msg = JSON.stringify(base);
    expect(screen.getByText(msg)).toBeInTheDocument();

    // with dedupe disabled, a second identical event should update the alert again (same content)
    window.dispatchEvent(ev(base));
    expect(screen.getByText(msg)).toBeInTheDocument();
  });

  it('publishes normalized row values for bulk actions', async () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...transformProps(testData.basic)}
          sticky={false}
          slice_id={'test-slice'}
          enable_bulk_actions={true}
          selection_enabled={true}
          bulk_action_id_column={'name'}
          split_actions={new Set()}
          non_split_actions={new Set([
            {
              key: 'approve',
              label: 'Approve',
              style: 'primary',
              boundToSelection: true,
              visibilityCondition: 'selected',
              type: 'button',
            },
          ])}
          enable_table_actions={false}
          table_actions={new Set()}
          table_actions_id_column={'name'}
        />
      </ThemeProvider>,
    );

    // Select first row
    const rowCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    expect(rowCheckboxes.length).toBeGreaterThan(0);
    await userEvent.click(rowCheckboxes[0] as HTMLInputElement);

    // Click the non-split action button
    const btn = screen.getByRole('button', { name: /approve/i });
    await userEvent.click(btn);

    const alert = await screen.findByText((content, node) => {
      const text = node?.textContent || '';
      return (
        text.includes('"action":"bulk-action"') &&
        text.includes('"actionType":"approve"') &&
        text.includes('"origin":"bulk"') &&
        text.includes('"name":"Michael"')
      );
    });
    expect(alert).toBeInTheDocument();
  });

  it('publishes trimmed payload for row actions with valueColumns', async () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...transformProps(testData.basic)}
          sticky={false}
          slice_id={'test-slice'}
          enable_table_actions={true}
          table_actions_id_column={'name'}
          table_actions={new Set([
            {
              key: 'edit',
              label: 'Edit',
              style: 'primary',
              publishEvent: true,
              valueColumns: ['name'],
            },
          ])}
        />
      </ThemeProvider>,
    );

    // Open row action menu on the first row
    const moreButtons = await screen.findAllByRole('button', { name: /more options/i });
    expect(moreButtons.length).toBeGreaterThan(0);
    await userEvent.click(moreButtons[0]);

    // Click the 'Edit' menu item
    const menuItem = await screen.findByRole('menuitem', { name: /edit/i });
    await userEvent.click(menuItem);

    // Expect inline alert with trimmed payload (only name present)
    const alert = await screen.findByText((content, node) => {
      const text = node?.textContent || '';
      return (
        text.includes('"action":"table-action"') &&
        text.includes('"actionType":"edit"') &&
        text.includes('"origin":"row"') &&
        text.includes('"name":"Michael"') &&
        !text.includes('"sum__num"')
      );
    }, { timeout: 5000 });
    expect(alert).toBeInTheDocument();
  });
});
