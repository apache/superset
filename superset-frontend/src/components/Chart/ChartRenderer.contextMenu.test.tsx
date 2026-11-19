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
import {
  Behavior,
  ChartMetadata,
  DataMask,
  getChartMetadataRegistry,
  QueryFormData,
} from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import mockState from 'spec/fixtures/mockState';
import { ChartSource } from 'src/types/ChartSource';
import dataMaskReducer from 'src/dataMask/reducer';
import { updateDataMask as updateMaskAction } from 'src/dataMask/actions';
import ChartRenderer, { ChartRendererProps } from './ChartRenderer';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({
    hooks,
    formData,
  }: {
    hooks: {
      setDataMask: (mask: DataMask) => void;
      onContextMenu: (
        x: number,
        y: number,
        filters: {
          crossFilter: { dataMask: DataMask; isCurrentValueSelected: boolean };
        },
      ) => void;
    };
    formData: QueryFormData;
  }) => (
    <>
      <button
        type="button"
        onClick={() => hooks.setDataMask(formData.testMask as DataMask)}
      >
        Select cell
      </button>
      <button
        type="button"
        onClick={() =>
          hooks.onContextMenu(100, 100, {
            crossFilter: {
              dataMask: formData.testMask as DataMask,
              isCurrentValueSelected: Boolean(formData.testRemove),
            },
          })
        }
      >
        Open cell menu
      </button>
    </>
  ),
}));

const previousFlags = window.featureFlags;
beforeAll(() => {
  window.featureFlags = { ...previousFlags, DRILL_TO_DETAIL: true };
  getChartMetadataRegistry().registerValue(
    'context-menu-test',
    new ChartMetadata({
      name: 'Context menu test',
      thumbnail: '',
      behaviors: [Behavior.InteractiveChart],
    }),
  );
});
afterAll(() => {
  window.featureFlags = previousFlags;
  getChartMetadataRegistry().remove('context-menu-test');
});

test.each(['7__semantic_view', '7__table'])(
  'menu selection matches direct click and removal clears both value and provenance for %s',
  async datasource => {
    const mask: DataMask = {
      extraFormData: {
        filters: [{ col: 'CUSTOMERS.SEGMENT', op: 'IN', val: ['CORP'] }],
      },
      filterState: { value: ['CORP'], selectedValues: ['CORP'] },
    };
    const updateDataMask = jest.fn();
    const formData: QueryFormData = {
      viz_type: 'context-menu-test',
      datasource,
      semantic_selection_version: 'source-v1',
      semantic_selection_sources: [
        { datasource: 'upstream__semantic_view', version: 'upstream-v1' },
      ],
      testMask: mask,
    };
    const props: ChartRendererProps = {
      chartId: 1,
      datasource: {} as ChartRendererProps['datasource'],
      formData,
      latestQueryFormData: formData,
      vizType: 'context-menu-test',
      source: ChartSource.Dashboard,
      actions: {
        updateDataMask,
        chartRenderingSucceeded: jest.fn(),
        chartRenderingFailed: jest.fn(),
        logEvent: jest.fn(),
      },
    };
    const { rerender } = render(<ChartRenderer {...props} />, {
      useRedux: true,
      initialState: {
        ...mockState,
        dashboardInfo: {
          ...mockState.dashboardInfo,
          crossFiltersEnabled: true,
        },
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Select cell' }));
    const expected: DataMask = datasource.endsWith('__semantic_view')
      ? {
          ...mask,
          extraFormData: {
            ...mask.extraFormData,
            semantic_selection_sources: [
              { datasource: 'upstream__semantic_view', version: 'upstream-v1' },
              { datasource, version: 'source-v1' },
            ],
          },
        }
      : mask;
    expect(updateDataMask).toHaveBeenLastCalledWith(1, expected);
    await userEvent.click(
      screen.getByRole('button', { name: 'Open cell menu' }),
    );
    await userEvent.click(
      await screen.findByText('Add cross-filter', { exact: true }),
    );
    expect(updateDataMask).toHaveBeenCalledTimes(2);
    expect(updateDataMask).toHaveBeenLastCalledWith(1, expected);

    const cleared: DataMask = {
      extraFormData: { filters: [] },
      filterState: { value: null, selectedValues: [] },
    };
    const clearedForm = { ...formData, testMask: cleared, testRemove: true };
    rerender(
      <ChartRenderer
        {...props}
        formData={clearedForm}
        latestQueryFormData={clearedForm}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Open cell menu' }),
    );
    await userEvent.click(
      await screen.findByText('Remove cross-filter', { exact: true }),
    );
    expect(updateDataMask).toHaveBeenCalledTimes(3);
    expect(updateDataMask).toHaveBeenLastCalledWith(1, cleared);
    const state = dataMaskReducer(
      { 1: { id: '1', ...expected } },
      updateMaskAction(1, cleared),
    );
    expect(state[1].filterState?.value).toBeNull();
    expect(state[1].extraFormData).toEqual({ filters: [] });
  },
);
