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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import { testWithId } from 'src/utils/testUtils';
import { FilterBarLocation } from 'src/dashboard/types';
import { FILTER_BAR_TEST_ID } from './utils';
import FilterBar from '.';

describe('HorizontalFilterBar', () => {
  const getTestId = testWithId<string>(FILTER_BAR_TEST_ID, true);

  const renderWrapper = (state?: object) =>
    waitFor(() =>
      render(<FilterBar orientation={FilterBarLocation.HORIZONTAL} />, {
        initialState: state,
        useDnd: true,
        useRedux: true,
        useRouter: true,
      }),
    );

  it('should render', async () => {
    const { container } = await renderWrapper();
    expect(container).toBeInTheDocument();
  });

  it('should render the empty message', async () => {
    await renderWrapper();
    expect(
      screen.getByText('No filters are currently added to this dashboard.'),
    ).toBeInTheDocument();
  });

  it('should render the "Clear all" option', async () => {
    await renderWrapper();
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('should render the "Apply" option', async () => {
    await renderWrapper();
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('should not allow edit by disabled permissions', async () => {
    await renderWrapper({
      ...stateWithoutNativeFilters,
      dashboardInfo: { metadata: {} },
    });

    expect(
      screen.queryByTestId(getTestId('create-filter')),
    ).not.toBeInTheDocument();
  });

  it('should show as disabled with no filters', async () => {
    await renderWrapper(stateWithoutNativeFilters);

    expect(screen.getByTestId(getTestId('clear-button'))).toBeDisabled();
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });
});
