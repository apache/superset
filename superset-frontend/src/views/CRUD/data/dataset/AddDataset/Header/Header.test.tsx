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
import Header, {
  DEFAULT_TITLE,
} from 'src/views/CRUD/data/dataset/AddDataset/Header';

describe('Header', () => {
  const mockSetDataset = jest.fn();

  const waitForRender = (props?: any) =>
    waitFor(() => render(<Header setDataset={mockSetDataset} {...props} />));

  test('renders a blank state Header', async () => {
    await waitForRender();

    const datasetName = screen.getByTestId('editable-title');
    const saveButton = screen.getByRole('button', {
      name: /save save/i,
    });
    const menuButton = screen.getByRole('button', {
      name: /menu actions trigger/i,
    });

    expect(datasetName).toBeVisible();
    expect(saveButton).toBeVisible();
    expect(saveButton).toBeDisabled();
    expect(menuButton).toBeVisible();
    expect(menuButton).toBeDisabled();
  });

  test('displays "New dataset" when a table is not selected', async () => {
    await waitForRender();

    const datasetName = screen.getByTestId('editable-title');
    expect(datasetName.innerHTML).toBe(DEFAULT_TITLE);
  });

  test('displays table name when a table is selected', async () => {
    // The schema and table name are passed in through props once selected
    await waitForRender({ schema: 'testSchema', title: 'testTable' });

    const datasetName = screen.getByTestId('editable-title');

    expect(datasetName.innerHTML).toBe('testTable');
  });
});
