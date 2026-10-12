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
import { createRef } from 'react';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { DateLabel } from '../components';

test('renders a string label inside a button', () => {
  render(<DateLabel name="time_range" label="Last week" />);

  expect(screen.getByRole('button')).toHaveTextContent('Last week');
});

test('renders a node label as provided', () => {
  render(
    <DateLabel name="time_range" label={<em data-test="custom">Custom</em>} />,
  );

  expect(screen.getByTestId('custom')).toHaveTextContent('Custom');
});

test('identifies the label content by the control name', () => {
  render(<DateLabel name="time_range" label="Last week" />);

  expect(screen.getByText('Last week')).toHaveAttribute(
    'id',
    'date-label-time_range',
  );
});

test('forwards the ref to the label content element', () => {
  const ref = createRef<HTMLSpanElement>();
  render(<DateLabel name="time_range" label="Last week" ref={ref} />);

  expect(ref.current).toBe(screen.getByText('Last week'));
});

test('calls onClick when clicked', async () => {
  const onClick = jest.fn();
  render(<DateLabel name="time_range" label="Last week" onClick={onClick} />);

  await userEvent.click(screen.getByRole('button'));

  expect(onClick).toHaveBeenCalledTimes(1);
});

test('does not submit a surrounding form', async () => {
  const onSubmit = jest.fn(e => e.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <DateLabel name="time_range" label="Last week" />
    </form>,
  );

  await userEvent.click(screen.getByRole('button'));

  expect(onSubmit).not.toHaveBeenCalled();
});
