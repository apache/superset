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
import { render, screen } from 'spec/helpers/testing-library';
import ApprovePublishModal from './ApprovePublishModal';
import type { ChangeRequest } from './types';

const base = {
  id: 1,
  asset_type: 'chart',
  asset_id: 42,
  status: 'pending',
  is_open: true,
  operation: 'update',
  changed_fields: ['viz_type'],
  changes: [{ field: 'viz_type', before: 'bar', after: 'line' }],
  proposed: {},
} as unknown as ChangeRequest;

const renderModal = (changeRequest: ChangeRequest) =>
  render(
    <ApprovePublishModal
      changeRequest={changeRequest}
      open
      onClose={() => {}}
      onConfirm={() => {}}
    />,
    { useRedux: true },
  );

test('says nothing extra when the chart has no waiting dependency', () => {
  renderModal(base);
  expect(
    screen.queryByTestId('pending-dependency-warning'),
  ).not.toBeInTheDocument();
});

test('warns when the chart dataset has a change waiting', async () => {
  // QA-09: approving the chart first publishes it against a dataset that
  // does not have the change it was written against.
  renderModal({
    ...base,
    pending_dependency: {
      asset_type: 'dataset',
      asset_id: 5,
      change_request_id: 99,
      status: 'pending',
      author: { id: 7, username: 'alex', first_name: 'Alex', last_name: 'Diaz' },
    },
  } as ChangeRequest);

  expect(
    await screen.findByTestId('pending-dependency-warning'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('The dataset this chart uses has a change waiting'),
  ).toBeInTheDocument();
});

test('names who is holding the dataset change', async () => {
  renderModal({
    ...base,
    pending_dependency: {
      asset_type: 'dataset',
      asset_id: 5,
      change_request_id: 99,
      status: 'pending',
      author: { id: 7, username: 'alex', first_name: 'Alex', last_name: 'Diaz' },
    },
  } as ChangeRequest);

  expect(await screen.findByText(/Alex Diaz/)).toBeInTheDocument();
});

test('still warns when the author is unknown', async () => {
  renderModal({
    ...base,
    pending_dependency: {
      asset_type: 'dataset',
      asset_id: 5,
      change_request_id: 99,
      status: 'pending',
      author: null,
    },
  } as ChangeRequest);

  expect(
    await screen.findByTestId('pending-dependency-warning'),
  ).toBeInTheDocument();
  expect(screen.getByText(/viewers will see it break/)).toBeInTheDocument();
});

test('the warning does not replace the publish wording', async () => {
  renderModal({
    ...base,
    pending_dependency: {
      asset_type: 'dataset',
      asset_id: 5,
      change_request_id: 99,
      status: 'pending',
      author: null,
    },
  } as ChangeRequest);

  // The approver still has to be told what approving does.
  expect(await screen.findByText(/Viewers see/)).toBeInTheDocument();
});
