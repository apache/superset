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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';

import SemanticViewEditModal from './SemanticViewEditModal';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    ...jest.requireActual('@superset-ui/core').SupersetClient,
    put: jest.fn(),
  },
  getClientErrorObject: jest.fn(() => Promise.resolve({ error: '' })),
}));

const mockedPut = SupersetClient.put as jest.Mock;
const mockedGetClientErrorObject = getClientErrorObject as jest.Mock;

const createProps = () => ({
  show: true,
  onHide: jest.fn(),
  onSave: jest.fn(),
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  semanticView: {
    id: 7,
    table_name: 'orders_semantic_view',
    description: 'old description',
    cache_timeout: 60,
  },
});

beforeEach(() => {
  mockedPut.mockReset();
  mockedGetClientErrorObject.mockReset();
  mockedGetClientErrorObject.mockResolvedValue({ error: '' });
});

test('saves semantic view and refreshes list', async () => {
  mockedPut.mockResolvedValue({});
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(mockedPut).toHaveBeenCalledWith({
      endpoint: '/api/v1/semantic_view/7',
      jsonPayload: {
        description: 'old description',
        cache_timeout: 60,
      },
    });
  });
  expect(props.addSuccessToast).toHaveBeenCalledWith('Semantic view updated');
  expect(props.onSave).toHaveBeenCalled();
  expect(props.onHide).toHaveBeenCalled();
});

test('shows backend error toast when save fails', async () => {
  mockedPut.mockRejectedValue(new Error('save failed'));
  mockedGetClientErrorObject.mockResolvedValue({
    error: 'Semantic view failed to save',
  });
  const props = createProps();

  render(<SemanticViewEditModal {...props} />);

  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() => {
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'Semantic view failed to save',
    );
  });
});
