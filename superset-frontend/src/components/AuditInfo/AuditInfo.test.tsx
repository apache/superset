import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { AuditInfo, AuditInfoProps, AuditInfoType } from '.';

const TEST_DATE = '2023-11-20';
const USER = {
  id: 1,
  first_name: 'Foo',
  last_name: 'Bar',
};

const Wrapper: React.FC<AuditInfoProps> = ({ type, user, date }) => (
  <ThemeProvider theme={supersetTheme}>
    <AuditInfo type={type} user={user} date={date} />
  </ThemeProvider>
);

test('should render a created tooltip when user is provided', async () => {
  render(<Wrapper type={AuditInfoType.Created} user={USER} date={TEST_DATE} />);

  const dateElement = screen.getByTestId('audit-info-date');
  expect(dateElement).toBeInTheDocument();
  expect(screen.getByText(TEST_DATE)).toBeInTheDocument();
  userEvent.hover(dateElement);
  expect(screen.queryByText('Created by: Foo Bar')).not.toBeInTheDocument();
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(screen.getByText('Created by: Foo Bar')).toBeInTheDocument();
});

test('should render a modified tooltip when user is provided', async () => {
  render(
    <Wrapper type={AuditInfoType.Modified} user={USER} date={TEST_DATE} />,
  );

  const dateElement = screen.getByTestId('audit-info-date');
  expect(dateElement).toBeInTheDocument();
  expect(screen.getByText(TEST_DATE)).toBeInTheDocument();
  expect(screen.queryByText('Modified by: Foo Bar')).not.toBeInTheDocument();
  userEvent.hover(dateElement);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(screen.getByText('Modified by: Foo Bar')).toBeInTheDocument();
});

test('should render only the date if username is not provided', async () => {
  render(<Wrapper type={AuditInfoType.Modified} date={TEST_DATE} />);

  const dateElement = screen.getByTestId('audit-info-date');
  expect(dateElement).toBeInTheDocument();
  expect(screen.getByText(TEST_DATE)).toBeInTheDocument();
  userEvent.hover(dateElement);
  await waitFor(
    () => {
      const tooltip = screen.queryByRole('tooltip');
      expect(tooltip).not.toBeInTheDocument();
    },
    { timeout: 1000 },
  );
});
