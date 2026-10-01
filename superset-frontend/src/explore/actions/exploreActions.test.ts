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
import type { AnyAction } from 'redux';
import { SupersetClient } from '@superset-ui/core';
import { defaultState } from 'src/explore/store';
import exploreReducer, {
  ExploreState,
} from 'src/explore/reducers/exploreReducer';
import * as actions from 'src/explore/actions/exploreActions';

const METRICS = [
  {
    expressionType: 'SIMPLE',
    column: {
      advanced_data_type: null,
      certification_details: null,
      certified_by: null,
      column_name: 'a',
      description: null,
      expression: null,
      filterable: true,
      groupby: true,
      id: 1,
      is_certified: false,
      is_dttm: false,
      python_date_format: null,
      type: 'DOUBLE PRECISION',
      type_generic: 0,
      verbose_name: null,
      warning_markdown: null,
    },
    aggregate: 'SUM',
    sqlExpression: null,
    datasourceWarning: false,
    hasCustomLabel: false,
    label: 'SUM(a)',
    optionName: 'metric_1a2b3c4d5f_1a2b3c4d5f',
  },
  {
    expressionType: 'SIMPLE',
    column: {
      advanced_data_type: null,
      certification_details: null,
      certified_by: null,
      column_name: 'b',
      description: null,
      expression: null,
      filterable: true,
      groupby: true,
      id: 2,
      is_certified: false,
      is_dttm: false,
      python_date_format: null,
      type: 'BIGINT',
      type_generic: 0,
      verbose_name: null,
      warning_markdown: null,
    },
    aggregate: 'AVG',
    sqlExpression: null,
    datasourceWarning: false,
    hasCustomLabel: false,
    label: 'AVG(b)',
    optionName: 'metric_6g7h8i9j0k_6g7h8i9j0k',
  },
];

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('reducers', () => {
  test('Does not set a control value if control does not exist', () => {
    const newState = exploreReducer(
      defaultState as unknown as ExploreState,
      actions.setControlValue('NEW_FIELD', 'x', []) as AnyAction,
    );
    expect(newState.controls.NEW_FIELD).toBeUndefined();
  });
  test('setControlValue works as expected with a Select control', () => {
    const newState = exploreReducer(
      defaultState as unknown as ExploreState,
      actions.setControlValue('y_axis_format', '$,.2f', []) as AnyAction,
    );
    expect(newState.controls.y_axis_format.value).toBe('$,.2f');
    expect(newState.form_data.y_axis_format).toBe('$,.2f');
  });
  test('Keeps the column config when metric column positions are swapped', () => {
    const mockedState = {
      ...defaultState,
      controls: {
        ...defaultState.controls,
        metrics: {
          ...defaultState.controls.metrics,
          value: METRICS,
        },
        column_config: {
          ...defaultState.controls.column_config,
          value: {
            'AVG(b)': {
              currencyFormat: {
                symbolPosition: 'prefix',
                symbol: 'USD',
              },
            },
          },
        },
      },
      form_data: {
        ...defaultState.form_data,
        metrics: METRICS,
        column_config: {
          'AVG(b)': {
            currencyFormat: {
              symbolPosition: 'prefix',
              symbol: 'USD',
            },
          },
        },
      },
    };

    const swappedMetrics = [METRICS[1], METRICS[0]];
    const newState = exploreReducer(
      mockedState as unknown as ExploreState,
      actions.setControlValue('metrics', swappedMetrics, []) as AnyAction,
    );

    const expectedColumnConfig = {
      'AVG(b)': {
        currencyFormat: {
          symbolPosition: 'prefix',
          symbol: 'USD',
        },
      },
    };

    expect(newState.controls.metrics.value).toStrictEqual(swappedMetrics);
    expect(newState.form_data.metrics).toStrictEqual(swappedMetrics);
    expect(newState.controls.column_config.value).toStrictEqual(
      expectedColumnConfig,
    );
    expect(newState.form_data.column_config).toStrictEqual(
      expectedColumnConfig,
    );
  });

  test('Keeps the column config when metric column name is updated', () => {
    const mockedState = {
      ...defaultState,
      controls: {
        ...defaultState.controls,
        metrics: {
          ...defaultState.controls.metrics,
          value: METRICS,
        },
        column_config: {
          ...defaultState.controls.column_config,
          value: {
            'AVG(b)': {
              currencyFormat: {
                symbolPosition: 'prefix',
                symbol: 'USD',
              },
            },
          },
        },
      },
      form_data: {
        ...defaultState.form_data,
        metrics: METRICS,
        column_config: {
          'AVG(b)': {
            currencyFormat: {
              symbolPosition: 'prefix',
              symbol: 'USD',
            },
          },
        },
      },
    };

    const updatedMetrics = [
      METRICS[0],
      {
        ...METRICS[1],
        hasCustomLabel: true,
        label: 'AVG of b',
      },
    ];

    const newState = exploreReducer(
      mockedState as unknown as ExploreState,
      actions.setControlValue('metrics', updatedMetrics, []) as AnyAction,
    );

    const expectedColumnConfig = {
      'AVG of b': {
        currencyFormat: {
          symbolPosition: 'prefix',
          symbol: 'USD',
        },
      },
    };
    expect(newState.controls.metrics.value).toStrictEqual(updatedMetrics);
    expect(newState.form_data.metrics).toStrictEqual(updatedMetrics);
    expect(newState.form_data.column_config).toStrictEqual(
      expectedColumnConfig,
    );
  });

  test('setStashFormData works as expected with fieldNames', () => {
    const newState = exploreReducer(
      defaultState as unknown as ExploreState,
      actions.setStashFormData(true, ['y_axis_format']) as AnyAction,
    );
    expect(newState.hiddenFormData).toEqual({
      y_axis_format: defaultState.form_data.y_axis_format,
    });
    expect(newState.form_data.y_axis_format).toBeFalsy();
    const updatedState = exploreReducer(
      newState,
      actions.setStashFormData(false, ['y_axis_format']) as AnyAction,
    );
    expect(updatedState.hiddenFormData!.y_axis_format).toBeFalsy();
    expect(updatedState.form_data.y_axis_format).toEqual(
      defaultState.form_data.y_axis_format,
    );
  });
});

type CompatibilityResponse = {
  json: {
    result: {
      compatible_metrics: string[];
      compatible_dimensions: string[];
    };
  };
};

const getCompatibilityActions = (dispatch: jest.Mock) =>
  dispatch.mock.calls
    .map(call => call[0])
    .filter((action: AnyAction) => action.type === actions.SET_COMPATIBILITY);

test('fetchCompatibility resets to idle for non-semantic datasources', async () => {
  const dispatch = jest.fn();

  await actions.fetchCompatibility('table', 3, ['m1'], ['d1'])(dispatch as any);

  expect(getCompatibilityActions(dispatch)).toEqual([
    { type: actions.SET_COMPATIBILITY, compatibility: { status: 'idle' } },
  ]);
});

test('fetchCompatibility transitions loading then verified with values', async () => {
  const dispatch = jest.fn();
  const postSpy = jest.spyOn(SupersetClient, 'post').mockResolvedValueOnce({
    json: {
      result: {
        compatible_metrics: ['m1'],
        compatible_dimensions: ['d1', 'd2'],
      },
    },
  } as never);

  await actions.fetchCompatibility(
    'semantic_view',
    7,
    ['m1'],
    ['d1'],
  )(dispatch as any);

  expect(getCompatibilityActions(dispatch)).toEqual([
    { type: actions.SET_COMPATIBILITY, compatibility: { status: 'loading' } },
    {
      type: actions.SET_COMPATIBILITY,
      compatibility: {
        status: 'verified',
        metrics: ['m1'],
        dimensions: ['d1', 'd2'],
      },
    },
  ]);

  postSpy.mockRestore();
});

test('fetchCompatibility keeps empty verified arrays distinct from idle and failed', async () => {
  const dispatch = jest.fn();
  const postSpy = jest.spyOn(SupersetClient, 'post').mockResolvedValueOnce({
    json: {
      result: {
        compatible_metrics: [],
        compatible_dimensions: [],
      },
    },
  } as never);

  await actions.fetchCompatibility('semantic_view', 7, [], [])(dispatch as any);

  expect(getCompatibilityActions(dispatch)).toContainEqual({
    type: actions.SET_COMPATIBILITY,
    compatibility: { status: 'verified', metrics: [], dimensions: [] },
  });

  postSpy.mockRestore();
});

test('fetchCompatibility marks the latest request failed on error', async () => {
  const dispatch = jest.fn();
  const postSpy = jest
    .spyOn(SupersetClient, 'post')
    .mockRejectedValueOnce(new Error('network down'));

  await actions.fetchCompatibility(
    'semantic_view',
    7,
    ['m1'],
    ['d1'],
  )(dispatch as any);

  expect(getCompatibilityActions(dispatch)).toEqual([
    { type: actions.SET_COMPATIBILITY, compatibility: { status: 'loading' } },
    { type: actions.SET_COMPATIBILITY, compatibility: { status: 'failed' } },
  ]);

  postSpy.mockRestore();
});

test('fetchCompatibility ignores stale async responses', async () => {
  const dispatch = jest.fn();

  let resolveFirst: (value: CompatibilityResponse) => void;
  let resolveSecond: (value: CompatibilityResponse) => void;

  const firstPromise = new Promise<CompatibilityResponse>(resolve => {
    resolveFirst = resolve;
  });
  const secondPromise = new Promise<CompatibilityResponse>(resolve => {
    resolveSecond = resolve;
  });

  const postSpy = jest.spyOn(SupersetClient, 'post');
  postSpy
    .mockImplementationOnce(() => firstPromise as never)
    .mockImplementationOnce(() => secondPromise as never);

  const firstThunk = actions.fetchCompatibility(
    'semantic_view',
    7,
    ['m1'],
    ['d1'],
  )(dispatch as any);
  const secondThunk = actions.fetchCompatibility(
    'semantic_view',
    7,
    ['m2'],
    ['d2'],
  )(dispatch as any);

  resolveSecond!({
    json: {
      result: {
        compatible_metrics: ['m2'],
        compatible_dimensions: ['d2'],
      },
    },
  });
  await secondThunk;

  resolveFirst!({
    json: {
      result: {
        compatible_metrics: ['m1'],
        compatible_dimensions: ['d1'],
      },
    },
  });
  await firstThunk;

  const verifiedActions = getCompatibilityActions(dispatch).filter(
    (action: AnyAction) => action.compatibility.status === 'verified',
  );

  expect(verifiedActions).toEqual([
    {
      type: actions.SET_COMPATIBILITY,
      compatibility: {
        status: 'verified',
        metrics: ['m2'],
        dimensions: ['d2'],
      },
    },
  ]);

  postSpy.mockRestore();
});

test('fetchCompatibility ignores a stale failure after a newer success', async () => {
  const dispatch = jest.fn();

  let rejectFirst: (reason: Error) => void;
  let resolveSecond: (value: CompatibilityResponse) => void;

  const firstPromise = new Promise<CompatibilityResponse>((_, reject) => {
    rejectFirst = reject;
  });
  const secondPromise = new Promise<CompatibilityResponse>(resolve => {
    resolveSecond = resolve;
  });

  const postSpy = jest.spyOn(SupersetClient, 'post');
  postSpy
    .mockImplementationOnce(() => firstPromise as never)
    .mockImplementationOnce(() => secondPromise as never);

  const firstThunk = actions.fetchCompatibility(
    'semantic_view',
    7,
    ['m1'],
    ['d1'],
  )(dispatch as any);
  const secondThunk = actions.fetchCompatibility(
    'semantic_view',
    7,
    ['m2'],
    ['d2'],
  )(dispatch as any);

  resolveSecond!({
    json: {
      result: {
        compatible_metrics: ['m2'],
        compatible_dimensions: ['d2'],
      },
    },
  });
  await secondThunk;

  rejectFirst!(new Error('stale failure'));
  await firstThunk;

  const compatibilityActions = getCompatibilityActions(dispatch);

  expect(compatibilityActions).not.toContainEqual(
    expect.objectContaining({ compatibility: { status: 'failed' } }),
  );
  expect(compatibilityActions[compatibilityActions.length - 1]).toEqual({
    type: actions.SET_COMPATIBILITY,
    compatibility: {
      status: 'verified',
      metrics: ['m2'],
      dimensions: ['d2'],
    },
  });

  postSpy.mockRestore();
});

test('metadata sync reloads the active semantic view and compatibility without rewriting chart data', async () => {
  const dispatch = jest.fn();
  const state = {
    explore: {
      ...defaultState,
      datasource: { id: 7, type: 'semantic_view' },
      controls: {
        metrics: { value: ['m1'] },
        groupby: { value: [] },
        metric: { value: 'm1' },
      },
    },
  };
  const fresh = {
    ...state.explore.datasource,
    metrics: [{ metric_name: 'new_metric' }],
  };
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValueOnce({ json: fresh } as never);
  const postSpy = jest.spyOn(SupersetClient, 'post').mockResolvedValueOnce({
    json: {
      result: {
        compatible_metrics: ['m1', 'new_metric'],
        compatible_dimensions: [],
      },
    },
  } as never);
  try {
    await actions.refreshSemanticMetadata(7, () => true)(
      dispatch,
      () => state as never,
    );
    expect(getSpy).toHaveBeenCalledWith({
      endpoint: '/fetch_datasource_metadata?datasourceKey=7__semantic_view',
    });
    expect(dispatch).toHaveBeenCalledWith(
      actions.syncSemanticMetadata(
        fresh as never,
        {
          metrics: ['m1'],
          groupby: [],
          metric: 'm1',
        } as never,
      ),
    );
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonPayload: { selected_metrics: ['m1'], selected_dimensions: [] },
      }),
    );
    expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual([
      actions.SYNC_SEMANTIC_METADATA,
      actions.SET_COMPATIBILITY,
      actions.SET_COMPATIBILITY,
    ]);
  } finally {
    getSpy.mockRestore();
    postSpy.mockRestore();
  }
});

test('metadata sync ignores a late response after its modal session ends', async () => {
  const dispatch = jest.fn();
  const state = {
    explore: {
      ...defaultState,
      datasource: { id: 7, type: 'semantic_view' },
    },
  };
  let current = true;
  let resolve!: (value: unknown) => void;
  const getSpy = jest.spyOn(SupersetClient, 'get').mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }) as never,
  );
  const postSpy = jest.spyOn(SupersetClient, 'post');
  try {
    const pending = actions.refreshSemanticMetadata(7, () => current)(
      dispatch,
      () => state as never,
    );
    current = false;
    resolve({ json: state.explore.datasource });
    await pending;
    expect(dispatch).not.toHaveBeenCalled();
    expect(postSpy).not.toHaveBeenCalled();
  } finally {
    getSpy.mockRestore();
    postSpy.mockRestore();
  }
});

test('metadata sync does not refetch when the active datasource is another view', async () => {
  const dispatch = jest.fn();
  const getSpy = jest.spyOn(SupersetClient, 'get');
  try {
    await actions.refreshSemanticMetadata(7, () => true)(
      dispatch,
      () =>
        ({
          explore: {
            ...defaultState,
            datasource: { id: 8, type: 'semantic_view' },
          },
        }) as never,
    );
    expect(getSpy).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  } finally {
    getSpy.mockRestore();
  }
});

test('a newer compatibility selection supersedes sync without a false reload error', async () => {
  const dispatch = jest.fn();
  const state = {
    explore: {
      ...defaultState,
      datasource: { id: 7, type: 'semantic_view' },
      controls: {},
    },
  };
  const getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue({ json: state.explore.datasource } as never);
  let resolve!: (value: unknown) => void;
  const postSpy = jest
    .spyOn(SupersetClient, 'post')
    .mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }) as never,
    )
    .mockResolvedValueOnce({
      json: {
        result: { compatible_metrics: ['latest'], compatible_dimensions: [] },
      },
    } as never);
  try {
    const sync = actions.refreshSemanticMetadata(7, () => true)(
      dispatch,
      () => state as never,
    );
    await Promise.resolve();
    await actions.fetchCompatibility(
      'semantic_view',
      7,
      ['latest'],
      [],
    )(dispatch);
    resolve({
      json: {
        result: { compatible_metrics: ['old'], compatible_dimensions: [] },
      },
    });
    await expect(sync).resolves.toBeUndefined();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        compatibility: expect.objectContaining({ metrics: ['old'] }),
      }),
    );
  } finally {
    getSpy.mockRestore();
    postSpy.mockRestore();
  }
});
