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

import { useState } from 'react';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { getMockStoreWithNativeFilters } from 'spec/fixtures/mockStore';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import DrillDetailModal from './DrillDetailModal';

jest.mock('./DrillDetailPane', () => () => null);
const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

jest.mock('src/explore/exploreUtils', () => ({
  ...jest.requireActual('src/explore/exploreUtils'),
  getExploreUrl: jest.fn(
    ({ formData }) =>
      `/explore/?dashboard_page_id=&slice_id=${formData.slice_id}`,
  ),
}));

const { id: chartId, form_data: formData } = chartQueries[sliceId];
const { slice_name: chartName } = formData;
const store = getMockStoreWithNativeFilters();
const drillToDetailModalState = {
  ...store.getState(),
  user: {
    ...store.getState().user,
    roles: { Admin: [['can_explore', 'Superset']] },
  },
};

const renderModal = async (
  overrideState: Record<string, any> = {},
  dataset?: any,
) => {
  const DrillDetailModalWrapper = () => {
    const [showModal, setShowModal] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setShowModal(true)}>
          Show modal
        </button>
        <DrillDetailModal
          chartId={chartId}
          formData={formData}
          initialFilters={[]}
          showModal={showModal}
          onHideModal={() => setShowModal(false)}
          dataset={dataset}
        />
      </>
    );
  };

  render(<DrillDetailModalWrapper />, {
    useRouter: true,
    useRedux: true,
    initialState: {
      ...drillToDetailModalState,
      ...overrideState,
    },
  });

  userEvent.click(screen.getByRole('button', { name: 'Show modal' }));
  await screen.findByRole('dialog', { name: `Drill to detail: ${chartName}` });
};

test('should render the title', async () => {
  await renderModal();
  expect(screen.getByText(`Drill to detail: ${chartName}`)).toBeInTheDocument();
});

test('should not render Edit chart button when no drill-through chart is configured', async () => {
  await renderModal();
  expect(
    screen.queryByRole('button', { name: 'Edit chart' }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
});

test('should render Edit chart link when drill-through chart is configured', async () => {
  const datasetWithDrillThrough = {
    drill_through_chart_id: 123,
    id: 456, // Required for URL generation
  };
  await renderModal({}, datasetWithDrillThrough);
  expect(screen.getByRole('link', { name: 'Edit chart' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
});

test('should close the modal', async () => {
  await renderModal();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  userEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('should have correct href for drill-through chart', async () => {
  const drillThroughChartId = 123;
  const datasetId = 456;
  const datasetWithDrillThrough = {
    drill_through_chart_id: drillThroughChartId,
    id: datasetId,
  };
  await renderModal({}, datasetWithDrillThrough);
  const editLink = screen.getByRole('link', { name: 'Edit chart' });
  expect(editLink).toHaveAttribute(
    'href',
    `/explore/?dashboard_page_id=&slice_id=${drillThroughChartId}`,
  );
  expect(editLink).not.toHaveAttribute('target'); // We removed target="_blank"
});

test('should render "Edit chart" as disabled without can_explore permission', async () => {
  const datasetWithDrillThrough = {
    drill_through_chart_id: 123,
    id: 456, // Required for URL generation
  };
  await renderModal(
    {
      user: {
        ...drillToDetailModalState.user,
        roles: { Admin: [['invalid_permission', 'Superset']] },
      },
    },
    datasetWithDrillThrough,
  );
  expect(screen.getByRole('button', { name: 'Edit chart' })).toBeDisabled();
});
