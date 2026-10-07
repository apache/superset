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
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import { useState } from 'react';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';

const defaultProps = {
  name: 'show_legend',
  onChange: jest.fn(),
  value: false,
  label: 'checkbox label',
};

const setup = (overrides = {}) => (
  <CheckboxControl {...defaultProps} {...overrides} />
);

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('CheckboxControl', () => {
  test('renders a Checkbox', () => {
    render(setup());

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  test('Checks the box when the label is clicked', async () => {
    const onChange = jest.fn();
    render(setup({ onChange }));
    const label = screen.getByRole('button', {
      name: /checkbox label/i,
    });

    await userEvent.click(label);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('keeps the checkbox checked after its label is clicked', () => {
    function StatefulCheckbox() {
      const [checked, setChecked] = useState(false);
      return setup({ value: checked, onChange: setChecked });
    }

    render(<StatefulCheckbox />);
    fireEvent.click(screen.getByText('checkbox label'));

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  test('prevents duplicate native label activation from the label text', () => {
    render(setup());
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });

    screen.getByText('checkbox label').dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  test('focuses the checkbox when its label text is clicked', () => {
    render(setup());

    fireEvent.click(screen.getByText('checkbox label'));

    expect(screen.getByRole('checkbox')).toHaveFocus();
  });

  test('explains a disabled checkbox without a label', () => {
    render(
      setup({
        label: undefined,
        disabled: true,
        disabledReason: 'Unavailable',
      }),
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAccessibleDescription('Unavailable');
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  test('retains the control header and description when disabled', () => {
    const { container } = render(
      setup({
        disabled: true,
        description: 'Why this control is disabled',
        hovered: true,
        renderTrigger: true,
      }),
    );

    expect(
      container.querySelector('[data-test="show_legend-header"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-test="show_legend-description-icon"]'),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  test('names the disabled checkbox from its visible label', () => {
    render(setup({ disabled: true, disabledReason: 'Unavailable' }));

    const checkbox = screen.getByRole('checkbox', { name: 'checkbox label' });
    expect(checkbox).toHaveAttribute('id', 'show_legend');
    expect(checkbox).toHaveAccessibleDescription('Unavailable');
  });

  test('names a checkbox with a React label and no control name', () => {
    render(setup({ name: undefined, label: <span>Custom label</span> }));

    const checkbox = screen.getByRole('checkbox', { name: 'Custom label' });
    expect(checkbox).toHaveAttribute('id');
  });

  test('ignores label clicks while disabled', async () => {
    const onChange = jest.fn();
    render(setup({ disabled: true, onChange }));

    await userEvent.click(screen.getByText('checkbox label'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
