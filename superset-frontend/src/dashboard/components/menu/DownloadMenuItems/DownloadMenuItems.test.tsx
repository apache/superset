import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import DownloadMenuItems from '.';

const createProps = () => ({
  addDangerToast: jest.fn(),
  pdfMenuItemTitle: 'Export to PDF',
  imageMenuItemTitle: 'Download as Image',
  dashboardTitle: 'Test Dashboard',
  logEvent: jest.fn(),
});

const renderComponent = () => {
  render(<DownloadMenuItems {...createProps()} />);
};

test('Should render menu items', () => {
  renderComponent();
  expect(
    screen.getByRole('menuitem', { name: 'Export to PDF' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: 'Download as Image' }),
  ).toBeInTheDocument();
});
