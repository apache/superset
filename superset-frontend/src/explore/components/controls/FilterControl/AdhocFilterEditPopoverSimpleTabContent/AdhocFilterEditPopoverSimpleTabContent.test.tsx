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
import * as redux from 'react-redux';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';

import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import {
  AGGREGATES,
  Operators,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
} from 'src/explore/constants';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import fetchMock from 'fetch-mock';

import { TestDataset, Dataset } from '@superset-ui/chart-controls';
import AdhocFilterEditPopoverSimpleTabContent, {
  useSimpleTabFilterProps,
  Props,
} from '.';
import { Clauses, ExpressionTypes } from '../types';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: ExpressionTypes.Simple,
  subject: 'value',
  operatorId: Operators.GreaterThan,
  operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GreaterThan].operation,
  comparator: '10',
  clause: Clauses.Where,
});

const advancedTypeTestAdhocFilterTest = new AdhocFilter({
  expressionType: ExpressionTypes.Simple,
  subject: 'advancedDataType',
  operatorId: undefined,
  operator: undefined,
  comparator: undefined,
  clause: undefined,
});

const simpleMultiAdhocFilter = new AdhocFilter({
  expressionType: ExpressionTypes.Simple,
  subject: 'value',
  operatorId: Operators.In,
  operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.In].operation,
  comparator: ['10'],
  clause: Clauses.Where,
});

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: ExpressionTypes.Simple,
  column: { type: 'VARCHAR(255)', column_name: 'source', id: 5 },
  aggregate: AGGREGATES.SUM,
  label: 'test-AdhocMetric',
});

const simpleCustomFilter = new AdhocFilter({
  expressionType: ExpressionTypes.Simple,
  subject: 'ds',
  operator: 'LATEST PARTITION',
  operatorId: Operators.LatestPartition,
});

const options = [
  { type: 'VARCHAR(255)', column_name: 'source', id: 1 },
  { type: 'VARCHAR(255)', column_name: 'target', id: 2 },
  { type: 'DOUBLE', column_name: 'value', id: 3 },
  { saved_metric_name: 'my_custom_metric', id: 4 },
  sumValueAdhocMetric,
];

const getAdvancedDataTypeTestProps = (overrides?: Record<string, unknown>) => {
  const onChange = jest.fn();
  const validHandler = jest.fn();
  const props = {
    adhocFilter: advancedTypeTestAdhocFilterTest,
    onChange,
    options: [{ type: 'DOUBLE', column_name: 'advancedDataType', id: 5 }],
    datasource: {
      ...TestDataset,

      columns: [],
      filter_select: false,
    },
    partitionColumn: 'test',
    ...overrides,
    validHandler,
  };
  return props;
};

function setup(overrides?: Record<string, unknown>) {
  const onChange = jest.fn();
  const validHandler = jest.fn();
  const spy = jest.spyOn(redux, 'useSelector');
  spy.mockReturnValue({});
  const props = {
    adhocFilter: simpleAdhocFilter,
    onChange,
    options,
    datasource: {
      ...TestDataset,

      columns: [],
      filter_select: false,
    },
    partitionColumn: 'test',
    ...overrides,
    validHandler,
  };
  render(
    <AdhocFilterEditPopoverSimpleTabContent {...(props as unknown as Props)} />,
  );
  return props;
}

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const ADVANCED_DATA_TYPE_ENDPOINT_VALID =
  'glob:*/api/v1/advanced_data_type/convert?q=(type:type,values:!(v))';
const ADVANCED_DATA_TYPE_ENDPOINT_INVALID =
  'glob:*/api/v1/advanced_data_type/convert?q=(type:type,values:!(e))';

fetchMock.get(ADVANCED_DATA_TYPE_ENDPOINT_VALID, {
  result: {
    display_value: 'VALID',
    error_message: '',
    valid_filter_operators: [Operators.Equals],
    values: ['VALID'],
  },
});
fetchMock.get(ADVANCED_DATA_TYPE_ENDPOINT_INVALID, {
  result: {
    display_value: '',
    error_message: 'error',
    valid_filter_operators: [],
    values: [],
  },
});

const mockStore = configureStore([thunk]);
const store = mockStore({});

// Either a JSON body ({ result, limit }), a fetch-mock response config
// ({ status, body } / { throws }) so a test can make the server fail, or a
// per-call function for stateful routes. fetch-mock reads this lazily at
// request-match time -- reassigning the variable changes what EARLIER,
// still-unmatched requests resolve with -- so a test whose earlier request
// must still be IN FLIGHT at reassignment time has to use the function
// form. Once the earlier response has settled, plain reassignment is safe.
let columnValuesResponse: unknown = { result: [], limit: 10000 };

let isFeatureEnabledMock: jest.SpyInstance;

beforeEach(() => {
  fetchMock.clearHistory();
  // Reset the shared route: a prior test's stateful function (with its
  // closed-over call counter) must not serve the next test's requests.
  columnValuesResponse = { result: [], limit: 10000 };
  isFeatureEnabledMock = mockedIsFeatureEnabled.mockImplementation(
    (featureFlag: FeatureFlag) =>
      featureFlag === FeatureFlag.EnableAdvancedDataTypes,
  );
});

afterAll(() => {
  if (isFeatureEnabledMock) {
    isFeatureEnabledMock.mockRestore();
  }
});

test('can render the simple tab form', () => {
  expect(() => setup()).not.toThrow();
});

test('shows boolean only operators when subject is boolean', () => {
  const props = setup({
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operatorId: undefined,
      operator: undefined,
      comparator: undefined,
      clause: undefined,
    }),
    datasource: {
      columns: [
        {
          id: 3,
          column_name: 'value',
          type: 'BOOL',
        },
      ],
    },
  });
  const { isOperatorRelevant } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  [
    Operators.IsTrue,
    Operators.IsFalse,
    Operators.IsNull,
    Operators.IsFalse,
  ].map(operator => expect(isOperatorRelevant(operator, 'value')).toBe(true));
});

test('shows boolean only operators when subject is number', () => {
  const props = setup({
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operatorId: undefined,
      operator: undefined,
      comparator: undefined,
      clause: undefined,
    }),
    datasource: {
      columns: [
        {
          id: 3,
          column_name: 'value',
          type: 'INT',
        },
      ],
    },
  });
  const { isOperatorRelevant } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  [
    Operators.IsTrue,
    Operators.IsFalse,
    Operators.IsNull,
    Operators.IsNotNull,
  ].map(operator => expect(isOperatorRelevant(operator, 'value')).toBe(true));
});

test('shows array operators (tier 1 + tier 2) when subject is multi-value', () => {
  const props = setup({
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'skills',
      operatorId: undefined,
      operator: undefined,
      comparator: undefined,
      clause: undefined,
    }),
    datasource: {
      columns: [
        {
          id: 3,
          column_name: 'skills',
          type: 'Array(String)',
          type_generic: GenericDataType.MultiValue,
        },
      ],
    },
  });
  const { isOperatorRelevant } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  // Tier 1 (whole-array) + Tier 2 (element-level) are all relevant.
  [
    Operators.Equals,
    Operators.NotEquals,
    Operators.In,
    Operators.NotIn,
    Operators.IsNull,
    Operators.IsNotNull,
    Operators.ContainsAny,
    Operators.ContainsAll,
    Operators.IsEmpty,
    Operators.IsNotEmpty,
  ].forEach(operator =>
    expect(isOperatorRelevant(operator, 'skills')).toBe(true),
  );
  // scalar-only operators are hidden for array columns
  [Operators.GreaterThan, Operators.LessThan, Operators.Like].forEach(
    operator => expect(isOperatorRelevant(operator, 'skills')).toBe(false),
  );
});

test('hides element-level array operators for non multi-value columns', () => {
  const props = setup({
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operatorId: undefined,
      operator: undefined,
      comparator: undefined,
      clause: undefined,
    }),
    datasource: {
      columns: [{ id: 3, column_name: 'value', type: 'STRING' }],
    },
  });
  const { isOperatorRelevant } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  [
    Operators.ContainsAny,
    Operators.ContainsAll,
    Operators.IsEmpty,
    Operators.IsNotEmpty,
  ].forEach(operator =>
    expect(isOperatorRelevant(operator, 'value')).toBe(false),
  );
});

test('will convert from individual comparator to array if the operator changes to multi', () => {
  const props = setup();
  const { onOperatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  onOperatorChange(Operators.In);
  expect(props.onChange.mock.calls.length === 1).toBe(true);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
      .comparator,
  ).toEqual(['10']);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
      .operatorId,
  ).toEqual(Operators.In);
});

test('will preserve boolean false comparator when converting to multi operator', () => {
  const booleanFalseFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'value',
    operatorId: Operators.Equals,
    operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.Equals].operation,
    comparator: false,
    clause: Clauses.Where,
  });
  const props = setup({ adhocFilter: booleanFalseFilter });
  const { onOperatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  onOperatorChange(Operators.In);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
      .comparator,
  ).toEqual([false]);
});

test('will convert from array to individual comparators if the operator changes from multi', () => {
  const props = setup({
    adhocFilter: simpleMultiAdhocFilter,
  });
  const { onOperatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  onOperatorChange(Operators.LessThan);
  expect(props.onChange.mock.calls.length === 1).toBe(true);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0],
  ).toEqual(
    simpleMultiAdhocFilter.duplicateWith({
      operatorId: Operators.LessThan,
      operator: '<',
      comparator: '10',
    }),
  );
});

test('resets the comparator when switching between array value families', () => {
  // Equal to (whole-array literal) -> Contains all (individual elements):
  // the value spaces are incompatible, so the stale value must be cleared.
  const wholeArrayFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'scores',
    operatorId: Operators.Equals,
    operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.Equals].operation,
    comparator: '[5,6,7]',
    clause: Clauses.Where,
  });
  const props = setup({ adhocFilter: wholeArrayFilter });
  const { onOperatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  onOperatorChange(Operators.ContainsAll);
  const lastCall =
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0];
  expect(lastCall.operatorId).toEqual(Operators.ContainsAll);
  expect(lastCall.comparator).toBeUndefined();
});

test('keeps the value when switching within the element family', () => {
  // Contains any <-> Contains all both take individual elements, so the
  // selected elements should carry over.
  const elementFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'scores',
    operatorId: Operators.ContainsAny,
    operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.ContainsAny].operation,
    comparator: ['5', '6'],
    clause: Clauses.Where,
  });
  const props = setup({ adhocFilter: elementFilter });
  const { onOperatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  onOperatorChange(Operators.ContainsAll);
  const lastCall =
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0];
  expect(lastCall.comparator).toEqual(['5', '6']);
});

test('passes the new adhocFilter to onChange after onComparatorChange', () => {
  const props = setup();
  const { onComparatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  onComparatorChange('20');
  expect(props.onChange.mock.calls.length === 1).toBe(true);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0],
  ).toEqual(simpleAdhocFilter.duplicateWith({ comparator: '20' }));
});

test('will filter operators for table datasources', () => {
  const props = setup({ datasource: { type: 'table' as const } });
  const { isOperatorRelevant } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  expect(isOperatorRelevant(Operators.Like, 'value')).toBe(true);
});

test('will show LATEST PARTITION operator', () => {
  const props = setup({
    datasource: {
      type: 'table' as const,
      datasource_name: 'table1',
      schema: 'schema',
    },
    adhocFilter: simpleCustomFilter,
    partitionColumn: 'ds',
  });
  const { isOperatorRelevant } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  expect(isOperatorRelevant(Operators.LatestPartition, 'ds')).toBe(true);
  expect(isOperatorRelevant(Operators.LatestPartition, 'value')).toBe(false);
});

test('will generate custom sqlExpression for LATEST PARTITION operator', () => {
  const testAdhocFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'ds',
  });
  const props = setup({
    datasource: {
      type: 'table' as const,
      datasource_name: 'table1',
      schema: 'schema',
    },
    adhocFilter: testAdhocFilter,
    partitionColumn: 'ds',
  });
  const { onOperatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  onOperatorChange(Operators.LatestPartition);
  expect(props.onChange.mock.calls.length === 1).toBe(true);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0],
  ).toEqual(
    testAdhocFilter.duplicateWith({
      subject: 'ds',
      operator: 'LATEST PARTITION',
      operatorId: Operators.LatestPartition,
      comparator: null,
      clause: 'WHERE',
      expressionType: 'SQL',
      sqlExpression: "ds = '{{ presto.latest_partition('schema.table1') }}'",
    }),
  );
});

test('will not display boolean operators when column type is string', () => {
  const props = setup({
    datasource: {
      type: 'table' as const,
      datasource_name: 'table1',
      schema: 'schema',
      columns: [{ column_name: 'value', type: 'STRING' }],
    },
    adhocFilter: simpleAdhocFilter,
  });
  const { isOperatorRelevant } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  const booleanOnlyOperators = [Operators.IsTrue, Operators.IsFalse];
  booleanOnlyOperators.forEach(operator => {
    expect(isOperatorRelevant(operator, 'value')).toBe(false);
  });
});

test.each(['STRING', 'DATE'])(
  'will not display boolean operators when an expression column declares type %s',
  type => {
    const props = setup({
      datasource: {
        type: 'table' as const,
        datasource_name: 'table1',
        schema: 'schema',
        columns: [{ column_name: 'value', type, expression: '"value"' }],
      },
      adhocFilter: simpleAdhocFilter,
    });
    const { isOperatorRelevant } = useSimpleTabFilterProps(
      props as unknown as Props,
    );
    const booleanOnlyOperators = [Operators.IsTrue, Operators.IsFalse];
    booleanOnlyOperators.forEach(operator => {
      expect(isOperatorRelevant(operator, 'value')).toBe(false);
    });
  },
);

test('will display boolean operators when column is an expression', () => {
  const props = setup({
    datasource: {
      type: 'table' as const,
      datasource_name: 'table1',
      schema: 'schema',
      columns: [
        {
          column_name: 'value',
          expression: 'case when value is 0 then "NO"',
        },
      ],
    },
    adhocFilter: simpleAdhocFilter,
  });
  const { isOperatorRelevant } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  const booleanOnlyOperators = [Operators.IsTrue, Operators.IsFalse];
  booleanOnlyOperators.forEach(operator => {
    expect(isOperatorRelevant(operator, 'value')).toBe(true);
  });
});

test('sets comparator to undefined when operator is IS_TRUE', () => {
  const props = setup();
  const { onOperatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  onOperatorChange(Operators.IsTrue);
  expect(props.onChange.mock.calls.length === 1).toBe(true);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
      .operatorId,
  ).toBe(Operators.IsTrue);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0].operator,
  ).toBe('IS TRUE');
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
      .comparator,
  ).toBe(undefined);
});

test('sets comparator to undefined when operator is IS_FALSE', () => {
  const props = setup();
  const { onOperatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  onOperatorChange(Operators.IsFalse);
  expect(props.onChange.mock.calls.length === 1).toBe(true);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
      .operatorId,
  ).toBe(Operators.IsFalse);
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0].operator,
  ).toBe('IS FALSE');
  expect(
    props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
      .comparator,
  ).toBe(undefined);
});

test('sets comparator to undefined when operator is IS_NULL or IS_NOT_NULL', () => {
  const props = setup();
  const { onOperatorChange } = useSimpleTabFilterProps(
    props as unknown as Props,
  );
  [Operators.IsNull, Operators.IsNotNull].forEach(op => {
    onOperatorChange(op);
    expect(props.onChange.mock.calls.length > 0).toBe(true);
    expect(
      props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
        .operatorId,
    ).toBe(op);
    expect(
      props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
        .operator,
    ).toBe(OPERATOR_ENUM_TO_OPERATOR_TYPE[op].operation);
    expect(
      props.onChange.mock.calls[props.onChange.mock.calls.length - 1][0]
        .comparator,
    ).toBe(undefined);
  });
});

test('hides the value input when operator is IS_NULL', () => {
  setup({
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operatorId: Operators.IsNull,
      operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.IsNull].operation,
      comparator: undefined,
      clause: Clauses.Where,
    }),
  });
  expect(
    screen.queryByPlaceholderText('Filter value (case sensitive)'),
  ).not.toBeInTheDocument();
});

test('hides the value input when operator is IS_NOT_NULL', () => {
  setup({
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operatorId: Operators.IsNotNull,
      operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.IsNotNull].operation,
      comparator: undefined,
      clause: Clauses.Where,
    }),
  });
  expect(
    screen.queryByPlaceholderText('Filter value (case sensitive)'),
  ).not.toBeInTheDocument();
});

test('hides the value input when operator is IS_TRUE', () => {
  setup({
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operatorId: Operators.IsTrue,
      operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.IsTrue].operation,
      comparator: undefined,
      clause: Clauses.Where,
    }),
  });
  expect(
    screen.queryByPlaceholderText('Filter value (case sensitive)'),
  ).not.toBeInTheDocument();
});

test('hides the value input when operator is IS_FALSE', () => {
  setup({
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operatorId: Operators.IsFalse,
      operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.IsFalse].operation,
      comparator: undefined,
      clause: Clauses.Where,
    }),
  });
  expect(
    screen.queryByPlaceholderText('Filter value (case sensitive)'),
  ).not.toBeInTheDocument();
});

test('should not call API when column has no advanced data type', async () => {
  const props = getAdvancedDataTypeTestProps();

  await act(async () => {
    render(
      <AdhocFilterEditPopoverSimpleTabContent
        {...(props as unknown as Props)}
      />,
      {
        store,
      },
    );
  });

  const filterValueField = screen.getByPlaceholderText(
    'Filter value (case sensitive)',
  );
  await act(async () => {
    userEvent.type(filterValueField, 'v');
  });

  await act(async () => {
    userEvent.type(filterValueField, '{enter}');
  });

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(ADVANCED_DATA_TYPE_ENDPOINT_VALID),
    ).toHaveLength(0),
  );
});

test('should call API when column has advanced data type', async () => {
  const props = getAdvancedDataTypeTestProps({
    options: [
      {
        type: 'DOUBLE',
        column_name: 'advancedDataType',
        id: 5,
        advanced_data_type: 'type',
      },
    ],
  });

  await act(async () => {
    render(
      <AdhocFilterEditPopoverSimpleTabContent
        {...(props as unknown as Props)}
      />,
      {
        store,
      },
    );
  });

  const filterValueField = screen.getByPlaceholderText(
    'Filter value (case sensitive)',
  );
  await act(async () => {
    userEvent.type(filterValueField, 'v');
  });

  await act(async () => {
    userEvent.type(filterValueField, '{enter}');
  });

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(ADVANCED_DATA_TYPE_ENDPOINT_VALID),
    ).toHaveLength(1),
  );
  expect(
    props.validHandler.mock.calls[props.validHandler.mock.calls.length - 1][0],
  ).toBe(true);
});

test('save button should be disabled if error message from API is returned', async () => {
  const props = getAdvancedDataTypeTestProps({
    options: [
      {
        type: 'DOUBLE',
        column_name: 'advancedDataType',
        id: 5,
        advanced_data_type: 'type',
      },
    ],
  });

  await act(async () => {
    render(
      <AdhocFilterEditPopoverSimpleTabContent
        {...(props as unknown as Props)}
      />,
      {
        store,
      },
    );
  });

  const filterValueField = screen.getByPlaceholderText(
    'Filter value (case sensitive)',
  );
  await act(async () => {
    userEvent.type(filterValueField, 'e');
  });

  await act(async () => {
    userEvent.type(filterValueField, '{enter}');
  });

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(ADVANCED_DATA_TYPE_ENDPOINT_INVALID),
    ).toHaveLength(1),
  );
  expect(
    props.validHandler.mock.calls[props.validHandler.mock.calls.length - 1][0],
  ).toBe(false);
});

test('advanced data type operator list should update after API response', async () => {
  const props = getAdvancedDataTypeTestProps({
    options: [
      {
        type: 'DOUBLE',
        column_name: 'advancedDataType',
        id: 5,
        advanced_data_type: 'type',
      },
    ],
  });

  await act(async () => {
    render(
      <AdhocFilterEditPopoverSimpleTabContent
        {...(props as unknown as Props)}
      />,
      {
        store,
      },
    );
  });

  const filterValueField = screen.getByPlaceholderText(
    'Filter value (case sensitive)',
  );
  await act(async () => {
    userEvent.type(filterValueField, 'v');
  });

  await act(async () => {
    userEvent.type(filterValueField, '{enter}');
  });

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(ADVANCED_DATA_TYPE_ENDPOINT_VALID),
    ).toHaveLength(1),
  );
  expect(
    props.validHandler.mock.calls[props.validHandler.mock.calls.length - 1][0],
  ).toBe(true);

  const operatorValueField = screen.getByRole('combobox', {
    name: 'Select operator',
  });

  userEvent.click(operatorValueField);

  await act(async () => {
    userEvent.type(operatorValueField, '{enter}');
  });

  expect(
    await screen.findByText('Equal to (=)', {
      selector: '.ant-select-content-has-value, .ant-select-selection-item',
    }),
  ).toBeInTheDocument();
});

test('dropdown should remain open when clicked after filter is configured', async () => {
  const onChange = jest.fn();
  const validHandler = jest.fn();
  const spy = jest.spyOn(redux, 'useSelector');
  spy.mockReturnValue({});

  const filterWithSubjectAndOperator = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'value',
    operatorId: Operators.Equals,
    operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.Equals].operation,
    comparator: '10',
    clause: Clauses.Where,
  });

  const props = {
    adhocFilter: filterWithSubjectAndOperator,
    onChange,
    options,
    datasource: {
      ...TestDataset,
      columns: [{ column_name: 'value', type: 'DOUBLE', id: 3 }],
      filter_select: false,
    } as Dataset,
    partitionColumn: 'test',
    validHandler,
  };

  render(
    <AdhocFilterEditPopoverSimpleTabContent {...(props as unknown as Props)} />,
  );

  const operatorDropdown = screen.getByRole('combobox', {
    name: 'Select operator',
  });

  await act(async () => {
    userEvent.click(operatorDropdown);
  });

  await waitFor(() => {
    expect(operatorDropdown).toHaveAttribute('aria-expanded', 'true');
  });

  expect(operatorDropdown).toHaveAttribute('aria-expanded', 'true');
});

test('filters the subject select by column verbose_name as well as column_name', async () => {
  setup({
    options: [
      {
        type: 'BIGINT',
        column_name: 'num',
        verbose_name: 'total_count',
        id: 1,
      },
      {
        type: 'VARCHAR(255)',
        column_name: 'name',
        verbose_name: 'Full Name',
        id: 2,
      },
    ],
  });

  const combobox = screen.getByRole('combobox', { name: 'Select subject' });
  userEvent.click(combobox);

  await userEvent.type(combobox, 'total');

  const dropdown = document.querySelector(
    '.ant-select-dropdown-list',
  ) as HTMLElement;
  expect(within(dropdown).getByText('total_count')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Full Name')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'num');

  expect(within(dropdown).getByText('total_count')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Full Name')).not.toBeInTheDocument();
});

const COLUMN_VALUES_ENDPOINT =
  'glob:*/api/v1/datasource/*/column/value/values/*';

// Route for COLUMN_VALUES_ENDPOINT; the response contract and its
// lazy-read trap are documented at columnValuesResponse's declaration.
fetchMock.get(COLUMN_VALUES_ENDPOINT, (...args: unknown[]) =>
  typeof columnValuesResponse === 'function'
    ? columnValuesResponse(...args)
    : columnValuesResponse,
);

const setupWithFilterValuesResponse = (response: unknown) => {
  columnValuesResponse = response;
  const onChange = jest.fn();
  const validHandler = jest.fn();
  const spy = jest.spyOn(redux, 'useSelector');
  spy.mockReturnValue({});
  const props = {
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operatorId: Operators.In,
      operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.In].operation,
      comparator: [],
      clause: Clauses.Where,
    }),
    onChange,
    options,
    datasource: {
      ...TestDataset,
      columns: [{ column_name: 'value', type: 'VARCHAR', id: 3 }],
      filter_select: true,
    },
    partitionColumn: 'test',
    validHandler,
  };
  const { rerender } = render(
    <AdhocFilterEditPopoverSimpleTabContent {...(props as unknown as Props)} />,
  );
  return { ...props, rerender };
};

const setupWithFilterValues = (result: unknown[], limit = 10000) =>
  setupWithFilterValuesResponse({ result, limit });

const SUGGESTIONS_UNAVAILABLE = /Suggestions could not be loaded/;

const openComparator = async () => {
  const comparator = screen.getByRole('combobox', {
    name: 'Comparator option',
  });
  userEvent.click(comparator);
  return comparator;
};

test('loads comparator values from the server', async () => {
  setupWithFilterValues(['alpha', 'beta']);
  await openComparator();
  expect(await screen.findByTitle('alpha')).toBeInTheDocument();
});

test('sends the typed text to the server rather than filtering the loaded page', async () => {
  // The loaded page is bounded, so matching client-side cannot reach a value
  // beyond the row limit. The search has to reach the database.
  setupWithFilterValues(['alpha']);
  const comparator = await openComparator();
  userEvent.type(comparator, 'gamma');

  await waitFor(
    () => {
      const searched = fetchMock.callHistory
        .calls(COLUMN_VALUES_ENDPOINT)
        .map(call => String(call.url));
      expect(searched.some(url => url.includes('q=gamma'))).toBe(true);
    },
    { timeout: 3000 },
  );
});

test('lets a value the server did not return still be selected', async () => {
  // Even with server-side search a match can fall outside the page; typing the
  // exact value has to remain a way through.
  setupWithFilterValues([]);
  const comparator = await openComparator();
  userEvent.type(comparator, 'not-in-the-page');
  expect(await screen.findByTitle('not-in-the-page')).toBeInTheDocument();
});

test('does not query for values when the dataset disables them', async () => {
  fetchMock.clearHistory();
  setup({
    adhocFilter: new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'value',
      operatorId: Operators.In,
      operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.In].operation,
      comparator: [],
      clause: Clauses.Where,
    }),
  });
  await openComparator();
  expect(fetchMock.callHistory.calls(COLUMN_VALUES_ENDPOINT)).toHaveLength(0);
});

test('stores the picked value, not the option object', async () => {
  // AsyncSelect is labelInValue: taking its argument at face value puts
  // {label, value} into the comparator, and the engine then fails to render it
  // as a literal.
  const props = setupWithFilterValues(['Michael']);
  await openComparator();
  userEvent.click(await screen.findByTitle('Michael'));

  await waitFor(() => expect(props.onChange).toHaveBeenCalled());
  const [filter] = props.onChange.mock.calls.at(-1);
  expect(filter.comparator).toEqual(['Michael']);
});

test('can remove a value that was saved earlier', async () => {
  // Reopening the popover restores the comparator from the saved filter, and
  // the value is not in the freshly loaded page. Removing it has to still work.
  columnValuesResponse = { result: [], limit: 10000 };
  const onChange = jest.fn();
  const validHandler = jest.fn();
  jest.spyOn(redux, 'useSelector').mockReturnValue({});
  render(
    <AdhocFilterEditPopoverSimpleTabContent
      {...({
        adhocFilter: new AdhocFilter({
          expressionType: ExpressionTypes.Simple,
          subject: 'value',
          operatorId: Operators.In,
          operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.In].operation,
          comparator: ['Michael'],
          clause: Clauses.Where,
        }),
        onChange,
        options,
        datasource: {
          ...TestDataset,
          columns: [{ column_name: 'value', type: 'VARCHAR', id: 3 }],
          filter_select: true,
        },
        partitionColumn: 'test',
        validHandler,
      } as unknown as Props)}
    />,
  );

  // Remove it the way a user does: the tag's own close control.
  userEvent.click(await screen.findByLabelText('close'));

  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const [filter] = onChange.mock.calls.at(-1);
  expect(filter.comparator).toEqual([]);
});

test('says the list is partial when the server capped it', async () => {
  setupWithFilterValues(['alpha', 'beta'], 2);
  await openComparator();
  expect(
    await screen.findByText(/Only the first 2 values are listed/),
  ).toBeInTheDocument();
});

test('does not say the list is partial when it is complete', async () => {
  setupWithFilterValues(['alpha', 'beta'], 10000);
  await openComparator();
  expect(await screen.findByTitle('alpha')).toBeInTheDocument();
  expect(screen.queryByText(/Only the first/)).not.toBeInTheDocument();
});

test('says suggestions could not be loaded when the server fails', async () => {
  // A failed request used to render exactly like a column with no values,
  // which is how a 500 on every semantic view went unreported for months.
  const props = setupWithFilterValuesResponse({
    status: 500,
    body: { message: 'Fatal error' },
  });
  await openComparator();
  expect(await screen.findByText(SUGGESTIONS_UNAVAILABLE)).toBeInTheDocument();

  // The note must not cost the user the way through: typing still works.
  const comparator = screen.getByRole('combobox', {
    name: 'Comparator option',
  });
  userEvent.type(comparator, 'typed-by-hand');
  userEvent.click(await screen.findByTitle('typed-by-hand'));
  await waitFor(() => expect(props.onChange).toHaveBeenCalled());
  const [filter] = props.onChange.mock.calls.at(-1);
  expect(filter.comparator).toEqual(['typed-by-hand']);
});

test('says suggestions could not be loaded when the request gets no answer', async () => {
  // A network failure rejects with no response at all (the client retries
  // those itself, so it is stubbed above the transport).
  jest
    .spyOn(SupersetClient, 'get')
    .mockRejectedValueOnce(new TypeError('Failed to fetch'));
  setupWithFilterValues([]);
  await openComparator();
  expect(await screen.findByText(SUGGESTIONS_UNAVAILABLE)).toBeInTheDocument();
});

test('stays quiet when the server refuses the request', async () => {
  // A 4xx is the caller's problem, not an outage; the picker behaves as before.
  fetchMock.clearHistory();
  setupWithFilterValuesResponse({
    status: 400,
    body: { message: 'Column name value does not exist' },
  });
  await openComparator();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(COLUMN_VALUES_ENDPOINT)).toHaveLength(1),
  );
  expect(await screen.findByText('Type a value here')).toBeInTheDocument();
  expect(screen.queryByText(SUGGESTIONS_UNAVAILABLE)).not.toBeInTheDocument();
});

test('shows a plain empty list when the server has no values', async () => {
  fetchMock.clearHistory();
  setupWithFilterValues([]);
  await openComparator();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(COLUMN_VALUES_ENDPOINT)).toHaveLength(1),
  );
  expect(await screen.findByText('Type a value here')).toBeInTheDocument();
  expect(screen.queryByText(SUGGESTIONS_UNAVAILABLE)).not.toBeInTheDocument();
});

test('ignores a stale failing response that loses the race to a newer success', async () => {
  // The outage the note exists for is a slow endpoint -- which is exactly
  // when a failing response can resolve AFTER a newer search already
  // succeeded. The loser must not stamp its note over the winner.
  //
  // The route is STATEFUL (routed by call count): only the function form
  // (see the route comment above) makes the base request genuinely pend
  // while the newer one succeeds -- with a plain reassignment only one
  // request would ever exist and this test would pass with the staleness
  // guard deleted.
  let resolveSlowFailure: (value: unknown) => void = () => {};
  const firstPending = new Promise(resolve => {
    resolveSlowFailure = resolve;
  });
  let landedCalls = 0;
  setupWithFilterValuesResponse(() => {
    landedCalls += 1;
    return landedCalls === 1
      ? firstPending
      : { result: ['alpha'], limit: 10000 };
  });
  const comparator = await openComparator();
  await waitFor(() => expect(landedCalls).toBe(1));

  // A newer request succeeds while the first is still pending.
  userEvent.type(comparator, 'al');
  expect(
    await screen.findByTitle('alpha', {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(landedCalls).toBe(2);

  // Now the original request fails -- too late to matter. Flush it all the
  // way through explicitly: a waitFor on a negative assertion would pass
  // on the first tick, before the late rejection could land. (The single
  // macrotask assumes the rejection pipeline is microtask-only; after a
  // fetch-mock upgrade, re-run the guard-deleted control to reverify.)
  resolveSlowFailure({ status: 500, body: { message: 'Fatal error' } });
  await act(async () => {
    await firstPending;
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });
  });
  expect(screen.queryByText(SUGGESTIONS_UNAVAILABLE)).not.toBeInTheDocument();
});

test('does not carry the note to a different column', async () => {
  const props = setupWithFilterValuesResponse({
    status: 500,
    body: { message: 'Fatal error' },
  });
  await openComparator();
  expect(await screen.findByText(SUGGESTIONS_UNAVAILABLE)).toBeInTheDocument();

  // The parent applies a subject change by re-rendering with a new filter;
  // the note must reset with it -- the new column's own request decides what
  // is shown next.
  columnValuesResponse = { result: [], limit: 10000 };
  props.rerender(
    <AdhocFilterEditPopoverSimpleTabContent
      {...({
        ...props,
        adhocFilter: new AdhocFilter({
          expressionType: ExpressionTypes.Simple,
          subject: 'source',
          operatorId: Operators.In,
          operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.In].operation,
          comparator: [],
          clause: Clauses.Where,
        }),
      } as unknown as Props)}
    />,
  );
  await waitFor(() =>
    expect(screen.queryByText(SUGGESTIONS_UNAVAILABLE)).not.toBeInTheDocument(),
  );
});

test('drops the note once suggestions load again', async () => {
  setupWithFilterValuesResponse({
    status: 500,
    body: { message: 'Fatal error' },
  });
  const comparator = await openComparator();
  expect(await screen.findByText(SUGGESTIONS_UNAVAILABLE)).toBeInTheDocument();

  // A new search term is a new request; the server is back. Safe as a
  // plain reassignment: the first response has fully settled (the note is
  // already on screen), so the lazy read cannot hand it this value.
  columnValuesResponse = { result: ['alpha'], limit: 10000 };
  userEvent.type(comparator, 'al');
  expect(
    await screen.findByTitle('alpha', {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(screen.queryByText(SUGGESTIONS_UNAVAILABLE)).not.toBeInTheDocument();
});
