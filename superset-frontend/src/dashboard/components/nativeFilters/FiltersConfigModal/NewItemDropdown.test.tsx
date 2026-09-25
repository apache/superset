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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import {
  FeatureFlag,
  isFeatureEnabled,
  NativeFilterType,
} from '@superset-ui/core';
import { FilterPlugins } from 'src/constants';
import NewItemDropdown from './NewItemDropdown';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

describe('NewItemDropdown', () => {
  const onAddFilter = jest.fn();
  const onAddCustomization = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders "Add parameter" when DASHBOARD_PARAMETERS is enabled', async () => {
    mockIsFeatureEnabled.mockImplementation(
      (flag: FeatureFlag) => flag === FeatureFlag.DashboardParameters,
    );

    render(
      <NewItemDropdown
        onAddFilter={onAddFilter}
        onAddCustomization={onAddCustomization}
      />,
    );

    const addButton = screen.getByTestId('new-item-dropdown-button');
    fireEvent.mouseOver(addButton);

    const paramOption = await screen.findByText('Add parameter');
    expect(paramOption).toBeInTheDocument();

    fireEvent.click(paramOption);
    expect(onAddFilter).toHaveBeenCalledWith(
      NativeFilterType.NativeFilter,
      FilterPlugins.Parameter,
    );
  });

  test('does not render "Add parameter" when DASHBOARD_PARAMETERS is disabled', () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    render(
      <NewItemDropdown
        onAddFilter={onAddFilter}
        onAddCustomization={onAddCustomization}
      />,
    );

    const addButton = screen.getByTestId('new-item-dropdown-button');
    fireEvent.mouseOver(addButton);

    expect(screen.queryByText('Add parameter')).not.toBeInTheDocument();
  });
});
