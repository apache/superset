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
  ControlState,
  Dataset,
  sharedControls,
} from '@superset-ui/chart-controls';
import { DatasourceType, JsonValue } from '@superset-ui/core';
import { getControlValuesCompatibleWithDatasource } from './getControlValuesCompatibleWithDatasource';

const sampleDatasource: Dataset = {
  id: 1,
  type: DatasourceType.Table,
  columns: [
    { column_name: 'sample_column_1' },
    { column_name: 'sample_column_3' },
    { column_name: 'sample_column_4' },
  ],
  metrics: [{ metric_name: 'saved_metric_2' }],
  column_formats: {},
  currency_formats: {},
  verbose_map: {},
  main_dttm_col: '',
  datasource_name: 'Sample Dataset',
  description: 'A sample dataset',
};

const getValues = (controlState: ControlState) => {
  const { value } = controlState;
  return getControlValuesCompatibleWithDatasource(
    sampleDatasource,
    controlState,
    value as JsonValue,
  );
};

test('empty values', () => {
  const controlState = sharedControls.groupby;
  expect(
    getValues({
      ...controlState,
      value: undefined,
    }),
  ).toEqual(undefined);

  expect(
    getValues({
      ...controlState,
      value: null,
    }),
  ).toEqual(undefined);

  expect(
    getValues({
      ...controlState,
      value: [],
    }),
  ).toEqual(controlState.default);
});

test('column values', () => {
  const controlState = {
    ...sharedControls.columns,
    options: [
      { column_name: 'sample_column_1' },
      { column_name: 'sample_column_2' },
      { column_name: 'sample_column_3' },
    ],
  };

  expect(
    getValues({
      ...controlState,
      value: 'sample_column_1',
    }),
  ).toEqual('sample_column_1');

  expect(
    getValues({
      ...controlState,
      value: 'sample_column_2',
    }),
  ).toEqual(controlState.default);

  expect(
    getValues({
      ...controlState,
      value: 'sample_column_3',
    }),
  ).toEqual('sample_column_3');

  expect(
    getValues({
      ...controlState,
      value: ['sample_column_1', 'sample_column_2', 'sample_column_3'],
    }),
  ).toEqual(['sample_column_1', 'sample_column_3']);
});

test('saved metric values', () => {
  const controlState = {
    ...sharedControls.metrics,
    savedMetrics: [
      { metric_name: 'saved_metric_1' },
      { metric_name: 'saved_metric_2' },
    ],
  };

  expect(
    getValues({
      ...controlState,
      value: 'saved_metric_1',
    }),
  ).toEqual(controlState.default);

  expect(
    getValues({
      ...controlState,
      value: 'saved_metric_2',
    }),
  ).toEqual('saved_metric_2');

  expect(
    getValues({
      ...controlState,
      value: ['saved_metric_1', 'saved_metric_2'],
    }),
  ).toEqual(['saved_metric_2']);
});

test('simple ad-hoc metric values', () => {
  const controlState = {
    ...sharedControls.metrics,
    columns: [
      { column_name: 'sample_column_1' },
      { column_name: 'sample_column_2' },
      { column_name: 'sample_column_3' },
    ],
  };

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SIMPLE',
        column: { column_name: 'sample_column_1' },
      },
    }),
  ).toEqual({
    expressionType: 'SIMPLE',
    column: { column_name: 'sample_column_1' },
  });

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SIMPLE',
        column: { column_name: 'sample_column_2' },
      },
    }),
  ).toEqual(controlState.default);

  expect(
    getValues({
      ...controlState,
      value: [
        {
          expressionType: 'SIMPLE',
          column: { column_name: 'sample_column_1' },
        },
        {
          expressionType: 'SIMPLE',
          column: { column_name: 'sample_column_2' },
        },
      ],
    }),
  ).toEqual([
    { expressionType: 'SIMPLE', column: { column_name: 'sample_column_1' } },
  ]);
});

test('SQL ad-hoc metric values', () => {
  const controlState = {
    ...sharedControls.metrics,
  };

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SQL',
        sqlExpression: 'select * from sample_column_1;',
      },
    }),
  ).toEqual({
    datasourceWarning: true,
    expressionType: 'SQL',
    sqlExpression: 'select * from sample_column_1;',
  });
});

test('simple ad-hoc filter values', () => {
  const controlState = {
    ...sharedControls.adhoc_filters,
    columns: [
      { column_name: 'sample_column_1' },
      { column_name: 'sample_column_2' },
      { column_name: 'sample_column_3' },
    ],
  };

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SIMPLE',
        subject: 'sample_column_1',
      },
    }),
  ).toEqual({
    expressionType: 'SIMPLE',
    subject: 'sample_column_1',
  });

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SIMPLE',
        subject: 'sample_column_2',
      },
    }),
  ).toEqual(controlState.default);

  expect(
    getValues({
      ...controlState,
      value: [
        {
          expressionType: 'SIMPLE',
          subject: 'sample_column_1',
        },
        {
          expressionType: 'SIMPLE',
          subject: 'sample_column_2',
        },
      ],
    }),
  ).toEqual([{ expressionType: 'SIMPLE', subject: 'sample_column_1' }]);
});

test('SQL ad-hoc filter values', () => {
  const controlState = {
    ...sharedControls.adhoc_filters,
  };

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SQL',
        sqlExpression: 'select * from sample_column_1;',
      },
    }),
  ).toEqual({
    datasourceWarning: true,
    expressionType: 'SQL',
    sqlExpression: 'select * from sample_column_1;',
  });
});

test('no controlState value but valid column in datasource', () => {
  const controlState = {
    ...sharedControls.columns,
    options: [], // no options in the control state
  };

  expect(
    getValues({
      ...controlState,
      value: 'sample_column_1', // column only available in datasource
    }),
  ).toEqual('sample_column_1');

  expect(
    getValues({
      ...controlState,
      value: 'non_existing_column',
    }),
  ).toEqual(controlState.default);
});

test('no controlState value but valid saved metric in datasource', () => {
  const controlState = {
    ...sharedControls.metrics,
    savedMetrics: [], // no saved metrics in the control state
  };

  expect(
    getValues({
      ...controlState,
      value: 'saved_metric_2', // metric only available in datasource
    }),
  ).toEqual('saved_metric_2');

  expect(
    getValues({
      ...controlState,
      value: 'non_existing_metric',
    }),
  ).toEqual(controlState.default);
});

test('no controlState value but valid adhoc metric in datasource', () => {
  const controlState = {
    ...sharedControls.metrics,
    columns: [], // no columns in control state
  };

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SIMPLE',
        column: { column_name: 'sample_column_1' }, // only in datasource
      },
    }),
  ).toEqual({
    expressionType: 'SIMPLE',
    column: { column_name: 'sample_column_1' },
  });

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SIMPLE',
        column: { column_name: 'non_existing_column' },
      },
    }),
  ).toEqual(controlState.default);
});

test('no controlState value but valid adhoc filter in datasource', () => {
  const controlState = {
    ...sharedControls.adhoc_filters,
    columns: [], // no columns in control state
  };

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SIMPLE',
        subject: 'sample_column_1', // column available in datasource
      },
    }),
  ).toEqual({
    expressionType: 'SIMPLE',
    subject: 'sample_column_1',
  });

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SIMPLE',
        subject: 'non_existing_column',
      },
    }),
  ).toEqual(controlState.default);
});

test('SQL ad-hoc metric values without controlState columns', () => {
  const controlState = {
    ...sharedControls.metrics,
    columns: [], // No columns in controlState
  };

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SQL',
        sqlExpression: 'SELECT COUNT(*) FROM sample_table;',
      },
    }),
  ).toEqual({
    datasourceWarning: true,
    expressionType: 'SQL',
    sqlExpression: 'SELECT COUNT(*) FROM sample_table;',
  });

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SQL',
        sqlExpression: 'SELECT column FROM non_existing_table;',
      },
    }),
  ).toEqual({
    datasourceWarning: true,
    expressionType: 'SQL',
    sqlExpression: 'SELECT column FROM non_existing_table;',
  });
});

test('SQL ad-hoc filter values without controlState columns', () => {
  const controlState = {
    ...sharedControls.adhoc_filters,
    columns: [], // No columns in controlState
  };

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SQL',
        sqlExpression: 'SELECT * FROM sample_table WHERE column = 1;',
      },
    }),
  ).toEqual({
    datasourceWarning: true,
    expressionType: 'SQL',
    sqlExpression: 'SELECT * FROM sample_table WHERE column = 1;',
  });

  expect(
    getValues({
      ...controlState,
      value: {
        expressionType: 'SQL',
        sqlExpression: 'SELECT * FROM non_existing_table;',
      },
    }),
  ).toEqual({
    datasourceWarning: true,
    expressionType: 'SQL',
    sqlExpression: 'SELECT * FROM non_existing_table;',
  });
});
