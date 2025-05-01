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
import { render, screen } from 'spec/helpers/testing-library';
import AddDataset from 'src/pages/DatasetCreation';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
  useParams: () => ({ datasetId: undefined }),
}));

describe('AddDataset', () => {
  it('renders a blank state AddDataset', async () => {
    render(<AddDataset />, { useRedux: true, useRouter: true });

    const blankeStateImgs = screen.getAllByRole('img', { name: /empty/i });

    // Header
    expect(await screen.findByText(/new dataset/i)).toBeVisible();
    // Left panel
    expect(blankeStateImgs[0]).toBeVisible();
    // Footer
    expect(screen.getByText(/Cancel/i)).toBeVisible();

    expect(blankeStateImgs.length).toBe(1);
  });
});
