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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import DownloadDropdown from './DownloadDropdown';

const onDownloadCSV = jest.fn();
const onDownloadXLSX = jest.fn();

beforeEach(() => {
  onDownloadCSV.mockClear();
  onDownloadXLSX.mockClear();
});

const setup = () =>
  render(
    <DownloadDropdown
      onDownloadCSV={onDownloadCSV}
      onDownloadXLSX={onDownloadXLSX}
    />,
  );

test('renders a download trigger with accessible label', () => {
  setup();
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
});

test('fires onDownloadCSV when CSV menu item is selected', async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Download' }));
  await userEvent.click(await screen.findByText('Export to CSV'));
  expect(onDownloadCSV).toHaveBeenCalledTimes(1);
  expect(onDownloadXLSX).not.toHaveBeenCalled();
});

test('fires onDownloadXLSX when Excel menu item is selected', async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Download' }));
  await userEvent.click(await screen.findByText('Export to Excel'));
  expect(onDownloadXLSX).toHaveBeenCalledTimes(1);
  expect(onDownloadCSV).not.toHaveBeenCalled();
});
