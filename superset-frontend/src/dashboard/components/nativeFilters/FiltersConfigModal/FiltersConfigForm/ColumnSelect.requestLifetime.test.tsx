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
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { DatasourceType, getClientErrorObject } from '@superset-ui/core';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import { ColumnSelect } from './ColumnSelect';

const mockDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({ addDangerToast: mockDangerToast }),
}));
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getClientErrorObject: jest.fn(),
}));
const parseError = getClientErrorObject as jest.MockedFunction<
  typeof getClientErrorObject
>;
type Props = ComponentProps<typeof ColumnSelect>;
const propsFor = () => {
  const setFields = jest.fn();
  const form = {
    getFieldValue: () => ({ f: { filterType: 'filter_select' } }),
    setFields,
  } as unknown as Props['form'];
  return {
    setFields,
    props: {
      form,
      filterId: 'f',
      datasetId: 2,
      datasourceType: DatasourceType.SemanticView,
      value: undefined,
    } satisfies Props,
  };
};
beforeEach(() => {
  supersetGetCache.clear();
  mockDangerToast.mockClear();
  parseError.mockReset();
});
afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  supersetGetCache.clear();
});

test.each([false, true])(
  'with remount=%s, a superseded column load cannot clear the shared form',
  async remount => {
    let release: () => void = () => {};
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    fetchMock.get('glob:*/api/v1/semantic_view/2/structure', () =>
      held.then(() => ({
        result: {
          name: 'Orders',
          dimensions: [{ name: 'Orders.amount', type: 'double' }],
          metrics: [],
        },
      })),
    );
    fetchMock.get('glob:*/api/v1/dataset/2?*', {
      result: { columns: [{ column_name: 'sql_column' }] },
    });
    const { props, setFields } = propsFor();
    const { rerender } = render(<ColumnSelect key="first" {...props} />, {
      useRedux: true,
    });
    await waitFor(() =>
      expect(
        fetchMock.callHistory.called('glob:*/api/v1/semantic_view/2/structure'),
      ).toBe(true),
    );
    rerender(
      <ColumnSelect
        key={remount ? 'replacement' : 'first'}
        {...props}
        datasourceType={DatasourceType.Table}
        value="sql_column"
      />,
    );
    await userEvent.click(screen.getByRole('combobox'));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'sql_column' })).toBeVisible(),
    );
    setFields.mockClear();
    await act(async () => {
      release();
      await fetchMock.callHistory.flush(true);
    });
    expect(setFields).not.toHaveBeenCalled();
  },
);

test('an error parsed after switching binding does not dispatch a stale toast', async () => {
  let release: (
    value: Awaited<ReturnType<typeof getClientErrorObject>>,
  ) => void = () => {};
  const held = new Promise<Awaited<ReturnType<typeof getClientErrorObject>>>(
    resolve => {
      release = resolve;
    },
  );
  parseError.mockReturnValue(held);
  fetchMock.get('glob:*/api/v1/semantic_view/2/structure', { status: 500 });
  fetchMock.get('glob:*/api/v1/dataset/2?*', {
    result: { columns: [{ column_name: 'sql_column' }] },
  });
  const { props } = propsFor();
  const { rerender } = render(<ColumnSelect {...props} />, { useRedux: true });
  await waitFor(() => expect(parseError).toHaveBeenCalled());
  rerender(
    <ColumnSelect
      {...props}
      datasourceType={DatasourceType.Table}
      value="sql_column"
    />,
  );
  await userEvent.click(screen.getByRole('combobox'));
  await waitFor(() =>
    expect(screen.getByRole('option', { name: 'sql_column' })).toBeVisible(),
  );
  await act(async () => {
    release({ error: 'Old semantic datasource unavailable' });
    await held;
  });
  expect(mockDangerToast).not.toHaveBeenCalled();
});
