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

/** Flushes the real controls' debounces while leaving their callbacks intact. */
async function settleInputs() {
  await act(async () => {
    await new Promise(resolve =>
      setTimeout(resolve, Math.max(Constants.FAST_DEBOUNCE, 300) + 25),
    );
  });
}

beforeEach(() => {
  jest.useRealTimers();
  fetchMock.clearHistory().removeRoutes();
  setupDatasourceEditorMocks();
});

// Each case mounts the whole dataset modal, edits two collections and saves:
// about 8s locally, and past the global 20s on a loaded CI shard.
jest.setTimeout(60000);

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
    await settleInputs();
    expect(within(panel).getByDisplayValue(placeholder)).toBeVisible();

    await userEvent.click(within(panel).getByDisplayValue(placeholder));
    // EditableTitle changes its wrapper when entering edit mode.
    const nameInput = within(panel).getByDisplayValue(placeholder);
    fireEvent.change(nameInput, { target: { value: itemName } });
    fireEvent.blur(nameInput);
    await settleInputs();
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
    await settleInputs();

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
  // The debounce waits are real timers (fake timers cannot flush timeouts
  // scheduled before they were installed). The remaining cost is the modal
  // render and userEvent interactions, which can exceed Jest's default 20s
  // budget on a loaded CI runner.
  30000,
);
