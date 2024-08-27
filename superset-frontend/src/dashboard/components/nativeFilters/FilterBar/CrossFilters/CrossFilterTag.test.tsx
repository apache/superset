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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { FilterBarOrientation } from 'src/dashboard/types';
import { CrossFilterIndicator, IndicatorStatus } from '../../selectors';
import CrossFilterTag from './CrossFilterTag';

const mockedProps: {
  filter: CrossFilterIndicator;
  orientation: FilterBarOrientation;
  removeCrossFilter: (filterId: number) => void;
  onClick?: () => void;
} = {
  filter: {
    name: 'test',
    emitterId: 1,
    column: 'country_name',
    value: 'Italy',
    status: IndicatorStatus.CrossFilterApplied,
    path: ['test-path'],
  },
  orientation: FilterBarOrientation.Horizontal,
  removeCrossFilter: jest.fn(),
};

const setup = (props: typeof mockedProps) =>
  render(<CrossFilterTag {...props} />, {
    useRedux: true,
  });

test('CrossFilterTag should render', () => {
  const { container } = setup(mockedProps);
  expect(container).toBeInTheDocument();
});

test('CrossFilterTag with adhoc column should render', () => {
  const props = {
    ...mockedProps,
    filter: {
      ...mockedProps.filter,
      column: {
        label: 'My column',
        sqlExpression: 'country_name',
        expressionType: 'SQL' as const,
      },
    },
  };

  const { container } = setup(props);
  expect(container).toBeInTheDocument();
  expect(screen.getByText('My column')).toBeInTheDocument();
  expect(screen.getByText('Italy')).toBeInTheDocument();
});

test('Column and value should be visible', () => {
  setup(mockedProps);
  expect(screen.getByText('country_name')).toBeInTheDocument();
  expect(screen.getByText('Italy')).toBeInTheDocument();
});

test('Tag should be closable', () => {
  setup(mockedProps);
  const close = screen.getByRole('button', { name: 'close' });
  expect(close).toBeInTheDocument();
  userEvent.click(close);
  expect(mockedProps.removeCrossFilter).toHaveBeenCalledWith(1);
});

test('Close icon should have role="button"', () => {
  setup({
    ...mockedProps,
    onClick: jest.fn(),
  });
  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
});
