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
import { AdvancedFrame } from '../components';

test('renders with default props', () => {
  render(<AdvancedFrame onChange={jest.fn()} value="Last week" />);
  expect(screen.getByText('Configure Advanced Time Range')).toBeInTheDocument();
});

test('render with empty value', () => {
  render(<AdvancedFrame onChange={jest.fn()} value="" />);
  expect(screen.getByText('Configure Advanced Time Range')).toBeInTheDocument();
});

test('triggers since onChange', async () => {
  const onChange = jest.fn();
  render(<AdvancedFrame onChange={onChange} value="Next week" />);
  await userEvent.type(screen.getAllByRole('textbox')[0], 'Last week');
  expect(onChange).toHaveBeenCalled();
});

test('triggers until onChange', async () => {
  const onChange = jest.fn();
  render(<AdvancedFrame onChange={onChange} value="today : tomorrow" />);
  await userEvent.type(screen.getAllByRole('textbox')[1], 'dayAfterTomorrow');
  expect(onChange).toHaveBeenCalled();
});

test('without limits there is no error slot', () => {
  const { container } = render(
    <AdvancedFrame onChange={jest.fn()} value="2025-01-01 : " />,
  );
  expect(container.querySelector('.ant-form-item')).not.toBeInTheDocument();
  screen
    .getAllByRole('textbox')
    .forEach(input => expect(input).not.toHaveAttribute('aria-invalid'));
});

test('an End error shows under End and describes the End input', () => {
  render(
    <AdvancedFrame
      onChange={jest.fn()}
      value="2025-01-01 : "
      limits={{
        startId: 'start',
        endId: 'end',
        end: { id: 'end-error', message: 'An end date is required.' },
        rowErrorId: 'row-error',
      }}
    />,
  );

  const [start, end] = screen.getAllByRole('textbox');
  const message = screen.getByRole('alert');
  expect(message).toHaveTextContent('An end date is required.');
  expect(message).toHaveAttribute('id', 'end-error');
  expect(end).toHaveAttribute('id', 'end');
  expect(end).toHaveAttribute('aria-invalid', 'true');
  expect(end).toHaveAttribute('aria-describedby', 'end-error row-error');
  expect(start).toHaveAttribute('id', 'start');
  expect(start).not.toHaveAttribute('aria-invalid');
  expect(start).toHaveAttribute('aria-describedby', 'row-error');
});

test('a range error in the row marks both inputs invalid', () => {
  render(
    <AdvancedFrame
      onChange={jest.fn()}
      value="2025-01-01 : 2025-05-31"
      limits={{
        startId: 'start',
        endId: 'end',
        rowErrorId: 'row-error',
        rowInvalid: true,
      }}
    />,
  );

  screen.getAllByRole('textbox').forEach(input => {
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'row-error');
  });
});

test.each(['start', 'end', 'range', 'pending', 'valid'] as const)(
  'Advanced inputs show the error status for %s validation',
  kind => {
    render(
      <AdvancedFrame
        onChange={jest.fn()}
        value="2025-01-01 : 2025-05-31"
        limits={{
          startId: 'start',
          endId: 'end',
          start:
            kind === 'start'
              ? { id: 'start-error', message: 'Start error' }
              : undefined,
          end:
            kind === 'end'
              ? { id: 'end-error', message: 'End error' }
              : undefined,
          rowInvalid: kind === 'range' || kind === 'pending',
          pending: kind === 'pending',
        }}
      />,
    );
    screen.getAllByRole('textbox').forEach((input, index) => {
      const invalid =
        kind === 'range' || kind === (index === 0 ? 'start' : 'end');
      expect(input.classList.contains('ant-input-status-error')).toBe(invalid);
    });
  },
);
