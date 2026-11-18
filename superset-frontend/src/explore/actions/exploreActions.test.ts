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

test('fetchCompatibility retains contextual grain support beside member names', async () => {
  const dispatch = jest.fn();
  const support = {
    event_time: {
      grains: ['P1M'],
      allows_default_grain: false,
      omitted_grain: 'P1M',
      ungrained_filter: 'P1D',
    },
  };
  const postSpy = jest.spyOn(SupersetClient, 'post').mockResolvedValueOnce({
    json: {
      result: {
        compatible_metrics: ['m1'],
        compatible_dimensions: ['event_time'],
        dimension_support: support,
      },
    },
  } as never);
  await actions.fetchCompatibility('semantic_view', 7, ['m1'], [])(dispatch);
  expect(
    getCompatibilityActions(dispatch).at(-1).compatibility.dimensionSupport,
  ).toEqual(support);
  postSpy.mockRestore();
});

test('SQL axis changes invalidate pending compatibility without idle redispatch', async () => {
  const dispatch = jest.fn();
  await actions.fetchCompatibility(
    'table',
    3,
    [],
    ['event_time'],
  )(dispatch, () => ({ explore: { compatibility: { status: 'idle' } } }));
  expect(dispatch).not.toHaveBeenCalled();
});

test('finite compatibility expires without polling or changing selected controls', async () => {
  jest.useFakeTimers();
  const dispatch = jest.fn();
  const post = jest
    .spyOn(SupersetClient, 'post')
    .mockImplementationOnce(async () => {
      jest.advanceTimersByTime(200);
      return {
        json: {
          result: {
            compatible_metrics: [],
            compatible_dimensions: [],
            dimension_support: { d: { grains: ['P1D'] } },
            compatibility_evidence: {
              format_version: 1,
              quality: 'partial',
              metadata_generation: 'G',
              valid_for_ms: 1000,
            },
          },
        },
      } as never;
    });
  try {
    await actions.fetchCompatibility('semantic_view', 7, [], [])(dispatch);
    expect(getCompatibilityActions(dispatch).at(-1).compatibility.status).toBe(
      'verified',
    );
    jest.advanceTimersByTime(799);
    expect(getCompatibilityActions(dispatch).at(-1).compatibility.status).toBe(
      'verified',
    );
    jest.advanceTimersByTime(1);
    expect(getCompatibilityActions(dispatch).at(-1).compatibility).toEqual({
      status: 'unknown',
      dimensionSupport: { d: { grains: ['P1D'] } },
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(
      dispatch.mock.calls.every(
        ([action]) => action.type === actions.SET_COMPATIBILITY,
      ),
    ).toBe(true);
  } finally {
    post.mockRestore();
    jest.useRealTimers();
  }
});

test.each([
  {
    format_version: 1,
    quality: 'unknown',
    valid_for_ms: 1000,
    metadata_generation: 'G',
  },
  {
    format_version: 2,
    quality: 'known',
    valid_for_ms: 1000,
    metadata_generation: 'G',
  },
  {
    format_version: 1,
    quality: 'known',
    valid_for_ms: 0,
    metadata_generation: 'G',
  },
  {
    format_version: 1,
    quality: 'known',
    valid_for_ms: Infinity,
    metadata_generation: 'G',
  },
  { format_version: 1, quality: 'known', valid_for_ms: 1000 },
  null,
])(
  'unsupported or expired evidence permits member choices (%j)',
  async evidence => {
    const dispatch = jest.fn();
    const post = jest.spyOn(SupersetClient, 'post').mockResolvedValueOnce({
      json: {
        result: {
          compatible_metrics: [],
          compatible_dimensions: [],
          compatibility_evidence: evidence,
        },
      },
    } as never);
    try {
      await actions.fetchCompatibility('semantic_view', 7, [], [])(dispatch);
      expect(
        getCompatibilityActions(dispatch).at(-1).compatibility.status,
      ).toBe('unknown');
    } finally {
      post.mockRestore();
    }
  },
);

test('reset fences replies after unmount and cancels the expiry timer', async () => {
  jest.useFakeTimers();
  const dispatch = jest.fn();
  let resolve!: (value: CompatibilityResponse) => void;
  const post = jest.spyOn(SupersetClient, 'post').mockImplementationOnce(
    () =>
      new Promise<CompatibilityResponse>(done => {
        resolve = done;
      }) as never,
  );
  try {
    const pending = actions.fetchCompatibility(
      'semantic_view',
      7,
      [],
      [],
    )(dispatch);
    dispatch(actions.resetCompatibility());
    resolve({
      json: { result: { compatible_metrics: [], compatible_dimensions: [] } },
    });
    await pending;
    jest.runOnlyPendingTimers();
    expect(getCompatibilityActions(dispatch).at(-1).compatibility).toEqual({
      status: 'idle',
    });
  } finally {
    post.mockRestore();
    jest.useRealTimers();
  }
});

test('datasource change cancels the previous expiry without affecting the new result', async () => {
  jest.useFakeTimers();
  const dispatch = jest.fn();
  const post = jest
    .spyOn(SupersetClient, 'post')
    .mockResolvedValueOnce({
      json: {
        result: {
          compatible_metrics: [],
          compatible_dimensions: [],
          compatibility_evidence: {
            format_version: 1,
            quality: 'known',
            metadata_generation: 'G',
            valid_for_ms: 1000,
          },
        },
      },
    } as never)
    .mockResolvedValueOnce({
      json: {
        result: { compatible_metrics: ['legacy'], compatible_dimensions: [] },
      },
    } as never);
  try {
    await actions.fetchCompatibility('semantic_view', 7, [], [])(dispatch);
    expect(jest.getTimerCount()).toBe(1);
    await actions.fetchCompatibility('semantic_view', 8, [], [])(dispatch);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(2000);
    expect(
      getCompatibilityActions(dispatch).at(-1).compatibility.metrics,
    ).toEqual(['legacy']);
  } finally {
    dispatch(actions.resetCompatibility());
    post.mockRestore();
    jest.useRealTimers();
  }
});
