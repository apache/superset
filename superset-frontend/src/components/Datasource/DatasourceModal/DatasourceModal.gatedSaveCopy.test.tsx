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

/**
 * What the dataset confirm dialog promises, when the save is going to be
 * captured for review instead of applied.
 *
 * It promised "save and apply changes" to everybody, including the author
 * whose PUT was about to come back 202 with the live dataset untouched.
 * These pin the sentence to the outcome rather than to its wording: the
 * gated dialog must not promise to apply anything, and must say so
 * differently depending on whether the author already has a draft for it
 * to fold into.
 */
import type { ReactElement } from 'react';
import fetchMock from 'fetch-mock';
import {
  cleanup,
  defaultStore as store,
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import mockDatasource from 'spec/fixtures/mockDatasource';
import DatasourceModalComponent from '.';

const DatasourceModal = DatasourceModalComponent as unknown as (
  props: Record<string, any>,
) => ReactElement;

const DATASET = 'glob:*/api/v1/dataset/7';
const SAVE = 'glob:*/api/v1/dataset/7?override_columns=*';
const DATABASES = 'glob:*/api/v1/database/?q=*';
const OPEN_CHANGE = 'glob:*/api/v1/change_request/asset/dataset/7';

const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
  onHide: () => {},
  show: true,
  onDatasourceSave: jest.fn(),
};

/** The open change the author already has on this dataset, or none. */
function serveOpenChange(proposed: Record<string, unknown> | null) {
  fetchMock.get(
    OPEN_CHANGE,
    proposed
      ? {
          result: {
            id: 99,
            is_open: true,
            is_author: true,
            status: 'draft',
            proposed,
          },
        }
      : { result: null },
  );
}

async function openTheConfirmDialog() {
  render(<DatasourceModal {...props} />, { store, useRouter: true });
  await waitFor(() =>
    expect(screen.getByTestId('datasource-modal-save')).toBeEnabled(),
  );
  fireEvent.click(screen.getByTestId('datasource-modal-save'));
  await screen.findByText('Confirm save');
}

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.put(SAVE, {});
  fetchMock.get(DATASET, { result: {} });
  fetchMock.get(DATABASES, { result: [] });
});

afterEach(() => {
  cleanup();
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = {};
});

test('promises to apply the changes when nothing is gating the save', async () => {
  window.featureFlags = { CHANGE_MANAGEMENT: false };
  serveOpenChange(null);

  await openTheConfirmDialog();

  expect(screen.getByTestId('datasource-save-question')).toHaveTextContent(
    'Are you sure you want to save and apply changes?',
  );
  expect(
    screen.queryByTestId('datasource-save-consequence'),
  ).not.toBeInTheDocument();
});

test('never promises to apply anything once the save is captured for review', async () => {
  window.featureFlags = { CHANGE_MANAGEMENT: true };
  serveOpenChange(null);

  await openTheConfirmDialog();

  const question = screen.getByTestId('datasource-save-question');
  expect(question).toHaveTextContent(/for review/i);
  // The defect itself: the old sentence promised the opposite of what the
  // gate does, so it must not survive anywhere in the dialog.
  expect(question).not.toHaveTextContent(/apply changes\?/i);
  expect(
    screen.queryByText(/save and apply changes/i),
  ).not.toBeInTheDocument();

  const consequence = screen.getByTestId('datasource-save-consequence');
  expect(consequence).toHaveTextContent(/nothing is applied yet/i);
  expect(consequence).toHaveTextContent(/still see the live version/i);
});

test("says the save folds into the author's draft when they already have one", async () => {
  window.featureFlags = { CHANGE_MANAGEMENT: true };
  serveOpenChange({ description: 'what the author already proposed' });

  await openTheConfirmDialog();

  await waitFor(() =>
    expect(screen.getByTestId('datasource-save-consequence')).toHaveTextContent(
      /existing draft/i,
    ),
  );
  expect(screen.getByTestId('datasource-save-consequence')).toHaveTextContent(
    /nothing is applied yet/i,
  );
});
