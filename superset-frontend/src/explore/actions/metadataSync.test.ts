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
import { AnyAction, applyMiddleware, createStore } from 'redux';
import { ControlPanelState, Dataset } from '@superset-ui/chart-controls';
import {
  DatasourceType,
  FeatureFlag,
  getChartControlPanelRegistry,
  QueryFormData,
  SupersetClient,
} from '@superset-ui/core';
import exploreReducer, {
  ExploreState,
} from 'src/explore/reducers/exploreReducer';
import { ExplorePageState } from 'src/explore/types';
import versionHistoryReducer, {
  CLEAR_VERSION_SESSION_LOG,
} from 'src/features/versionHistory/reducer';
import { VersionHistoryState } from 'src/features/versionHistory/types';
import { versionSessionLogMiddleware } from 'src/features/versionHistory/sessionLogMiddleware';
import { refreshSemanticMetadata, setExploreControls } from './exploreActions';

const vizType = 'metadata-sync-regression';

beforeEach(() => {
  getChartControlPanelRegistry().registerValue(vizType, {
    controlPanelSections: [
      {
        controlSetRows: [
          ['metrics'],
          [
            {
              name: 'groupby',
              config: {
                type: 'SelectControl',
                multi: true,
                mapStateToProps: (state: ControlPanelState) => ({
                  choices: (state.datasource as Dataset).columns.map(column => [
                    column.column_name,
                    column.column_name,
                  ]),
                }),
              },
            },
          ],
        ],
      },
    ],
  });
});

afterEach(() => {
  getChartControlPanelRegistry().remove(vizType);
  jest.restoreAllMocks();
});

test.each([false, true])(
  'metadata sync logs only changed control values (removed choice: %s)',
  async removed => {
    const previousFlags = window.featureFlags;
    window.featureFlags = {
      ...previousFlags,
      [FeatureFlag.VersionHistory]: true,
    };
    const datasource: Dataset = {
      id: 7,
      type: DatasourceType.SemanticView,
      columns: [{ column_name: 'country', type: 'STRING', groupby: true }],
      metrics: [
        { uuid: 'orders-metric', metric_name: 'orders', expression: 'orders' },
      ],
      column_formats: {},
      verbose_map: {},
      main_dttm_col: '',
      datasource_name: 'orders',
      description: null,
    };
    const formData: QueryFormData = {
      datasource: '7__semantic_view',
      viz_type: vizType,
      metrics: ['orders'],
      groupby: ['country'],
    };
    const initialExplore: ExploreState = {
      datasource,
      form_data: formData,
      controls: {
        datasource: { type: 'SelectControl', value: formData.datasource },
        viz_type: { type: 'SelectControl', value: vizType },
        metrics: { type: 'SelectControl', value: ['orders'] },
        groupby: { type: 'SelectControl', value: ['country'] },
      },
    };
    Object.freeze(initialExplore.controls.metrics);
    Object.freeze(initialExplore.controls.groupby);
    Object.freeze(initialExplore.controls);
    Object.freeze(initialExplore);
    const initialState = {
      explore: initialExplore,
      versionHistory: versionHistoryReducer(undefined, {
        type: CLEAR_VERSION_SESSION_LOG,
      }),
    };
    const store = createStore(
      (
        state: {
          explore: ExploreState;
          versionHistory: VersionHistoryState;
        } = initialState,
        action: AnyAction,
      ) => ({
        explore: exploreReducer(
          state.explore,
          action as Parameters<typeof exploreReducer>[1],
        ),
        versionHistory: versionHistoryReducer(
          state.versionHistory,
          action as Parameters<typeof versionHistoryReducer>[1],
        ),
      }),
      applyMiddleware(versionSessionLogMiddleware),
    );
    const fresh: Dataset = {
      ...datasource,
      columns: removed ? [] : datasource.columns,
      metrics: [
        ...datasource.metrics,
        {
          uuid: 'revenue-metric',
          metric_name: 'revenue',
          expression: 'revenue',
        },
      ],
    };
    const getSpy = jest
      .spyOn(SupersetClient, 'get')
      .mockResolvedValueOnce({ json: fresh } as never);
    const postSpy = jest.spyOn(SupersetClient, 'post').mockResolvedValueOnce({
      json: {
        result: {
          compatible_metrics: ['orders', 'revenue'],
          compatible_dimensions: ['country'],
        },
      },
    } as never);
    try {
      await refreshSemanticMetadata(7, () => true)(
        store.dispatch,
        () => store.getState() as Pick<ExplorePageState, 'explore'>,
      );
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(store.getState().explore.datasource).toEqual(fresh);
      expect(store.getState().explore.controls.metrics.value).toEqual([
        'orders',
      ]);
      expect(store.getState().explore.controls.groupby.value).toEqual(
        removed ? [] : ['country'],
      );
      expect(store.getState().explore.form_data).toBe(formData);
      if (removed) {
        expect(store.getState().versionHistory.sessionLog).toEqual([
          expect.objectContaining({ controlName: 'groupby' }),
        ]);
      } else {
        expect(store.getState().versionHistory.sessionLog).toEqual([]);
      }
      expect(initialExplore.controls.metrics.value).toEqual(['orders']);
      // The ordinary undo/redo action still records its user edit.
      store.dispatch(setExploreControls(formData));
      expect(store.getState().versionHistory.sessionLog).toHaveLength(
        removed ? 2 : 1,
      );
    } finally {
      window.featureFlags = previousFlags;
    }
  },
);
