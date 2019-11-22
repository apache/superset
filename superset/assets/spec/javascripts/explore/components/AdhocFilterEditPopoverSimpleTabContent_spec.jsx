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
import { FormGroup } from 'react-bootstrap';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../../../../src/explore/AdhocFilter';
import AdhocMetric from '../../../../src/explore/AdhocMetric';
import AdhocFilterEditPopoverSimpleTabContent from '../../../../src/explore/components/AdhocFilterEditPopoverSimpleTabContent';
import { AGGREGATES } from '../../../../src/explore/constants';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: CLAUSES.WHERE,
});

const simpleMultiAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: 'in',
  comparator: ['10'],
  clause: CLAUSES.WHERE,
});

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: { type: 'VARCHAR(255)', column_name: 'source' },
  aggregate: AGGREGATES.SUM,
});

const options = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'VARCHAR(255)', column_name: 'target' },
  { type: 'DOUBLE', column_name: 'value' },
  { saved_metric_name: 'my_custom_metric' },
  sumValueAdhocMetric,
];

function setup(overrides) {
  const onChange = sinon.spy();
  const onHeightChange = sinon.spy();
  const props = {
    adhocFilter: simpleAdhocFilter,
    onChange,
    onHeightChange,
    options,
    datasource: {},
    ...overrides,
  };
  const wrapper = shallow(<AdhocFilterEditPopoverSimpleTabContent {...props} />);
  return { wrapper, onChange, onHeightChange };
}

describe('AdhocFilterEditPopoverSimpleTabContent', () => {
  it('renders the simple tab form', () => {
    const { wrapper } = setup();
    expect(wrapper.find(FormGroup)).toHaveLength(3);
  });

  it('passes the new adhocFilter to onChange after onSubjectChange', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onSubjectChange({ type: 'VARCHAR(255)', column_name: 'source' });
    expect(onChange.calledOnce).toBe(true);
    expect(onChange.lastCall.args[0].equals((
      simpleAdhocFilter.duplicateWith({ subject: 'source' })
    ))).toBe(true);
  });

  it('may alter the clause in onSubjectChange if the old clause is not appropriate', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onSubjectChange(sumValueAdhocMetric);
    expect(onChange.calledOnce).toBe(true);
    expect(onChange.lastCall.args[0].equals((
      simpleAdhocFilter.duplicateWith({
        subject: sumValueAdhocMetric.label,
        clause: CLAUSES.HAVING,
      })
    ))).toBe(true);
  });

  it('will convert from individual comparator to array if the operator changes to multi', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onOperatorChange({ operator: 'in' });
    expect(onChange.calledOnce).toBe(true);
    expect(onChange.lastCall.args[0].comparator).toHaveLength(1);
    expect(onChange.lastCall.args[0].comparator[0]).toBe('10');
    expect(onChange.lastCall.args[0].operator).toBe('in');
  });

  it('will convert from array to individual comparators if the operator changes from multi', () => {
    const { wrapper, onChange } = setup({ adhocFilter: simpleMultiAdhocFilter });
    wrapper.instance().onOperatorChange({ operator: '<' });
    expect(onChange.calledOnce).toBe(true);
    expect(onChange.lastCall.args[0].equals((
      simpleAdhocFilter.duplicateWith({ operator: '<', comparator: '10' })
    ))).toBe(true);
  });

  it('passes the new adhocFilter to onChange after onComparatorChange', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onComparatorChange('20');
    expect(onChange.calledOnce).toBe(true);
    expect(onChange.lastCall.args[0].equals((
      simpleAdhocFilter.duplicateWith({ comparator: '20' })
    ))).toBe(true);
  });

  it('will filter operators for table datasources', () => {
    const { wrapper } = setup({ datasource: { type: 'table' } });
    expect(wrapper.instance().isOperatorRelevant('regex')).toBe(false);
    expect(wrapper.instance().isOperatorRelevant('LIKE')).toBe(true);
  });

  it('will filter operators for druid datasources', () => {
    const { wrapper } = setup({ datasource: { type: 'druid' } });
    expect(wrapper.instance().isOperatorRelevant('regex')).toBe(true);
    expect(wrapper.instance().isOperatorRelevant('LIKE')).toBe(false);
  });

  it('expands when its multi comparator input field expands', () => {
    const { wrapper, onHeightChange } = setup();

    wrapper.instance().multiComparatorComponent =
      { _selectRef: { select: { control: { clientHeight: 57 } } } };
    wrapper.instance().handleMultiComparatorInputHeightChange();

    expect(onHeightChange.calledOnce).toBe(true);
    expect(onHeightChange.lastCall.args[0]).toBe(27);
  });
});
