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
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { Indicator } from 'src/dashboard/components/nativeFilters/selectors';
import DetailsPanel from '.';

const createProps = () => ({
  appliedCrossFilterIndicators: [
    {
      column: 'clinical_stage',
      name: 'Clinical Stage',
      value: [],
      status: 'UNSET',
      path: [
        'ROOT_ID',
        'TABS-wUKya7eQ0Z',
        'TAB-BCIJF4NvgQ',
        'ROW-xSeNAspgw',
        'CHART-eirDduqb1A',
      ],
    },
  ] as Indicator[],
  appliedIndicators: [
    {
      column: 'country_name',
      name: 'Country',
      value: [],
      status: 'UNSET',
      path: [
        'ROOT_ID',
        'TABS-wUKya7eQ0Z',
        'TAB-BCIJF4NvgQ',
        'ROW-xSeNAspgw',
        'CHART-eirDduqb1A',
      ],
    },
  ] as Indicator[],
  incompatibleIndicators: [
    {
      column: 'product_category_copy',
      name: 'Vaccine Approach Copy',
      value: [],
      status: 'UNSET',
      path: [
        'ROOT_ID',
        'TABS-wUKya7eQ0Zz',
        'TAB-BCIJF4NvgQq',
        'ROW-xSeNAspgww',
        'CHART-eirDduqb1Aa',
      ],
    },
  ] as Indicator[],
  unsetIndicators: [
    {
      column: 'product_category',
      name: 'Vaccine Approach',
      value: [],
      status: 'UNSET',
      path: [
        'ROOT_ID',
        'TABS-wUKya7eQ0Z',
        'TAB-BCIJF4NvgQ',
        'ROW-xSeNAspgw',
        'CHART-eirDduqb1A',
      ],
    },
  ] as Indicator[],
  onHighlightFilterSource: jest.fn(),
});

test('Should render "appliedCrossFilterIndicators"', async () => {
  const props = createProps();
  props.appliedIndicators = [];
  props.incompatibleIndicators = [];
  props.unsetIndicators = [];

  render(
    <DetailsPanel {...props}>
      <div data-test="details-panel-content">Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  userEvent.hover(screen.getByTestId('details-panel-content'));
  expect(
    await screen.findByText('Applied cross-filters (1)'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Clinical Stage' }),
  ).toBeInTheDocument();

  expect(props.onHighlightFilterSource).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Clinical Stage' }));
  expect(props.onHighlightFilterSource).toBeCalledTimes(1);
  expect(props.onHighlightFilterSource).toBeCalledWith([
    'ROOT_ID',
    'TABS-wUKya7eQ0Z',
    'TAB-BCIJF4NvgQ',
    'ROW-xSeNAspgw',
    'CHART-eirDduqb1A',
    'LABEL-clinical_stage',
  ]);
});

test('Should render "appliedIndicators"', async () => {
  const props = createProps();
  props.appliedCrossFilterIndicators = [];
  props.incompatibleIndicators = [];
  props.unsetIndicators = [];

  render(
    <DetailsPanel {...props}>
      <div data-test="details-panel-content">Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  userEvent.hover(screen.getByTestId('details-panel-content'));
  expect(await screen.findByText('Applied filters (1)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Country' })).toBeInTheDocument();

  expect(props.onHighlightFilterSource).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Country' }));
  expect(props.onHighlightFilterSource).toBeCalledTimes(1);
  expect(props.onHighlightFilterSource).toBeCalledWith([
    'ROOT_ID',
    'TABS-wUKya7eQ0Z',
    'TAB-BCIJF4NvgQ',
    'ROW-xSeNAspgw',
    'CHART-eirDduqb1A',
    'LABEL-country_name',
  ]);
});

test('Should render empty', () => {
  const props = createProps();
  props.appliedCrossFilterIndicators = [];
  props.appliedIndicators = [];
  props.incompatibleIndicators = [];
  props.unsetIndicators = [];

  render(
    <DetailsPanel {...props}>
      <div data-test="details-panel-content">Content</div>
    </DetailsPanel>,
    { useRedux: true },
  );

  expect(screen.getByTestId('details-panel-content')).toBeInTheDocument();
  userEvent.click(screen.getByTestId('details-panel-content'));
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
