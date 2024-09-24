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
import { Indicator } from 'src/dashboard/components/nativeFilters/selectors';
import FilterIndicator from '.';

const createProps = () => ({
  indicator: {
    column: 'product_category',
    name: 'Vaccine Approach',
    value: [] as any[],
    path: [
      'ROOT_ID',
      'TABS-wUKya7eQ0Z',
      'TAB-BCIJF4NvgQ',
      'ROW-xSeNAspgw',
      'CHART-eirDduqb1A',
    ],
  } as Indicator,
  onClick: jest.fn(),
});

test('Should render', () => {
  const props = createProps();
  render(<FilterIndicator {...props} />);

  expect(
    screen.getByRole('button', { name: 'Vaccine Approach' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('img')).toBeInTheDocument();
});

test('Should call "onClick"', () => {
  const props = createProps();
  render(<FilterIndicator {...props} />);

  expect(props.onClick).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Vaccine Approach' }));
  expect(props.onClick).toBeCalledTimes(1);
});

test('Should render "value"', () => {
  const props = createProps();
  props.indicator.value = ['any', 'string'];
  render(<FilterIndicator {...props} />);

  expect(
    screen.getByRole('button', {
      name: 'Vaccine Approach: any, string',
    }),
  ).toBeInTheDocument();
});

test('Should render with default props', () => {
  const props = createProps();
  delete props.indicator.path;
  render(<FilterIndicator indicator={props.indicator} />);

  expect(
    screen.getByRole('button', { name: 'Vaccine Approach' }),
  ).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Vaccine Approach' }));
});
