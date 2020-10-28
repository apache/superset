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

import Popover from 'src/common/components/Popover';
import Label from 'src/components/Label';
import AdhocMetric from 'src/explore/AdhocMetric';
import AdhocMetricOption from 'src/explore/components/AdhocMetricOption';
import { AGGREGATES } from 'src/explore/constants';

const columns = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'VARCHAR(255)', column_name: 'target' },
  { type: 'DOUBLE', column_name: 'value' },
];

const sumValueAdhocMetric = new AdhocMetric({
  column: columns[2],
  aggregate: AGGREGATES.SUM,
});

function setup(overrides) {
  const onMetricEdit = sinon.spy();
  const props = {
    adhocMetric: sumValueAdhocMetric,
    onMetricEdit,
    columns,
    ...overrides,
  };
  const wrapper = shallow(<AdhocMetricOption {...props} />);
  return { wrapper, onMetricEdit };
}

describe('AdhocMetricOption', () => {
  it('renders an overlay trigger wrapper for the label', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Popover)).toExist();
    expect(wrapper.find(Label)).toExist();
  });

  it('overlay should open if metric is new', () => {
    const { wrapper } = setup({
      adhocMetric: sumValueAdhocMetric.duplicateWith({ isNew: true }),
    });
    expect(wrapper.find(Popover).props().defaultVisible).toBe(true);
  });

  it('overwrites the adhocMetric in state with onLabelChange', () => {
    const { wrapper } = setup();
    wrapper.instance().onLabelChange({ target: { value: 'new label' } });
    expect(wrapper.state('title').label).toBe('new label');
    expect(wrapper.state('title').hasCustomLabel).toBe(true);
  });

  it('returns to default labels when the custom label is cleared', () => {
    const { wrapper } = setup();
    expect(wrapper.state('title').label).toBe('SUM(value)');

    wrapper.instance().onLabelChange({ target: { value: 'new label' } });
    expect(wrapper.state('title').label).toBe('new label');

    wrapper.instance().onLabelChange({ target: { value: '' } });

    expect(wrapper.state('title').label).toBe('SUM(value)');
    expect(wrapper.state('title').hasCustomLabel).toBe(false);
  });
});
