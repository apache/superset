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
import DatasetLayout from 'src/views/CRUD/data/dataset/DatasetLayout';
import Header from 'src/views/CRUD/data/dataset/AddDataset/Header';
import LeftPanel from 'src/views/CRUD/data/dataset/AddDataset/LeftPanel';
import DatasetPanel from 'src/views/CRUD/data/dataset/AddDataset/DatasetPanel';
import RightPanel from 'src/views/CRUD/data/dataset/AddDataset/RightPanel';
import Footer from 'src/views/CRUD/data/dataset/AddDataset/Footer';

describe('DatasetLayout', () => {
  it('renders nothing when no components are passed in', () => {
    render(<DatasetLayout />);
    const layoutWrapper = screen.getByTestId('dataset-layout-wrapper');

    expect(layoutWrapper).toHaveTextContent('');
  });

  it('renders a Header when passed in', () => {
    render(<DatasetLayout header={Header()} />);

    expect(screen.getByText(/header/i)).toBeVisible();
  });

  it('renders a LeftPanel when passed in', async () => {
    render(
      <DatasetLayout leftPanel={<LeftPanel setDataset={() => null} />} />,
      { useRedux: true },
    );

    expect(
      await screen.findByText(/select database & schema/i),
    ).toBeInTheDocument();
    expect(LeftPanel).toBeTruthy();
  });

  it('renders a DatasetPanel when passed in', () => {
    render(<DatasetLayout datasetPanel={DatasetPanel()} />);

    const blankDatasetImg = screen.getByRole('img', { name: /empty/i });
    const blankDatasetTitle = screen.getByText(/select dataset source/i);

    expect(blankDatasetImg).toBeVisible();
    expect(blankDatasetTitle).toBeVisible();
  });

  it('renders a RightPanel when passed in', () => {
    render(<DatasetLayout rightPanel={RightPanel()} />);

    expect(screen.getByText(/right panel/i)).toBeVisible();
  });

  it('renders a Footer when passed in', () => {
    render(<DatasetLayout footer={Footer()} />);

    expect(screen.getByText(/footer/i)).toBeVisible();
  });
});
