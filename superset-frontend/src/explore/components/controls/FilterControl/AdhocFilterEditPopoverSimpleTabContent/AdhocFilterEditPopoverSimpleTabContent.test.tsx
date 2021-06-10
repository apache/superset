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
/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';

import AdhocFilter, {
  EXPRESSION_TYPES,
  CLAUSES,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import {
  AGGREGATES,
  Operators,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
} from 'src/explore/constants';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocFilterEditPopoverSimpleTabContent, {
  useSimpleTabFilterProps,
} from '.';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operatorId: Operators.GREATER_THAN,
  operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GREATER_THAN].operation,
  comparator: '10',
  clause: CLAUSES.WHERE,
});

const simpleMultiAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operatorId: Operators.IN,
  operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.IN].operation,
  comparator: ['10'],
  clause: CLAUSES.WHERE,
});

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: { type: 'VARCHAR(255)', column_name: 'source' },
  aggregate: AGGREGATES.SUM,
});

const simpleCustomFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'ds',
  operator: 'LATEST PARTITION',
  operatorId: Operators.LATEST_PARTITION,
});

const options = [
  { type: 'VARCHAR(255)', column_name: 'source', id: 1 },
  { type: 'VARCHAR(255)', column_name: 'target', id: 2 },
  { type: 'DOUBLE', column_name: 'value', id: 3 },
  { saved_metric_name: 'my_custom_metric', id: 4 },
  sumValueAdhocMetric,
];

function setup(overrides?: Record<string, any>) {
  const onChange = sinon.spy();
  const props = {
    adhocFilter: simpleAdhocFilter,
    onChange,
    options,
    datasource: {
      id: 'test-id',
      columns: [],
      type: 'postgres',
      filter_select: false,
    },
    partitionColumn: 'test',
    ...overrides,
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
        expressionType: EXPRESSION_TYPES.SIMPLE,
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
      Operators.IS_TRUE,
      Operators.IS_FALSE,
      Operators.IS_NULL,
      Operators.IS_FALSE,
    ].map(operator => expect(isOperatorRelevant(operator, 'value')).toBe(true));
  });
  it('shows boolean only operators when subject is number', () => {
    const { props } = setup({
      adhocFilter: new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SIMPLE,
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
      Operators.IS_TRUE,
      Operators.IS_FALSE,
      Operators.IS_NULL,
      Operators.IS_NOT_NULL,
    ].map(operator => expect(isOperatorRelevant(operator, 'value')).toBe(true));
  });

  it('will convert from individual comparator to array if the operator changes to multi', () => {
    const { props } = setup();
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    onOperatorChange(Operators.IN);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0].comparator).toEqual(['10']);
    expect(props.onChange.lastCall.args[0].operatorId).toEqual(Operators.IN);
  });

  it('will convert from array to individual comparators if the operator changes from multi', () => {
    const { props } = setup({
      adhocFilter: simpleMultiAdhocFilter,
    });
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    onOperatorChange(Operators.LESS_THAN);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0]).toEqual(
      simpleMultiAdhocFilter.duplicateWith({
        operatorId: Operators.LESS_THAN,
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
    expect(isOperatorRelevant(Operators.REGEX, 'value')).toBe(false);
    expect(isOperatorRelevant(Operators.LIKE, 'value')).toBe(true);
  });

  it('will filter operators for druid datasources', () => {
    const { props } = setup({ datasource: { type: 'druid' } });
    const { isOperatorRelevant } = useSimpleTabFilterProps(props);
    expect(isOperatorRelevant(Operators.REGEX, 'value')).toBe(true);
    expect(isOperatorRelevant(Operators.LIKE, 'value')).toBe(false);
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
    expect(isOperatorRelevant(Operators.LATEST_PARTITION, 'ds')).toBe(true);
    expect(isOperatorRelevant(Operators.LATEST_PARTITION, 'value')).toBe(false);
  });

  it('will generate custom sqlExpression for LATEST PARTITION operator', () => {
    const testAdhocFilter = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
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
    onOperatorChange(Operators.LATEST_PARTITION);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0]).toEqual(
      testAdhocFilter.duplicateWith({
        subject: 'ds',
        operator: 'LATEST PARTITION',
        operatorId: Operators.LATEST_PARTITION,
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
    const booleanOnlyOperators = [Operators.IS_TRUE, Operators.IS_FALSE];
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
    const booleanOnlyOperators = [Operators.IS_TRUE, Operators.IS_FALSE];
    booleanOnlyOperators.forEach(operator => {
      expect(isOperatorRelevant(operator, 'value')).toBe(true);
    });
  });
  it('sets comparator to true when operator is IS_TRUE', () => {
    const { props } = setup();
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    onOperatorChange(Operators.IS_TRUE);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0].operatorId).toBe(Operators.IS_TRUE);
    expect(props.onChange.lastCall.args[0].operator).toBe('==');
    expect(props.onChange.lastCall.args[0].comparator).toBe(true);
  });
  it('sets comparator to false when operator is IS_FALSE', () => {
    const { props } = setup();
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    onOperatorChange(Operators.IS_FALSE);
    expect(props.onChange.calledOnce).toBe(true);
    expect(props.onChange.lastCall.args[0].operatorId).toBe(Operators.IS_FALSE);
    expect(props.onChange.lastCall.args[0].operator).toBe('==');
    expect(props.onChange.lastCall.args[0].comparator).toBe(false);
  });
  it('sets comparator to null when operator is IS_NULL or IS_NOT_NULL', () => {
    const { props } = setup();
    const { onOperatorChange } = useSimpleTabFilterProps(props);
    [Operators.IS_NULL, Operators.IS_NOT_NULL].forEach(op => {
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
