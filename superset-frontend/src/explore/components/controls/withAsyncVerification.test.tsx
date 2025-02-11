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
import { render } from 'spec/helpers/testing-library';
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
  onChange: (p0: string[]) => {},
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
  const utils = render(<VerifiedControl {...props} />);
  return { props, ...utils, verifier, VerifiedControl };
}

describe('VerifiedMetricsControl', () => {
  it('should call verify correctly', async () => {
    expect.assertions(3);
    const { verifier, props, rerender, VerifiedControl } = await setup();

    expect(verifier).toHaveBeenCalledTimes(1);
    expect(verifier).toHaveBeenCalledWith(
      expect.objectContaining({ savedMetrics: props.savedMetrics }),
    );

    // should call verifier with new props when props are updated
    rerender(<VerifiedControl {...props} validMetric={['abc']} />);

    expect(verifier).toHaveBeenCalledWith(
      expect.objectContaining({ validMetric: ['abc'] }),
    );
  });

  it('should trigger onChange event', async () => {
    expect.assertions(2);
    const mockOnChange = jest.fn();
    const { verifier, props } = await setup({
      baseControl: 'MetricsControl',
      onChange: mockOnChange,
      extraProps: {
        onChange: (value: any) => {
          // Simulate the MetricsControl onChange
          mockOnChange(value, props);
        },
      },
    });

    // Wait for the initial verification to complete
    await verifier;

    // Call the onChange from props
    props.onChange(['sum__value']);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(['sum__value'], props);
  });
});
