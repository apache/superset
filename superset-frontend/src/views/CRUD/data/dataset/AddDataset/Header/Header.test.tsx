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
import React from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import Header from 'src/views/CRUD/data/dataset/AddDataset/Header';

describe('Header', () => {
  const mockSetDataset = jest.fn();

  const waitForRender = (datasetName: string) =>
    waitFor(() =>
      render(<Header setDataset={mockSetDataset} datasetName={datasetName} />),
    );

  it('renders a blank state Header', async () => {
    await waitForRender('');

    const datasetNameTextbox = screen.getByRole('textbox', {
      name: /dataset name/i,
    });
    const saveButton = screen.getByRole('button', {
      name: /save save/i,
    });
    const menuButton = screen.getByRole('button', {
      name: /menu actions trigger/i,
    });

    expect(datasetNameTextbox).toBeVisible();
    expect(saveButton).toBeVisible();
    expect(saveButton).toBeDisabled();
    expect(menuButton).toBeVisible();
    expect(menuButton).toBeDisabled();
  });

  it('updates display value of dataset name textbox when Header title is changed', async () => {
    await waitForRender('');

    const datasetNameTextbox = screen.getByRole('textbox', {
      name: /dataset name/i,
    });

    // Textbox should start with an empty display value and placeholder text
    expect(datasetNameTextbox).toHaveDisplayValue('');
    expect(
      screen.getByPlaceholderText(/add the name of the dataset/i),
    ).toBeVisible();

    // Textbox should update its display value when user inputs a new value
    userEvent.type(datasetNameTextbox, 'Test name');
    expect(datasetNameTextbox).toHaveDisplayValue('Test name');
  });

  it('passes an existing dataset title into the dataset name textbox', async () => {
    await waitForRender('Existing Dataset Name');

    const datasetNameTextbox = screen.getByRole('textbox', {
      name: /dataset name/i,
    });

    expect(datasetNameTextbox).toHaveDisplayValue('Existing Dataset Name');
  });
});
