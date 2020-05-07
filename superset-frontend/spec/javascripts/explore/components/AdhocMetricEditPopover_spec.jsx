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
import { Button, FormGroup, Popover } from 'react-bootstrap';

import AdhocMetric, { EXPRESSION_TYPES } from 'src/explore/AdhocMetric';
import AdhocMetricEditPopover from 'src/explore/components/AdhocMetricEditPopover';
import { AGGREGATES } from 'src/explore/constants';

const columns = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'VARCHAR(255)', column_name: 'target' },
  { type: 'DOUBLE', column_name: 'value' },
];

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: columns[2],
  aggregate: AGGREGATES.SUM,
});

const sqlExpressionAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SQL,
  sqlExpression: 'COUNT(*)',
});

function setup(overrides) {
  const onChange = sinon.spy();
  const onClose = sinon.spy();
  const props = {
    adhocMetric: sumValueAdhocMetric,
    onChange,
    onClose,
    columns,
    ...overrides,
  };
  const wrapper = shallow(<AdhocMetricEditPopover {...props} />);
  return { wrapper, onChange, onClose };
}

describe('AdhocMetricEditPopover', () => {
  it('renders a popover with edit metric form contents', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Popover)).toHaveLength(1);
    expect(wrapper.find(FormGroup)).toHaveLength(3);
    expect(wrapper.find(Button)).toHaveLength(2);
  });

  it('overwrites the adhocMetric in state with onColumnChange', () => {
    const { wrapper } = setup();
    wrapper.instance().onColumnChange(columns[0]);
    expect(wrapper.state('adhocMetric')).toEqual(
      sumValueAdhocMetric.duplicateWith({ column: columns[0] }),
    );
  });

  it('overwrites the adhocMetric in state with onAggregateChange', () => {
    const { wrapper } = setup();
    wrapper.instance().onAggregateChange({ aggregate: AGGREGATES.AVG });
    expect(wrapper.state('adhocMetric')).toEqual(
      sumValueAdhocMetric.duplicateWith({ aggregate: AGGREGATES.AVG }),
    );
  });

  it('overwrites the adhocMetric in state with onSqlExpressionChange', () => {
    const { wrapper } = setup({ adhocMetric: sqlExpressionAdhocMetric });
    wrapper.instance().onSqlExpressionChange('COUNT(1)');
    expect(wrapper.state('adhocMetric')).toEqual(
      sqlExpressionAdhocMetric.duplicateWith({ sqlExpression: 'COUNT(1)' }),
    );
  });

  it('overwrites the adhocMetric in state with onLabelChange', () => {
    const { wrapper } = setup();
    wrapper.instance().onLabelChange({ target: { value: 'new label' } });
    expect(wrapper.state('adhocMetric').label).toBe('new label');
    expect(wrapper.state('adhocMetric').hasCustomLabel).toBe(true);
  });

  it('returns to default labels when the custom label is cleared', () => {
    const { wrapper } = setup();
    wrapper.instance().onLabelChange({ target: { value: 'new label' } });
    wrapper.instance().onLabelChange({ target: { value: '' } });
    expect(wrapper.state('adhocMetric').label).toBe('SUM(value)');
    expect(wrapper.state('adhocMetric').hasCustomLabel).toBe(false);
  });

  it('prevents saving if no column or aggregate is chosen', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Button).find({ disabled: true })).toHaveLength(0);
    wrapper.instance().onColumnChange(null);
    expect(wrapper.find(Button).find({ disabled: true })).toHaveLength(1);
    wrapper.instance().onColumnChange({ column: columns[0] });
    expect(wrapper.find(Button).find({ disabled: true })).toHaveLength(0);
    wrapper.instance().onAggregateChange(null);
    expect(wrapper.find(Button).find({ disabled: true })).toHaveLength(1);
  });

  it('highlights save if changes are present', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Button).find({ bsStyle: 'primary' })).toHaveLength(0);
    wrapper.instance().onColumnChange({ column: columns[1] });
    expect(wrapper.find(Button).find({ bsStyle: 'primary' })).toHaveLength(1);
  });

  it('will initiate a drag when clicked', () => {
    const { wrapper } = setup();
    wrapper.instance().onDragDown = sinon.spy();
    wrapper.instance().forceUpdate();

    expect(wrapper.find('i.glyphicon-resize-full')).toHaveLength(1);
    expect(wrapper.instance().onDragDown.calledOnce).toBe(false);
    wrapper.find('i.glyphicon-resize-full').simulate('mouseDown');
    expect(wrapper.instance().onDragDown.calledOnce).toBe(true);
  });
});
