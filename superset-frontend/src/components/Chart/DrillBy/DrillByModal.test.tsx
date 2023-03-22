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

import React, { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { getMockStoreWithNativeFilters } from 'spec/fixtures/mockStore';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import DrillByModal from './DrillByModal';

const { id: chartId, form_data: formData } = chartQueries[sliceId];
const { slice_name: chartName } = formData;

const renderModal = async () => {
  const store = getMockStoreWithNativeFilters();
  const DrillByModalWrapper = () => {
    const [showModal, setShowModal] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setShowModal(true)}>
          Show modal
        </button>
        <DrillByModal
          chartId={chartId}
          formData={formData}
          initialFilters={[]}
          showModal={showModal}
          onHideModal={() => setShowModal(false)}
        />
      </>
    );
  };

  render(<DrillByModalWrapper />, {
    useRouter: true,
    useRedux: true,
    store,
  });

  userEvent.click(screen.getByRole('button', { name: 'Show modal' }));
  await screen.findByRole('dialog', { name: `Drill by: ${chartName}` });
};

test('should render the title', async () => {
  await renderModal();
  expect(screen.getByText(`Drill by: ${chartName}`)).toBeInTheDocument();
});

test('should render the button', async () => {
  await renderModal();
  expect(
    screen.getByRole('button', { name: 'Edit chart' }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
});

test('should close the modal', async () => {
  await renderModal();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  userEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
