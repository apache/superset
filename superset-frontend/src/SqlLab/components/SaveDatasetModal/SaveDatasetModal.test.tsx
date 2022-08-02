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
import { QueryResponse, testQuery } from '@superset-ui/core';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { render, screen } from 'spec/helpers/testing-library';

const mockedProps = {
  visible: true,
  onHide: () => {},
  buttonTextOnSave: 'Save',
  buttonTextOnOverwrite: 'Overwrite',
  datasource: testQuery as QueryResponse,
};

describe('SaveDatasetModal RTL', () => {
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
      name: /overwrite existing select or type dataset name/i,
    });
    const fieldLabel = screen.getByText(/overwrite existing/i);
    const inputField = screen.getByRole('combobox');
    const placeholderText = screen.getByText(/select or type dataset name/i);

    expect(overwriteRadioBtn).toBeVisible();
    expect(fieldLabel).toBeVisible();
    expect(inputField).toBeVisible();
    expect(placeholderText).toBeVisible();
  });

  it('renders a save button', () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    expect(screen.getByRole('button', { name: /save/i })).toBeVisible();
  });

  it('renders a close button', () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    expect(screen.getByRole('button', { name: /close/i })).toBeVisible();
  });
});
