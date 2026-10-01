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
import SwitchControl from './SwitchControl';

test('renders an unchecked switch by default', () => {
  render(<SwitchControl onChange={jest.fn()} />);
  expect(screen.getByRole('switch')).not.toBeChecked();
});

test('renders a checked switch when value is true', () => {
  render(<SwitchControl value onChange={jest.fn()} />);
  expect(screen.getByRole('switch')).toBeChecked();
});

test('calls onChange with the toggled value when the switch is clicked', async () => {
  const onChange = jest.fn();
  render(<SwitchControl value={false} onChange={onChange} />);
  await userEvent.click(screen.getByRole('switch'));
  expect(onChange).toHaveBeenCalledWith(true);
});

test('calls onChange with false when a checked switch is clicked', async () => {
  const onChange = jest.fn();
  render(<SwitchControl value onChange={onChange} />);
  await userEvent.click(screen.getByRole('switch'));
  expect(onChange).toHaveBeenCalledWith(false);
});

test('renders the label next to the switch', () => {
  render(<SwitchControl label="Show legend" onChange={jest.fn()} />);
  expect(screen.getByText('Show legend')).toBeInTheDocument();
  expect(screen.getByRole('switch')).toBeInTheDocument();
});

test('toggles when the label is clicked', async () => {
  const onChange = jest.fn();
  render(<SwitchControl label="Show legend" value onChange={onChange} />);
  await userEvent.click(screen.getByText('Show legend'));
  expect(onChange).toHaveBeenCalledWith(false);
});
