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
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import fetchMock from 'fetch-mock';

import MetricsControl from '../../../../src/explore/components/controls/MetricsControl';
import withVerification from '../../../../src/explore/components/controls/withVerification';

const defaultProps = {
  name: 'metrics',
  label: 'Metrics',
  value: undefined,
  multi: true,
  columns: [
    { type: 'VARCHAR(255)', column_name: 'source' },
    { type: 'VARCHAR(255)', column_name: 'target' },
    { type: 'DOUBLE', column_name: 'value' },
  ],
  savedMetrics: [
    { metric_name: 'sum__value', expression: 'SUM(energy_usage.value)' },
    { metric_name: 'avg__value', expression: 'AVG(energy_usage.value)' },
  ],
  datasourceType: 'sqla',
  getEndpoint: controlValues => `valid_metrics?data=${controlValues}`,
};

const VALID_METRIC = { metric_name: 'sum__value', expression: 'SUM(energy_usage.value)' };

function setup(overrides) {
  const onChange = sinon.spy();
  const props = {
    onChange,
    ...defaultProps,
    ...overrides,
  };
  const VerifiedControl = withVerification(MetricsControl, 'metric_name', 'savedMetrics');
  const wrapper = shallow(<VerifiedControl {...props} />);
  fetchMock.mock('glob:*/valid_metrics*', `["${VALID_METRIC.metric_name}"]`);
  return { props, wrapper, onChange };
}

afterEach(fetchMock.restore);

describe('VerifiedMetricsControl', () => {

  it('Gets valid options', () => {
    const { wrapper } = setup();
    setTimeout(() => {
      expect(fetchMock.calls(defaultProps.getEndpoint())).toHaveLength(1);
      expect(wrapper.state('validOptions')).toEqual([VALID_METRIC]);
      fetchMock.reset();
    }, 0);
  });

  it('Returns verified options', () => {
    const { wrapper } = setup();
    setTimeout(() => {
      expect(fetchMock.calls(defaultProps.getEndpoint())).toHaveLength(1);
      const child = wrapper.find(MetricsControl);
      expect(child.props().savedMetrics).toEqual([VALID_METRIC]);
      fetchMock.reset();
    }, 0);
  });

  it('Makes no calls if endpoint is not set', () => {
    const { wrapper } = setup({
      getEndpoint: () => null,
    });
    setTimeout(() => {
      expect(fetchMock.calls(defaultProps.getEndpoint())).toHaveLength(0);
      expect(wrapper.state('validOptions')).toEqual(new Set());
      fetchMock.reset();
    }, 0);
  });

  it('Calls endpoint if control values change', () => {
    const { props, wrapper } = setup({ controlValues: { metrics: 'sum__value' } });
    setTimeout(() => {
      expect(fetchMock.calls(defaultProps.getEndpoint())).toHaveLength(1);
      fetchMock.reset();
    }, 0);
    wrapper.setProps({ ...props, controlValues: { metrics: 'avg__value' } });
    setTimeout(() => {
      expect(fetchMock.calls(defaultProps.getEndpoint())).toHaveLength(1);
      fetchMock.reset();
    }, 0);
  });
});
