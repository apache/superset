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
import { useRef, useState } from 'react';
import { FeatureFlag, VizType } from '@superset-ui/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import mockState from 'spec/fixtures/mockState';
import { sliceId } from 'spec/fixtures/mockChartQueries';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import ChartContextMenu, {
  ChartContextMenuRef,
  ContextMenuItem,
} from './ChartContextMenu';

jest.mock('src/utils/cachedSupersetGet');

const mockCachedSupersetGet = cachedSupersetGet as jest.MockedFunction<
  typeof cachedSupersetGet
>;

const defaultFormData = {
  datasource: '1__table',
  viz_type: VizType.Pie,
};

const TestWrapper = () => {
  const contextMenuRef = useRef<ChartContextMenuRef>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(true);

  const handleClose = () => {
    setIsTooltipVisible(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => contextMenuRef.current?.open(100, 100, {})}
        data-test="open-context-menu"
      >
        Open Context Menu
      </button>
      {isTooltipVisible && (
        <div data-test="tooltip-visible">Tooltip is visible</div>
      )}
      <ChartContextMenu
        ref={contextMenuRef}
        id={sliceId}
        formData={defaultFormData}
        onSelection={jest.fn()}
        onClose={handleClose}
        displayedItems={ContextMenuItem.All}
      />
    </>
  );
};

const setup = () =>
  render(<TestWrapper />, {
    useRedux: true,
    initialState: {
      ...mockState,
      user: {
        ...mockState.user,
        roles: {
          Admin: [
            ['can_explore', 'Superset'],
            ['can_samples', 'Datasource'],
            ['can_write', 'ExploreFormDataRestApi'],
            ['can_get_drill_info', 'Dataset'],
          ],
        },
      },
    },
  });

beforeEach(() => {
  // @ts-ignore
  global.featureFlags = {
    [FeatureFlag.DrillToDetail]: true,
    [FeatureFlag.DrillBy]: true,
  };

  mockCachedSupersetGet.mockClear();
  mockCachedSupersetGet.mockResolvedValue({
    response: {} as Response,
    json: {
      result: {
        columns: [],
        metrics: [],
      },
    },
  });
});

afterEach(() => {
  // @ts-ignore
  delete global.featureFlags;
});

test('tooltip is restored when user clicks outside to close context menu', async () => {
  setup();

  const openButton = screen.getByTestId('open-context-menu');
  userEvent.click(openButton);

  await waitFor(() => {
    expect(screen.getByTestId('chart-context-menu')).toBeInTheDocument();
  });

  expect(screen.getByTestId('tooltip-visible')).toBeInTheDocument();

  userEvent.click(document.body);

  await waitFor(() => {
    expect(screen.getByTestId('tooltip-visible')).toBeInTheDocument();
  });
});

test('tooltip is restored when user selects a menu item', async () => {
  setup();

  const openButton = screen.getByTestId('open-context-menu');
  userEvent.click(openButton);

  await waitFor(() => {
    expect(screen.getByTestId('chart-context-menu')).toBeInTheDocument();
  });

  const menuItem = screen.getByText('Drill to detail');
  userEvent.click(menuItem);

  await waitFor(() => {
    expect(screen.getByTestId('tooltip-visible')).toBeInTheDocument();
  });
});
