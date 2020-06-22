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
import { OverlayTrigger } from 'react-bootstrap';

import AdhocMetric from 'src/explore/AdhocMetric';
import AdhocMetricEditPopoverTitle from 'src/explore/components/AdhocMetricEditPopoverTitle';
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
  const onChange = sinon.spy();
  const props = {
    adhocMetric: sumValueAdhocMetric,
    onChange,
    ...overrides,
  };
  const wrapper = shallow(<AdhocMetricEditPopoverTitle {...props} />);
  return { wrapper, onChange };
}

describe('AdhocMetricEditPopoverTitle', () => {
  it('renders an OverlayTrigger wrapper with the title', () => {
    const { wrapper } = setup();
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
    expect(wrapper.find(OverlayTrigger).find('span').text()).toBe(
      'My Metric\xa0',
    );
  });

  it('transfers to edit mode when clicked', () => {
    const { wrapper } = setup();
    expect(wrapper.state('isEditable')).toBe(false);
    wrapper.simulate('click');
    expect(wrapper.state('isEditable')).toBe(true);
  });
});
