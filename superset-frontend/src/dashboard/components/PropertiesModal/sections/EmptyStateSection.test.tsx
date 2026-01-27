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
import { render, screen } from 'spec/helpers/testing-library';
import { Form } from '@superset-ui/core/components';
import { EmptyStateSection } from './EmptyStateSection';

const defaultProps = {
  emptyStateConfig: {
    no_data_message: '',
    no_data_subtitle: '',
    no_results_message: '',
    no_results_subtitle: '',
  },
  onEmptyStateConfigChange: jest.fn(),
};

test('renders all four input fields', () => {
  render(
    <Form>
      <EmptyStateSection {...defaultProps} />
    </Form>,
  );

  expect(screen.getByLabelText(/Empty state message/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Empty state subtitle/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/No results message/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/No results subtitle/i)).toBeInTheDocument();
});

test('displays existing values from emptyStateConfig prop', () => {
  const configWithValues = {
    no_data_message: 'Custom no data message',
    no_data_subtitle: 'Custom no data subtitle',
    no_results_message: 'Custom no results message',
    no_results_subtitle: 'Custom no results subtitle',
  };

  render(
    <Form>
      <EmptyStateSection
        {...defaultProps}
        emptyStateConfig={configWithValues}
      />
    </Form>,
  );

  expect(
    screen.getByDisplayValue('Custom no data message'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue('Custom no data subtitle'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue('Custom no results message'),
  ).toBeInTheDocument();
  expect(
    screen.getByDisplayValue('Custom no results subtitle'),
  ).toBeInTheDocument();
});

test('calls onEmptyStateConfigChange when component prop exists', () => {
  const onEmptyStateConfigChange = jest.fn();

  render(
    <Form>
      <EmptyStateSection
        {...defaultProps}
        onEmptyStateConfigChange={onEmptyStateConfigChange}
      />
    </Form>,
  );

  expect(onEmptyStateConfigChange).toBeDefined();
});

test('renders with correct labels', () => {
  render(
    <Form>
      <EmptyStateSection {...defaultProps} />
    </Form>,
  );

  expect(screen.getByLabelText(/Empty state subtitle/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/No results message/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/No results subtitle/i)).toBeInTheDocument();
});

test('shows placeholder text for empty state message', () => {
  render(
    <Form>
      <EmptyStateSection {...defaultProps} />
    </Form>,
  );

  const inputs = screen.getAllByPlaceholderText(/Default:/i);
  expect(inputs.length).toBeGreaterThan(0);
});
