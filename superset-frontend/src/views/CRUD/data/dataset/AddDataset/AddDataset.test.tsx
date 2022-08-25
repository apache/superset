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
import AddDataset from 'src/views/CRUD/data/dataset/AddDataset';

describe('AddDataset', () => {
  const waitForRender = () => waitFor(() => render(<AddDataset />));

  it('renders a blank state AddDataset', async () => {
    await waitForRender();

    const blankeStateImgs = screen.getAllByRole('img', { name: /empty/i });

    expect(await screen.findByText(/header/i)).toBeInTheDocument();
    // Header
    expect(
      screen.getByRole('textbox', {
        name: /dataset name/i,
      }),
    ).toBeVisible();
    // Left panel
    expect(blankeStateImgs[0]).toBeVisible();
    // Footer
    expect(screen.getByText(/footer/i)).toBeVisible();

    expect(blankeStateImgs.length).toBe(1);
  });
});
