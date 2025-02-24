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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
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

describe('CheckboxControl', () => {
  it('renders a Checkbox', () => {
    render(setup());

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeVisible();
    expect(checkbox).not.toBeChecked();
  });

  it('Checks the box when the label is clicked', () => {
    render(setup());
    const label = screen.getByRole('button', {
      name: /checkbox label/i,
    });

    userEvent.click(label);
    expect(defaultProps.onChange).toHaveBeenCalled();
  });
});
