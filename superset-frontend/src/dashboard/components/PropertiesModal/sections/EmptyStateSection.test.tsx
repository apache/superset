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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Form } from '@superset-ui/core/components';
import EmptyStateSection from './EmptyStateSection';

const defaultProps = {
  emptyStateConfig: {
    no_data_message: '',
    no_data_subtitle: '',
    no_results_message: '',
    no_results_subtitle: '',
  },
  setEmptyStateConfig: jest.fn(),
};

test('renders all four input fields', () => {
  render(
    <Form>
      <EmptyStateSection {...defaultProps} />
    </Form>,
  );

  expect(screen.getByLabelText(/No Data Message/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/No Data Subtitle/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/No Results Message/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/No Results Subtitle/i)).toBeInTheDocument();
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

  expect(screen.getByDisplayValue('Custom no data message')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Custom no data subtitle')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Custom no results message')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Custom no results subtitle')).toBeInTheDocument();
});

test('calls setEmptyStateConfig when no_data_message changes', async () => {
  const setEmptyStateConfig = jest.fn();
  const user = userEvent.setup();

  render(
    <Form>
      <EmptyStateSection
        {...defaultProps}
        setEmptyStateConfig={setEmptyStateConfig}
      />
    </Form>,
  );

  const input = screen.getByLabelText(/No Data Message/i);
  await user.clear(input);
  await user.type(input, 'New message');

  await waitFor(() => {
    expect(setEmptyStateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        no_data_message: 'New message',
      }),
    );
  });
});

test('calls setEmptyStateConfig when no_data_subtitle changes', async () => {
  const setEmptyStateConfig = jest.fn();
  const user = userEvent.setup();

  render(
    <Form>
      <EmptyStateSection
        {...defaultProps}
        setEmptyStateConfig={setEmptyStateConfig}
      />
    </Form>,
  );

  const textarea = screen.getByLabelText(/No Data Subtitle/i);
  await user.clear(textarea);
  await user.type(textarea, 'New subtitle');

  await waitFor(() => {
    expect(setEmptyStateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        no_data_subtitle: 'New subtitle',
      }),
    );
  });
});

test('calls setEmptyStateConfig when no_results_message changes', async () => {
  const setEmptyStateConfig = jest.fn();
  const user = userEvent.setup();

  render(
    <Form>
      <EmptyStateSection
        {...defaultProps}
        setEmptyStateConfig={setEmptyStateConfig}
      />
    </Form>,
  );

  const input = screen.getByLabelText(/No Results Message/i);
  await user.clear(input);
  await user.type(input, 'New no results message');

  await waitFor(() => {
    expect(setEmptyStateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        no_results_message: 'New no results message',
      }),
    );
  });
});

test('calls setEmptyStateConfig when no_results_subtitle changes', async () => {
  const setEmptyStateConfig = jest.fn();
  const user = userEvent.setup();

  render(
    <Form>
      <EmptyStateSection
        {...defaultProps}
        setEmptyStateConfig={setEmptyStateConfig}
      />
    </Form>,
  );

  const textarea = screen.getByLabelText(/No Results Subtitle/i);
  await user.clear(textarea);
  await user.type(textarea, 'New no results subtitle');

  await waitFor(() => {
    expect(setEmptyStateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        no_results_subtitle: 'New no results subtitle',
      }),
    );
  });
});

test('preserves other config values when updating one field', async () => {
  const setEmptyStateConfig = jest.fn();
  const user = userEvent.setup();
  const initialConfig = {
    no_data_message: 'Initial message',
    no_data_subtitle: 'Initial subtitle',
    no_results_message: 'Initial no results',
    no_results_subtitle: 'Initial no results subtitle',
  };

  render(
    <Form>
      <EmptyStateSection
        {...defaultProps}
        emptyStateConfig={initialConfig}
        setEmptyStateConfig={setEmptyStateConfig}
      />
    </Form>,
  );

  const input = screen.getByLabelText(/No Data Message/i);
  await user.clear(input);
  await user.type(input, 'Updated message');

  await waitFor(() => {
    expect(setEmptyStateConfig).toHaveBeenCalledWith({
      no_data_message: 'Updated message',
      no_data_subtitle: 'Initial subtitle',
      no_results_message: 'Initial no results',
      no_results_subtitle: 'Initial no results subtitle',
    });
  });
});

test('shows placeholder text for all fields', () => {
  render(
    <Form>
      <EmptyStateSection {...defaultProps} />
    </Form>,
  );

  expect(screen.getByPlaceholderText(/e.g., No data available/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/e.g., Please check your filters/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/e.g., No results found/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/e.g., Try adjusting your search/i)).toBeInTheDocument();
});
