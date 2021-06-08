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

import React from 'react';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';
import { render, screen } from 'spec/helpers/testing-library';
import mockState from 'spec/fixtures/mockState';
import { sliceId as chartId } from 'spec/fixtures/mockChartQueries';
import { nativeFiltersInfo } from 'spec/javascripts/dashboard/fixtures/mockNativeFilters';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import { ChartHolder } from './index';
import { CHART_TYPE, ROW_TYPE } from '../../util/componentTypes';

describe('ChartHolder', () => {
  const defaultProps = {
    component: {
      ...newComponentFactory(CHART_TYPE),
      id: 'CHART_ID',
      parents: ['ROOT_ID', 'TABS_ID', 'TAB_ID', 'ROW_ID'],
      meta: {
        chartId,
        width: 3,
        height: 10,
        chartName: 'Mock chart name',
      },
    },
    parentComponent: {
      ...newComponentFactory(ROW_TYPE),
      id: 'ROW_ID',
      children: ['COLUMN_ID'],
    },
    index: 0,
    depth: 0,
    id: 'CHART_ID',
    parentId: 'ROW_ID',
    availableColumnCount: 12,
    columnWidth: 300,
    onResizeStart: () => {},
    onResize: () => {},
    onResizeStop: () => {},
    handleComponentDrop: () => {},
    deleteComponent: () => {},
    updateComponents: () => {},
    editMode: false,
    isComponentVisible: true,
    dashboardId: 123,
    nativeFilters: nativeFiltersInfo.filters,
  };

  const renderWrapper = (props = defaultProps, state = mockState) =>
    render(<ChartHolder {...props} />, {
      useRedux: true,
      initialState: state,
      useDnd: true,
    });

  it('toggle full size', async () => {
    renderWrapper();

    let chart = (screen.getByTestId('slice-container')
      .firstChild as HTMLElement).style;
    expect(chart?.width).toBe('900px');
    expect(chart?.height).toBe('26px');

    userEvent.click(screen.getByRole('button'));
    userEvent.click(screen.getByText('Maximize chart'));

    chart = (screen.getByTestId('slice-container').firstChild as HTMLElement)
      .style;
    await waitFor(() => expect(chart?.width).toBe('992px'));
    expect(chart?.height).toBe('714px');
  });
});
