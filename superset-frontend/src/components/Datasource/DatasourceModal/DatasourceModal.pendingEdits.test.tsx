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
import type { ComponentProps } from 'react';
import fetchMock from 'fetch-mock';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import mockDatasource from 'spec/fixtures/mockDatasource';
import { Constants } from '@superset-ui/core/components';
import {
  cleanupAsyncOperations,
  setupDatasourceEditorMocks,
} from 'src/components/Datasource/components/DatasourceEditor/tests/DatasourceEditor.test.utils';
import DatasourceModal from 'src/components/Datasource/DatasourceModal';

const datasetEndpoint = 'glob:*/api/v1/dataset/7';
const saveEndpoint = 'glob:*/api/v1/dataset/7?override_columns=*';

type SavedItem = {
  metric_name?: string;
  column_name?: string;
  expression?: string;
};

type SavePayload = { metrics: SavedItem[]; columns: SavedItem[] };

type AceNode = HTMLElement & {
  env: {
    editor: { getValue: () => string; setValue: (value: string) => void };
  };
};

// Controls debounce their onChange by FAST_DEBOUNCE (SQL controls use an
// explicit 300ms, see DatasourceEditor.tsx), via a real setTimeout. Faking
// timers just long enough to advance past that, mirroring the sibling
// DatasourceModal.test.tsx / CollectionTable.debounce.test.tsx pattern,
// settles the same callback deterministically and without the wall-clock
// wait — real timers resume immediately after so userEvent's own internal
// timing is unaffected.
/** Flushes the real controls' debounces without burning real wall-clock time. */
function flushDebounce() {
  jest.useFakeTimers();
  act(() => {
    jest.advanceTimersByTime(Math.max(Constants.FAST_DEBOUNCE, 300) + 25);
  });
  jest.useRealTimers();
}

beforeEach(() => {
  jest.useRealTimers();
  fetchMock.clearHistory().removeRoutes();
  setupDatasourceEditorMocks();
});

afterEach(async () => {
  cleanup();
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
});

test.each(['metric', 'calculated column'] as const)(
  'preserves a new %s and the save payload when an earlier row edit is pending',
  async itemKind => {
    const isMetric = itemKind === 'metric';
    const placeholder = isMetric ? '<new metric>' : '<new column>';
    const itemName = isMetric ? 'new_metric' : 'new_calculated_column';
    const expression = isMetric ? 'SUM(num)' : 'num + 2';
    const existingItemName = isMetric
      ? mockDatasource['7__table'].metrics[0].metric_name
      : 'existing_calculated_column';
    const existingExpression = isMetric ? 'SUM(num) + 1' : 'num + 3';
    const tabName = isMetric ? /metrics/i : /calculated columns/i;
    fetchMock.put(saveEndpoint, {});
    fetchMock.get(datasetEndpoint, { result: mockDatasource['7__table'] });
    const props = {
      datasource: {
        ...mockDatasource['7__table'],
        metrics: mockDatasource['7__table'].metrics.slice(0, 1),
        columns: [
          mockDatasource['7__table'].columns[0],
          {
            ...mockDatasource['7__table'].columns[1],
            column_name: 'existing_calculated_column',
            expression: 'num + 1',
          },
        ],
      },
      etag: '"dataset-v1"',
      show: true,
      onHide: jest.fn(),
      onDatasourceSave: jest.fn(),
      onChange: jest.fn(),
      addSuccessToast: jest.fn(),
      addDangerToast: jest.fn(),
    } as unknown as ComponentProps<typeof DatasourceModal>;
    render(<DatasourceModal {...props} />, {
      useRedux: true,
      initialState: { common: { currencies: ['USD'] } },
      useRouter: true,
    });
    await userEvent.click(await screen.findByRole('tab', { name: tabName }));
    const panel = screen.getByRole('tabpanel', { name: tabName });
    await userEvent.click(
      within(panel).getByRole('button', { name: /expand row/i }),
    );
    const existingExpandedRow = within(panel).getByRole('row', {
      name: /^SQL expression/i,
    });
    await waitFor(() =>
      expect(
        existingExpandedRow.querySelector('.ace_editor'),
      ).toBeInTheDocument(),
    );
    const existingEditor =
      existingExpandedRow.querySelector<AceNode>('.ace_editor');
    fireEvent.change(await within(panel).findByPlaceholderText('Description'), {
      target: { value: 'Updated existing item' },
    });
    act(() => existingEditor?.env.editor.setValue(existingExpression));
    fireEvent.click(within(panel).getByRole('button', { name: /add item/i }));
    expect(within(panel).getByDisplayValue(placeholder)).toBeVisible();
    flushDebounce();
    expect(within(panel).getByDisplayValue(placeholder)).toBeVisible();

    await userEvent.click(within(panel).getByDisplayValue(placeholder));
    // EditableTitle changes its wrapper when entering edit mode.
    const nameInput = within(panel).getByDisplayValue(placeholder);
    fireEvent.change(nameInput, { target: { value: itemName } });
    fireEvent.blur(nameInput);
    flushDebounce();
    await userEvent.click(
      within(
        within(panel).getByRole('row', { name: new RegExp(existingItemName) }),
      ).getByRole('button', { name: /collapse row/i }),
    );
    if (isMetric) {
      await userEvent.click(
        within(
          within(panel).getByRole('row', { name: new RegExp(itemName) }),
        ).getByRole('button', { name: /expand row/i }),
      );
    }
    const expandedRow = within(panel).getByRole('row', {
      name: /^SQL expression/i,
    });
    await waitFor(() =>
      expect(expandedRow.querySelector('.ace_editor')).toBeInTheDocument(),
    );
    const editor = expandedRow.querySelector<AceNode>('.ace_editor');
    act(() => editor?.env.editor.setValue(expression));
    flushDebounce();

    await userEvent.click(screen.getByTestId('datasource-modal-save'));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirm' }),
    );
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(saveEndpoint)).toHaveLength(1),
    );
    const [request] = fetchMock.callHistory.calls(saveEndpoint);
    const payload = JSON.parse(String(request.options.body)) as SavePayload;
    const items = isMetric
      ? payload.metrics
      : payload.columns.filter(column => column.expression);
    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          [isMetric ? 'metric_name' : 'column_name']: itemName,
          expression,
        }),
        expect.objectContaining({
          [isMetric ? 'metric_name' : 'column_name']: existingItemName,
          description: 'Updated existing item',
          expression: existingExpression,
        }),
      ]),
    );
  },
  // This test still does real work after flushDebounce() above removed the
  // wall-clock dependency: a full modal render with two AceEditor mounts
  // and several userEvent interactions, completing in ~5-6s locally. The
  // 'metric' case adds an extra expand/collapse round trip on top of that,
  // and timed out past the default 20s budget on otherwise-unrelated
  // master pushes under CI load (runs 40370481814 and 40410835505, both on
  // commit shas unrelated to this file) even before flushDebounce()
  // removed ~1s of guaranteed real sleep and the risk of the real
  // setTimeout it replaced not firing promptly under that same load. 30s
  // keeps real headroom for that remaining render/interaction cost without
  // retrying flakes.
  30000,
);
