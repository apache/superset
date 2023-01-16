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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Menu } from 'src/components/Menu';
import SaveDatasetActionButton from 'src/SqlLab/components/SaveDatasetActionButton';

const overlayMenu = (
  <Menu>
    <Menu.Item>Save dataset</Menu.Item>
  </Menu>
);

describe('SaveDatasetActionButton', () => {
  test('renders a split save button', async () => {
    render(
      <SaveDatasetActionButton
        setShowSave={() => true}
        overlayMenu={overlayMenu}
      />,
    );

    const saveBtn = screen.getByRole('button', { name: /save/i });
    const caretBtn = screen.getByRole('button', { name: /caret-down/i });

    expect(
      await screen.findByRole('button', { name: /save/i }),
    ).toBeInTheDocument();
    expect(saveBtn).toBeVisible();
    expect(caretBtn).toBeVisible();
  });

  test('renders a "save dataset" dropdown menu item when user clicks caret button', async () => {
    render(
      <SaveDatasetActionButton
        setShowSave={() => true}
        overlayMenu={overlayMenu}
      />,
    );

    const caretBtn = screen.getByRole('button', { name: /caret-down/i });
    expect(
      await screen.findByRole('button', { name: /caret-down/i }),
    ).toBeInTheDocument();
    userEvent.click(caretBtn);

    const saveDatasetMenuItem = screen.getByText(/save dataset/i);

    expect(saveDatasetMenuItem).toBeInTheDocument();
  });
});
