import React, { SyntheticEvent } from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Menu } from 'src/components/Menu';
import downloadAsImage from 'src/utils/downloadAsImage';
import DownloadAsImage from './DownloadAsImage';

jest.mock('src/utils/downloadAsImage', () => ({
  __esModule: true,
  default: jest.fn(() => (_e: SyntheticEvent) => {}),
}));

const createProps = () => ({
  addDangerToast: jest.fn(),
  text: 'Download as Image',
  dashboardTitle: 'Test Dashboard',
  logEvent: jest.fn(),
});

const renderComponent = () => {
  render(
    <Menu>
      <DownloadAsImage {...createProps()} />
    </Menu>,
  );
};

test('Should call download image on click', async () => {
  const props = createProps();
  renderComponent();
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
