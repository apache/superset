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
import * as reactRedux from 'react-redux';
import {
  fireEvent,
  render,
  screen,
  cleanup,
  waitFor,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { createDatasource } from 'src/SqlLab/actions/sqlLab';
import { user, testQuery, mockdatasets } from 'src/SqlLab/fixtures';

const mockedProps = {
  visible: true,
  onHide: () => {},
  buttonTextOnSave: 'Save',
  buttonTextOnOverwrite: 'Overwrite',
  datasource: testQuery,
};

fetchMock.get('glob:*/api/v1/dataset/?*', {
  result: mockdatasets,
  dataset_count: 3,
});

jest.useFakeTimers();

// Mock the user
const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');
beforeEach(() => {
  useSelectorMock.mockClear();
  cleanup();
});

// Mock the createDatasource action
const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');
jest.mock('src/SqlLab/actions/sqlLab', () => ({
  createDatasource: jest.fn(),
}));
jest.mock('src/explore/exploreUtils/formData', () => ({
  postFormData: jest.fn(),
}));

describe('SaveDatasetModal', () => {
  it('renders a "Save as new" field', () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    const saveRadioBtn = screen.getByRole('radio', {
      name: /save as new unimportant/i,
    });

    const fieldLabel = screen.getByText(/save as new/i);
    const inputField = screen.getByRole('textbox');
    const inputFieldText = screen.getByDisplayValue(/unimportant/i);

    expect(saveRadioBtn).toBeVisible();
    expect(fieldLabel).toBeVisible();
    expect(inputField).toBeVisible();
    expect(inputFieldText).toBeVisible();
  });

  it('renders an "Overwrite existing" field', () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    const overwriteRadioBtn = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });
    const fieldLabel = screen.getByText(/overwrite existing/i);
    const inputField = screen.getByRole('combobox');
    const placeholderText = screen.getByText(/select or type dataset name/i);

    expect(overwriteRadioBtn).toBeVisible();
    expect(fieldLabel).toBeVisible();
    expect(inputField).toBeVisible();
    expect(placeholderText).toBeVisible();
  });

  it('renders a close button', () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    expect(screen.getByRole('button', { name: /close/i })).toBeVisible();
  });

  it('renders a save button when "Save as new" is selected', () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    // "Save as new" is selected when the modal opens by default
    expect(screen.getByRole('button', { name: /save/i })).toBeVisible();
  });

  it('renders an overwrite button when "Overwrite existing" is selected', () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    // Click the overwrite radio button to reveal the overwrite confirmation and back buttons
    const overwriteRadioBtn = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });
    userEvent.click(overwriteRadioBtn);

    expect(screen.getByRole('button', { name: /overwrite/i })).toBeVisible();
  });

  it('renders the overwrite button as disabled until an existing dataset is selected', async () => {
    useSelectorMock.mockReturnValue({ ...user });
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    // Click the overwrite radio button
    const overwriteRadioBtn = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });
    userEvent.click(overwriteRadioBtn);

    // Overwrite confirmation button should be disabled at this point
    const overwriteConfirmationBtn = screen.getByRole('button', {
      name: /overwrite/i,
    });
    expect(overwriteConfirmationBtn).toBeDisabled();

    // Click the overwrite select component
    const select = screen.getByRole('combobox', { name: /existing dataset/i })!;
    userEvent.click(select);

    await waitFor(() =>
      expect(screen.queryByText('Loading...')).not.toBeVisible(),
    );

    // Select the first "existing dataset" from the listbox
    const option = screen.getAllByText('coolest table 0')[1];
    userEvent.click(option);

    // Overwrite button should now be enabled
    expect(overwriteConfirmationBtn).toBeEnabled();
  });

  it('renders a confirm overwrite screen when overwrite is clicked', async () => {
    useSelectorMock.mockReturnValue({ ...user });
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    // Click the overwrite radio button
    const overwriteRadioBtn = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });
    userEvent.click(overwriteRadioBtn);

    // Click the overwrite select component
    const select = screen.getByRole('combobox', { name: /existing dataset/i });
    userEvent.click(select);

    await waitFor(() =>
      expect(screen.queryByText('Loading...')).not.toBeVisible(),
    );

    // Select the first "existing dataset" from the listbox
    const option = screen.getAllByText('coolest table 0')[1];
    userEvent.click(option);

    // Click the overwrite button to access the confirmation screen
    const overwriteConfirmationBtn = screen.getByRole('button', {
      name: /overwrite/i,
    });
    userEvent.click(overwriteConfirmationBtn);

    // Overwrite screen text
    expect(screen.getByText(/save or overwrite dataset/i)).toBeVisible();
    expect(
      screen.getByText(/are you sure you want to overwrite this dataset\?/i),
    ).toBeVisible();
    // Overwrite screen buttons
    expect(screen.getByRole('button', { name: /close/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /back/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /overwrite/i })).toBeVisible();
  });

  it('sends the schema when creating the dataset', async () => {
    const dummyDispatch = jest.fn().mockResolvedValue({});
    useDispatchMock.mockReturnValue(dummyDispatch);
    useSelectorMock.mockReturnValue({ ...user });

    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    const inputFieldText = screen.getByDisplayValue(/unimportant/i);
    fireEvent.change(inputFieldText, { target: { value: 'my dataset' } });

    const saveConfirmationBtn = screen.getByRole('button', {
      name: /save/i,
    });
    userEvent.click(saveConfirmationBtn);

    expect(createDatasource).toHaveBeenCalledWith({
      datasourceName: 'my dataset',
      dbId: 1,
      schema: 'main',
      sql: 'SELECT *',
      templateParams: undefined,
    });
  });
});
