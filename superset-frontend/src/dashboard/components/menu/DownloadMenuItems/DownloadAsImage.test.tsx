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
import userEvent from '@testing-library/user-event';
import { SyntheticEvent } from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { Menu } from 'src/components/Menu';
import downloadAsImage from 'src/utils/downloadAsImage';
import DownloadAsImage from './DownloadAsImage';

const mockAddDangerToast = jest.fn();

jest.mock('src/utils/downloadAsImage', () => ({
  __esModule: true,
  default: jest.fn(() => (_e: SyntheticEvent) => {}),
}));

jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: mockAddDangerToast,
  }),
}));

const createProps = () => ({
  text: 'Download as Image',
  dashboardTitle: 'Test Dashboard',
  logEvent: jest.fn(),
});

const renderComponent = () => {
  render(
    <Menu>
      <DownloadAsImage {...createProps()} />
    </Menu>,
    {
      useRedux: true,
    },
  );
};

test('Should call download image on click', async () => {
  renderComponent();
  await waitFor(() => {
    expect(downloadAsImage).toBeCalledTimes(0);
    expect(mockAddDangerToast).toBeCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Download as Image' }));

  await waitFor(() => {
    expect(downloadAsImage).toBeCalledTimes(1);
    expect(mockAddDangerToast).toBeCalledTimes(0);
  });
});

test('Component is rendered with role="button"', async () => {
  renderComponent();
  const button = screen.getByRole('button', { name: 'Download as Image' });
  expect(button).toBeInTheDocument();
});
