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
import { ReactWrapper } from 'enzyme';
import { styledMount as mount } from 'spec/helpers/theming';
import { act } from 'react-dom/test-utils';

import withAsyncVerification, {
  ControlPropsWithExtras,
  WithAsyncVerificationOptions,
} from 'src/explore/components/controls/withAsyncVerification';
import { ExtraControlProps } from '@superset-ui/chart-controls';
import MetricsControl from 'src/explore/components/controls/MetricControl/MetricsControl';

const VALID_METRIC = {
  metric_name: 'sum__value',
  expression: 'SUM(energy_usage.value)',
};

const mockSetControlValue = jest.fn();

const defaultProps = {
  name: 'metrics',
  label: 'Metrics',
  value: undefined,
  multi: true,
  needAsyncVerification: true,
  actions: { setControlValue: mockSetControlValue },
  onChange: () => {},
  columns: [
    { type: 'VARCHAR(255)', column_name: 'source' },
    { type: 'VARCHAR(255)', column_name: 'target' },
    { type: 'DOUBLE', column_name: 'value' },
  ],
  savedMetrics: [
    VALID_METRIC,
    { metric_name: 'avg__value', expression: 'AVG(energy_usage.value)' },
  ],
  datasourceType: 'sqla',
};

function verify(sourceProp: string) {
  const mock = jest.fn();
  mock.mockImplementation(async (props: ControlPropsWithExtras) => ({
    [sourceProp]: props.validMetrics || [VALID_METRIC],
  }));
  return mock;
}

async function setup({
  extraProps,
  baseControl = MetricsControl as WithAsyncVerificationOptions['baseControl'],
  onChange,
}: Partial<WithAsyncVerificationOptions> & {
  extraProps?: ExtraControlProps;
} = {}) {
  const props = {
    ...defaultProps,
    ...extraProps,
  };
  const verifier = verify('savedMetrics');
  const VerifiedControl = withAsyncVerification({
    baseControl,
    verify: verifier,
    onChange,
  });
  type Wrapper = ReactWrapper<typeof props & ExtraControlProps>;
  let wrapper: Wrapper | undefined;
  await act(async () => {
    wrapper = mount(<VerifiedControl {...props} />);
  });
  return { props, wrapper: wrapper as Wrapper, onChange, verifier };
}

describe('VerifiedMetricsControl', () => {
  it('should calls verify correctly', async () => {
    expect.assertions(5);
    const { wrapper, verifier, props } = await setup();

    expect(wrapper.find(MetricsControl).length).toBe(1);

    expect(verifier).toBeCalledTimes(1);
    expect(verifier).toBeCalledWith(
      expect.objectContaining({ savedMetrics: props.savedMetrics }),
    );

    // should call verifier with new props when props are updated.
    await act(async () => {
      wrapper.setProps({ validMetric: ['abc'] });
    });

    expect(verifier).toBeCalledTimes(2);
    expect(verifier).toBeCalledWith(
      expect.objectContaining({ validMetric: ['abc'] }),
    );
  });

  it('should trigger onChange event', async () => {
    expect.assertions(3);
    const mockOnChange = jest.fn();
    const { wrapper } = await setup({
      // should allow specify baseControl with control component name
      baseControl: 'MetricsControl',
      onChange: mockOnChange,
    });

    const child = wrapper.find(MetricsControl);
    child.props().onChange?.(['abc']);

    expect(child.length).toBe(1);
    expect(mockOnChange).toBeCalledTimes(1);
    expect(mockOnChange).toBeCalledWith(['abc'], {
      actions: defaultProps.actions,
      columns: defaultProps.columns,
      datasourceType: defaultProps.datasourceType,
      label: defaultProps.label,
      multi: defaultProps.multi,
      name: defaultProps.name,
      // in real life, `onChange` should have been called with the updated
      // props (both savedMetrics and value should have been updated), but
      // because of the limitation of enzyme (it cannot get props updated from
      // useEffect hooks), we are not able to check that here.
      savedMetrics: defaultProps.savedMetrics,
      value: undefined,
    });
  });
});
