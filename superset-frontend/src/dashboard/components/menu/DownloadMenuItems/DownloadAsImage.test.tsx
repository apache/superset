import { SyntheticEvent } from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import 'jest-canvas-mock';
import DownloadAsImage from './DownloadAsImage';
import downloadAsImage from 'src/utils/downloadAsImage';
import { Menu } from 'src/components/Menu';

jest.mock('src/utils/downloadAsImage', () => {
  return {
    __esModule: true,
    default: jest.fn(() => (_e: SyntheticEvent) => {}),
  };
});

const createProps = () => {
  return {
    addDangerToast: jest.fn(),
    text: 'Download as Image',
    dashboardTitle: 'Test Dashboard',
    logEvent: jest.fn(),
  };
};

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
