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

import React, { SyntheticEvent } from 'react';
import { Menu } from 'src/components/Menu';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import DownloadMenuItems, { DownloadMenuItemProps } from '.';
import downloadAsPdf from 'src/utils/downloadAsPdf';
import downloadAsImage from 'src/utils/downloadAsImage';

jest.mock('src/utils/downloadAsPdf', () => {
  return {
    __esModule: true,
    default: jest.fn(() => (_e: SyntheticEvent) => {}),
  };
});
jest.mock('src/utils/downloadAsImage', () => {
  return {
    __esModule: true,
    default: jest.fn(() => (_e: SyntheticEvent) => {}),
  };
});

const createProps = () => {
  return {
    addDangerToast: jest.fn(),
    pdfMenuItemTitle: 'Export to PDF',
    imageMenuItemTitle: 'Download as Image',
    dashboardTitle: 'Test Dashboard',
    logEvent: jest.fn(),
  };
};

const renderComponent = (props: DownloadMenuItemProps) => {
  render(
    <div className=".dashboard">
      <Menu onClick={jest.fn()} selectable={false} data-test="main-menu">
        <DownloadMenuItems {...props} />
      </Menu>
    </div>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('Should render menu items', () => {
  const props = createProps();
  renderComponent(props);
  expect(
    screen.getByRole('menuitem', { name: 'Export to PDF' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: 'Download as Image' }),
  ).toBeInTheDocument();
});

test('Should call download pdf on click', async () => {
  const props = createProps();
  renderComponent(props);
  await waitFor(() => {
    expect(downloadAsPdf).toBeCalledTimes(0);
    expect(props.addDangerToast).toBeCalledTimes(0);
  });
  userEvent.click(screen.getByRole('button', { name: 'Export to PDF' }));

  await waitFor(() => {
    expect(downloadAsPdf).toBeCalledTimes(1);
    expect(props.addDangerToast).toBeCalledTimes(0);
  });
});

test('Should call download image on click', async () => {
  const props = createProps();
  renderComponent(props);
  await waitFor(() => {
    expect(downloadAsImage).toBeCalledTimes(0);
    expect(props.addDangerToast).toBeCalledTimes(0);
  });
  userEvent.click(screen.getByRole('button', { name: 'Download as Image' }));

  await waitFor(() => {
    expect(downloadAsImage).toBeCalledTimes(1);
    expect(props.addDangerToast).toBeCalledTimes(0);
  });
});

test('Should call addDangerToast once on failure to download pdf', async () => {
  const props = createProps();
  renderComponent(props);

  userEvent.click(screen.getByRole('button', { name: 'Export as PDF' }));

  await waitFor(() => {
    expect(props.addDangerToast).toBeCalledTimes(0);
  });

  await waitFor(async () => {
    expect(props.addDangerToast).toBeCalledTimes(1);
    expect(props.addDangerToast).toBeCalledWith(
      'Sorry, something went wrong. Try again later.',
    );
  });
});
