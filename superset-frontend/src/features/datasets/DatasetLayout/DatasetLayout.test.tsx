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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import DatasetLayout from 'src/features/datasets/DatasetLayout';
import Header from 'src/features/datasets/AddDataset/Header';
import LeftPanel from 'src/features/datasets/AddDataset/LeftPanel';
import DatasetPanel from 'src/features/datasets/AddDataset/DatasetPanel';
import RightPanel from 'src/features/datasets/AddDataset/RightPanel';
import Footer from 'src/features/datasets/AddDataset/Footer';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

describe('DatasetLayout', () => {
  it('renders nothing when no components are passed in', () => {
    render(<DatasetLayout />, { useRouter: true });
    const layoutWrapper = screen.getByTestId('dataset-layout-wrapper');

    expect(layoutWrapper).toHaveTextContent('');
  });

  const mockSetDataset = jest.fn();

  const waitForRender = () =>
    waitFor(() => render(<Header setDataset={mockSetDataset} />));

  it('renders a Header when passed in', async () => {
    await waitForRender();

    expect(screen.getByText(/new dataset/i)).toBeVisible();
  });

  it('renders a LeftPanel when passed in', async () => {
    render(
      <DatasetLayout leftPanel={<LeftPanel setDataset={() => null} />} />,
      { useRedux: true, useRouter: true },
    );

    expect(
      await screen.findByText(/Select database or type to search databases/i),
    ).toBeInTheDocument();
    expect(LeftPanel).toBeTruthy();
  });

  it('renders a DatasetPanel when passed in', () => {
    render(<DatasetLayout datasetPanel={<DatasetPanel />} />, {
      useRouter: true,
    });

    const blankDatasetImg = screen.getByRole('img', { name: /empty/i });
    const blankDatasetTitle = screen.getByText(/select dataset source/i);

    expect(blankDatasetImg).toBeVisible();
    expect(blankDatasetTitle).toBeVisible();
  });

  it('renders a RightPanel when passed in', () => {
    render(<DatasetLayout rightPanel={RightPanel()} />, { useRouter: true });

    expect(screen.getByText(/right panel/i)).toBeVisible();
  });

  it('renders a Footer when passed in', () => {
    render(<DatasetLayout footer={<Footer url="" />} />, {
      useRedux: true,
      useRouter: true,
    });

    expect(screen.getByText(/Cancel/i)).toBeVisible();
  });
});
