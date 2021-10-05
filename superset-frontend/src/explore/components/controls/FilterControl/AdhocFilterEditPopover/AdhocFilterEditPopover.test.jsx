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
import Button from 'src/components/Button';

import ErrorBoundary from 'src/components/ErrorBoundary';
import Tabs from 'src/components/Tabs';
import AdhocFilter, {
  EXPRESSION_TYPES,
  CLAUSES,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { AGGREGATES } from 'src/explore/constants';
import AdhocFilterEditPopoverSimpleTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSimpleTabContent';
import AdhocFilterEditPopoverSqlTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSqlTabContent';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocFilterEditPopover from '.';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: CLAUSES.WHERE,
});

const sqlAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SQL,
  sqlExpression: 'value > 10',
  clause: CLAUSES.WHERE,
});

const faultyAdhocFilter = new AdhocFilter({
  expressionType: null,
  subject: null,
  operator: '>',
  comparator: '10',
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
  const onClose = sinon.spy();
  const onResize = sinon.spy();
  const props = {
    adhocFilter: simpleAdhocFilter,
    onChange,
    onClose,
    onResize,
    options,
    datasource: {},
    ...overrides,
  };
  const wrapper = shallow(<AdhocFilterEditPopover {...props} />);
  return { wrapper, onChange, onClose, onResize };
}

describe('AdhocFilterEditPopover', () => {
  it('renders simple tab content by default', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Tabs)).toExist();
    expect(wrapper.find(Tabs.TabPane)).toHaveLength(2);
    expect(wrapper.find(Button)).toHaveLength(2);
    expect(wrapper.find(AdhocFilterEditPopoverSimpleTabContent)).toHaveLength(
      1,
    );
  });

  it('renders sql tab content when the adhoc filter expressionType is sql', () => {
    const { wrapper } = setup({ adhocFilter: sqlAdhocFilter });
    expect(wrapper.find(Tabs)).toExist();
    expect(wrapper.find(Tabs.TabPane)).toHaveLength(2);
    expect(wrapper.find(Button)).toHaveLength(2);
    expect(wrapper.find(AdhocFilterEditPopoverSqlTabContent)).toExist();
  });

  it('renders simple and sql tabs with ErrorBoundary instead of content', () => {
    const { wrapper } = setup({ adhocFilter: faultyAdhocFilter });
    expect(wrapper.find(Tabs)).toExist();
    expect(wrapper.find(Tabs.TabPane)).toHaveLength(2);
    expect(wrapper.find(Button)).toHaveLength(2);
    expect(wrapper.find(ErrorBoundary)).toHaveLength(2);
  });

  it('overwrites the adhocFilter in state with onAdhocFilterChange', () => {
    const { wrapper } = setup();
    wrapper.instance().onAdhocFilterChange(sqlAdhocFilter);
    expect(wrapper.state('adhocFilter')).toEqual(sqlAdhocFilter);
  });

  it('prevents saving if the filter is invalid', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Button).find({ disabled: true })).not.toExist();
    wrapper
      .instance()
      .onAdhocFilterChange(simpleAdhocFilter.duplicateWith({ operator: null }));
    expect(wrapper.find(Button).find({ disabled: true })).toExist();
    wrapper.instance().onAdhocFilterChange(sqlAdhocFilter);
    expect(wrapper.find(Button).find({ disabled: true })).not.toExist();
  });

  it('highlights save if changes are present', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Button).find({ buttonStyle: 'primary' })).not.toExist();
    wrapper.instance().onAdhocFilterChange(sqlAdhocFilter);
    expect(wrapper.find(Button).find({ buttonStyle: 'primary' })).toExist();
  });

  it('will initiate a drag when clicked', () => {
    const { wrapper } = setup();
    wrapper.instance().onDragDown = sinon.spy();
    wrapper.instance().forceUpdate();

    expect(wrapper.find('.fa-expand')).toExist();
    expect(wrapper.instance().onDragDown.calledOnce).toBe(false);
    wrapper.find('.fa-expand').simulate('mouseDown', {});
    expect(wrapper.instance().onDragDown.calledOnce).toBe(true);
  });
});
