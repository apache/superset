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
import StatusBar from 'src/SqlLab/components/StatusBar';

jest.mock('src/components/ViewExtension', () => ({
  __esModule: true,
  default: ({ viewId }: { viewId: string }) => (
    <div data-test="mock-view-extension" data-view-id={viewId}>
      ViewExtension
    </div>
  ),
}));

test('renders StatusBar component', () => {
  render(<StatusBar />);
  expect(screen.getByTestId('mock-view-extension')).toBeInTheDocument();
});

test('renders ViewExtension with correct viewId', () => {
  render(<StatusBar />);
  const viewExtension = screen.getByTestId('mock-view-extension');
  expect(viewExtension).toHaveAttribute('data-view-id', 'sqllab.statusBar');
});

test('renders ViewExtension content', () => {
  render(<StatusBar />);
  expect(screen.getByText('ViewExtension')).toBeInTheDocument();
});
