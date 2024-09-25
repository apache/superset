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
import sinon from 'sinon';
import { shallow } from 'enzyme';
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';

import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import {
  AGGREGATES,
  Operators,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
} from 'src/explore/constants';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import { render, screen, act, waitFor } from '@testing-library/react';
import { supersetTheme, FeatureFlag, ThemeProvider } from '@superset-ui/core';
import * as uiCore from '@superset-ui/core';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';

import { TestDataset } from '@superset-ui/chart-controls';
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
  operatorId: null,
  operator: null,
  comparator: null,
  clause: null,
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

const getAdvancedDataTypeTestProps = (overrides?: Record<string, any>) => {
  const onChange = sinon.spy();
  const validHandler = sinon.spy();
  const props = {
    adhocFilter: advancedTypeTestAdhocFilterTest,
    onChange,
    options: [{ type: 'DOUBLE', column_name: 'advancedDataType', id: 5 }],
    datasource: {
      ...TestDataset,
      ...{
        columns: [],
        filter_select: false,
      },
    },
    partitionColumn: 'test',
    ...overrides,
    validHandler,
  };
  return props;
};

function setup(overrides?: Record<string, any>) {
  const onChange = sinon.spy();
  const validHandler = sinon.spy();
  const spy = jest.spyOn(redux, 'useSelector');
  spy.mockReturnValue({});
  const props = {
    adhocFilter: simpleAdhocFilter,
    onChange,
    options,
    datasource: {
      ...TestDataset,
      ...{
        columns: [],
        filter_select: false,
      },
    },
    partitionColumn: 'test',
    ...overrides,
    validHandler,
  };
  const wrapper = shallow(
    <AdhocFilterEditPopoverSimpleTabContent {...props} />,
  );
  return { wrapper, props };
}

describe('AdhocFilterEditPopoverSimpleTabContent', () => {
  it('renders the simple tab form', () => {
    const { wrapper } = setup();
    expect(wrapper).toExist();
  });

  it('shows boolean only operators when subject is boolean', () => {
    const { props } = setup({
      adhocFilter: new AdhocFilter({
        expressionType: ExpressionTypes.Simple,
        subject: 'value',
        operatorId: null,
        operator: null,
        comparator: null,
        clause: null,
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
    const { isOperatorRelevant } = useSimpleTabFilterProps(props);
    [
      Operators.IsTrue,
      Operators.IsFalse,
      Operators.IsNull,
      Operators.IsFalse,
    ].map(operator => expect(isOperatorRelevant(operator, 'value')).toBe(true));
  });
  it('shows boolean only operators when subject is number', () => {
    const { props } = setup({
      adhocFilter: new AdhocFilter({
        expressionType: ExpressionTypes.Simple,
        subject: 'value',
        operatorId: null,
        operator: null,
        comparator: null,
        clause: null,
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
    const { isOperatorRelevant } = useSimpleTabFilterProps(props);
    [
      Operators.IsTrue,
      Operators.IsFalse,
      Operators.IsNull,
      Operators.IsNotNull,
    ].map(operator => expect(isOperatorRelevant(operator, 'value')).toBe(true));
  });

  it('will convert from individual comparator to array if the operator changes to multi', () => {
    const { props } = setup();
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    onOperatorChange(Operators.In);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0].comparator).toEqual(['10']);
    expect(props.onChange.lastCall.args[0].operatorId).toEqual(Operators.In);
  });

  it('will convert from array to individual comparators if the operator changes from multi', () => {
    const { props } = setup({
      adhocFilter: simpleMultiAdhocFilter,
    });
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    onOperatorChange(Operators.LessThan);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0]).toEqual(
      simpleMultiAdhocFilter.duplicateWith({
        operatorId: Operators.LessThan,
        operator: '<',
        comparator: '10',
      }),
    );
  });

  it('passes the new adhocFilter to onChange after onComparatorChange', () => {
    const { props } = setup();
    const { onComparatorChange } = useSimpleTabFilterProps(props);
    onComparatorChange('20');
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0]).toEqual(
      simpleAdhocFilter.duplicateWith({ comparator: '20' }),
    );
  });

  it('will filter operators for table datasources', () => {
    const { props } = setup({ datasource: { type: 'table' } });
    const { isOperatorRelevant } = useSimpleTabFilterProps(props);
    expect(isOperatorRelevant(Operators.Like, 'value')).toBe(true);
  });

  it('will show LATEST PARTITION operator', () => {
    const { props } = setup({
      datasource: {
        type: 'table',
        datasource_name: 'table1',
        schema: 'schema',
      },
      adhocFilter: simpleCustomFilter,
      partitionColumn: 'ds',
    });
    const { isOperatorRelevant } = useSimpleTabFilterProps(props);
    expect(isOperatorRelevant(Operators.LatestPartition, 'ds')).toBe(true);
    expect(isOperatorRelevant(Operators.LatestPartition, 'value')).toBe(false);
  });

  it('will generate custom sqlExpression for LATEST PARTITION operator', () => {
    const testAdhocFilter = new AdhocFilter({
      expressionType: ExpressionTypes.Simple,
      subject: 'ds',
    });
    const { props } = setup({
      datasource: {
        type: 'table',
        datasource_name: 'table1',
        schema: 'schema',
      },
      adhocFilter: testAdhocFilter,
      partitionColumn: 'ds',
    });
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    onOperatorChange(Operators.LatestPartition);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0]).toEqual(
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
  it('will not display boolean operators when column type is string', () => {
    const { props } = setup({
      datasource: {
        type: 'table',
        datasource_name: 'table1',
        schema: 'schema',
        columns: [{ column_name: 'value', type: 'STRING' }],
      },
      adhocFilter: simpleAdhocFilter,
    });
    const { isOperatorRelevant } = useSimpleTabFilterProps(props);
    const booleanOnlyOperators = [Operators.IsTrue, Operators.IsFalse];
    booleanOnlyOperators.forEach(operator => {
      expect(isOperatorRelevant(operator, 'value')).toBe(false);
    });
  });
  it('will display boolean operators when column is an expression', () => {
    const { props } = setup({
      datasource: {
        type: 'table',
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
    const { isOperatorRelevant } = useSimpleTabFilterProps(props);
    const booleanOnlyOperators = [Operators.IsTrue, Operators.IsFalse];
    booleanOnlyOperators.forEach(operator => {
      expect(isOperatorRelevant(operator, 'value')).toBe(true);
    });
  });
  it('sets comparator to true when operator is IS_TRUE', () => {
    const { props } = setup();
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    onOperatorChange(Operators.IsTrue);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0].operatorId).toBe(Operators.IsTrue);
    expect(props.onChange.lastCall.args[0].operator).toBe('==');
    expect(props.onChange.lastCall.args[0].comparator).toBe(true);
  });
  it('sets comparator to false when operator is IS_FALSE', () => {
    const { props } = setup();
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    onOperatorChange(Operators.IsFalse);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0].operatorId).toBe(Operators.IsFalse);
    expect(props.onChange.lastCall.args[0].operator).toBe('==');
    expect(props.onChange.lastCall.args[0].comparator).toBe(false);
  });
  it('sets comparator to null when operator is IS_NULL or IS_NOT_NULL', () => {
    const { props } = setup();
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    [Operators.IsNull, Operators.IsNotNull].forEach(op => {
      onOperatorChange(op);
      expect(props.onChange.called).toBe(true);
      expect(props.onChange.lastCall.args[0].operatorId).toBe(op);
      expect(props.onChange.lastCall.args[0].operator).toBe(
        OPERATOR_ENUM_TO_OPERATOR_TYPE[op].operation,
      );
      expect(props.onChange.lastCall.args[0].comparator).toBe(null);
    });
  });
});

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

describe('AdhocFilterEditPopoverSimpleTabContent Advanced data Type Test', () => {
  const setupFilter = async (props: Props) => {
    await act(async () => {
      render(
        <Provider store={store}>
          <ThemeProvider theme={supersetTheme}>
            <AdhocFilterEditPopoverSimpleTabContent {...props} />
          </ThemeProvider>
          ,
        </Provider>,
      );
    });
  };

  let isFeatureEnabledMock: any;
  beforeEach(async () => {
    isFeatureEnabledMock = jest
      .spyOn(uiCore, 'isFeatureEnabled')
      .mockImplementation(
        (featureFlag: FeatureFlag) =>
          featureFlag === FeatureFlag.EnableAdvancedDataTypes,
      );
  });

  afterAll(() => {
    isFeatureEnabledMock.mockRestore();
  });

  it('should not call API when column has no advanced data type', async () => {
    fetchMock.resetHistory();

    const props = getAdvancedDataTypeTestProps();

    await setupFilter(props);

    const filterValueField = screen.getByPlaceholderText(
      'Filter value (case sensitive)',
    );
    await act(async () => {
      userEvent.type(filterValueField, 'v');
    });

    await act(async () => {
      userEvent.type(filterValueField, '{enter}');
    });

    // When the column is not a advanced data type,
    // the advanced data type endpoint should not be called
    await waitFor(() =>
      expect(fetchMock.calls(ADVANCED_DATA_TYPE_ENDPOINT_VALID)).toHaveLength(
        0,
      ),
    );
  });

  it('should call API when column has advanced data type', async () => {
    fetchMock.resetHistory();

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

    await setupFilter(props);

    const filterValueField = screen.getByPlaceholderText(
      'Filter value (case sensitive)',
    );
    await act(async () => {
      userEvent.type(filterValueField, 'v');
    });

    await act(async () => {
      userEvent.type(filterValueField, '{enter}');
    });

    // When the column is a advanced data type,
    // the advanced data type endpoint should be called
    await waitFor(() =>
      expect(fetchMock.calls(ADVANCED_DATA_TYPE_ENDPOINT_VALID)).toHaveLength(
        1,
      ),
    );
    expect(props.validHandler.lastCall.args[0]).toBe(true);
  });

  it('save button should be disabled if error message from API is returned', async () => {
    fetchMock.resetHistory();

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

    await setupFilter(props);

    const filterValueField = screen.getByPlaceholderText(
      'Filter value (case sensitive)',
    );
    await act(async () => {
      userEvent.type(filterValueField, 'e');
    });

    await act(async () => {
      userEvent.type(filterValueField, '{enter}');
    });

    // When the column is a advanced data type but an error response is given by the endpoint,
    // the save button should be disabled
    await waitFor(() =>
      expect(fetchMock.calls(ADVANCED_DATA_TYPE_ENDPOINT_INVALID)).toHaveLength(
        1,
      ),
    );
    expect(props.validHandler.lastCall.args[0]).toBe(false);
  });

  it('advanced data type operator list should update after API response', async () => {
    fetchMock.resetHistory();

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

    await setupFilter(props);

    const filterValueField = screen.getByPlaceholderText(
      'Filter value (case sensitive)',
    );
    await act(async () => {
      userEvent.type(filterValueField, 'v');
    });

    await act(async () => {
      userEvent.type(filterValueField, '{enter}');
    });

    // When the column is a advanced data type,
    // the advanced data type endpoint should be called
    await waitFor(() =>
      expect(fetchMock.calls(ADVANCED_DATA_TYPE_ENDPOINT_VALID)).toHaveLength(
        1,
      ),
    );
    expect(props.validHandler.lastCall.args[0]).toBe(true);

    const operatorValueField = screen.getByText('1 operator(s)');

    await act(async () => {
      userEvent.type(operatorValueField, '{enter}');
    });

    expect(screen.getByText('EQUALS')).toBeTruthy();
  });
});
