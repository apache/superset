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
import { GenericDataType } from '@apache-superset/core/common';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import ColumnConfigPopover from 'src/explore/components/controls/ColumnConfigControl/ColumnConfigPopover';
import ControlForm, {
  ControlFormItem,
  ControlFormRow,
} from 'src/explore/components/controls/ColumnConfigControl/ControlForm';
import { ColumnConfigFormLayout } from 'src/explore/components/controls/ColumnConfigControl/types';

const CHECKBOX = (
  <ControlFormItem
    name="showCellBars"
    controlType="Checkbox"
    label="Show cell bars"
    description="Whether to display a bar chart background in table columns"
    defaultValue
    debounceDelay={0}
    resettable
  />
);

const setup = (props = {}) => (
  <ControlForm
    onChange={jest.fn()}
    onReset={jest.fn()}
    value={{ showCellBars: false }}
    {...props}
  >
    <ControlFormRow>{CHECKBOX}</ControlFormRow>
  </ControlForm>
);

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ColumnConfigControl reset to chart-level setting', () => {
  test('shows the reset action only for an explicit per-column override', () => {
    const { rerender } = render(setup());
    expect(
      screen.getByRole('button', { name: /use the chart-level setting/i }),
    ).toBeInTheDocument();

    // no explicit value in the column config: the column already follows
    // the chart-level option, so no reset action is offered
    rerender(setup({ value: {} }));
    expect(
      screen.queryByRole('button', { name: /use the chart-level setting/i }),
    ).not.toBeInTheDocument();
  });

  test('reset deletes the key instead of writing an explicit value', async () => {
    const onChange = jest.fn();
    const onReset = jest.fn();
    render(
      <ControlForm
        onChange={onChange}
        onReset={onReset}
        value={{ showCellBars: false }}
      >
        <ControlFormRow>{CHECKBOX}</ControlFormRow>
      </ControlForm>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /use the chart-level setting/i }),
    );
    expect(onReset).toHaveBeenCalledWith('showCellBars');
    // the key must be gone from the propagated value, not set to true/false
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ showCellBars: expect.anything() }),
    );
  });

  test('reset through the popover removes only the reset override', async () => {
    // ControlForm alone only proves the callback fires. The deletion happens in the
    // popover, so exercising ControlForm with a mocked onReset stays green even if that
    // filter never runs. Render the popover and assert on the value it emits.
    const onChange = jest.fn();
    render(
      <ColumnConfigPopover
        column={{
          isChildColumn: false,
          isTimeComparisonColumn: false,
          name: 'my_column',
          type: GenericDataType.String,
          config: { showCellBars: false, d3NumberFormat: '.2f' },
        }}
        configFormLayout={
          {
            [GenericDataType.String]: [['showCellBars', 'd3NumberFormat']],
          } as ColumnConfigFormLayout
        }
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /use the chart-level setting/i }),
    );
    // the override is gone, the unrelated formatting override survives
    expect(onChange).toHaveBeenCalledWith({ d3NumberFormat: '.2f' });
  });

  test('toggling the checkbox still writes an explicit value', async () => {
    const onChange = jest.fn();
    render(
      <ControlForm onChange={onChange} value={{ showCellBars: false }}>
        <ControlFormRow>{CHECKBOX}</ControlFormRow>
      </ControlForm>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: /show cell bars/i }),
    );
    expect(onChange).toHaveBeenCalledWith({ showCellBars: true });
  });

  test('resettable marker is set on the chart-mirrored props only', () => {
    // eslint-disable-next-line global-require
    const {
      SHARED_COLUMN_CONFIG_PROPS,
    } = require('src/explore/components/controls/ColumnConfigControl/constants');
    expect(SHARED_COLUMN_CONFIG_PROPS.showCellBars.resettable).toBe(true);
    expect(SHARED_COLUMN_CONFIG_PROPS.alignPositiveNegative.resettable).toBe(
      true,
    );
    expect(SHARED_COLUMN_CONFIG_PROPS.colorPositiveNegative.resettable).toBe(
      true,
    );
    expect(SHARED_COLUMN_CONFIG_PROPS.visible.resettable).toBeUndefined();
  });
});
