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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
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

const renderModal = async (overrideState: Record<string, any> = {}) => {
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

test('should render the close button', async () => {
  await renderModal();
  expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
  // Check that our footer close button is present
  expect(screen.getByTestId('close-drilltodetail-modal')).toBeInTheDocument();
});

test('should close the modal', async () => {
  await renderModal();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  userEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('should not have edit chart functionality', async () => {
  await renderModal();
  // Edit chart button should not be present
  expect(screen.queryByRole('button', { name: 'Edit chart' })).not.toBeInTheDocument();
});

test('should not have edit chart button regardless of permissions', async () => {
  await renderModal({
    user: {
      ...drillToDetailModalState.user,
      roles: { Admin: [['invalid_permission', 'Superset']] },
    },
  });
  // Edit chart button should not be present regardless of permissions
  expect(screen.queryByRole('button', { name: 'Edit chart' })).not.toBeInTheDocument();
});
