import React, { SyntheticEvent } from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Menu } from 'src/components/Menu';
import downloadAsPdf from 'src/utils/downloadAsPdf';
import DownloadAsPdf from './DownloadAsPdf';

jest.mock('src/utils/downloadAsPdf', () => ({
  __esModule: true,
  default: jest.fn(() => (_e: SyntheticEvent) => {}),
}));

const createProps = () => ({
  addDangerToast: jest.fn(),
  text: 'Export as PDF',
  dashboardTitle: 'Test Dashboard',
  logEvent: jest.fn(),
});

const renderComponent = () => {
  render(
    <Menu>
      <DownloadAsPdf {...createProps()} />
    </Menu>,
  );
};

test('Should call download pdf on click', async () => {
  const props = createProps();
  renderComponent();
  await waitFor(() => {
    expect(downloadAsPdf).toBeCalledTimes(0);
    expect(props.addDangerToast).toBeCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Export as PDF' }));

  await waitFor(() => {
    expect(downloadAsPdf).toBeCalledTimes(1);
    expect(props.addDangerToast).toBeCalledTimes(0);
  });
});
