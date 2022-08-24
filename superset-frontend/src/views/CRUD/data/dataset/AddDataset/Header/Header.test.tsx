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
import { render, screen, act } from 'spec/helpers/testing-library';
import Header from 'src/views/CRUD/data/dataset/AddDataset/Header';

describe('Header', () => {
  const renderAndWait = async () => {
    const mounted = act(async () => {
      render(<Header />);
    });

    return mounted;
  };

  it('renders a blank state Header', async () => {
    await renderAndWait();

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
});
