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
import userEvent from '@testing-library/user-event';
import { ExploreAlert } from './ExploreAlert';

test('renders with title and body text', () => {
  render(
    <ExploreAlert title="Test Title" bodyText="Test body text" type="info" />,
  );

  expect(screen.getByText('Test Title')).toBeInTheDocument();
  expect(screen.getByText('Test body text')).toBeInTheDocument();
});

test('renders info type alert', () => {
  const { container } = render(
    <ExploreAlert title="Info Alert" bodyText="Info message" type="info" />,
  );

  expect(container.querySelector('.ant-alert-info')).toBeInTheDocument();
});

test('renders warning type alert', () => {
  const { container } = render(
    <ExploreAlert
      title="Warning Alert"
      bodyText="Warning message"
      type="warning"
    />,
  );

  expect(container.querySelector('.ant-alert-warning')).toBeInTheDocument();
});

test('renders error type alert', () => {
  const { container } = render(
    <ExploreAlert title="Error Alert" bodyText="Error message" type="error" />,
  );

  expect(container.querySelector('.ant-alert-error')).toBeInTheDocument();
});

test('renders primary button when text and action provided', () => {
  const primaryAction = jest.fn();

  render(
    <ExploreAlert
      title="Alert with button"
      bodyText="Body text"
      type="info"
      primaryButtonText="Primary Action"
      primaryButtonAction={primaryAction}
    />,
  );

  expect(screen.getByText('Primary Action')).toBeInTheDocument();
});

test('calls primary button action when clicked', async () => {
  const primaryAction = jest.fn();

  render(
    <ExploreAlert
      title="Alert with button"
      bodyText="Body text"
      type="info"
      primaryButtonText="Click Me"
      primaryButtonAction={primaryAction}
    />,
  );

  await userEvent.click(screen.getByText('Click Me'));
  expect(primaryAction).toHaveBeenCalledTimes(1);
});

test('renders both primary and secondary buttons when provided', () => {
  const primaryAction = jest.fn();
  const secondaryAction = jest.fn();

  render(
    <ExploreAlert
      title="Alert with buttons"
      bodyText="Body text"
      type="info"
      primaryButtonText="Primary"
      primaryButtonAction={primaryAction}
      secondaryButtonText="Secondary"
      secondaryButtonAction={secondaryAction}
    />,
  );

  expect(screen.getByText('Primary')).toBeInTheDocument();
  expect(screen.getByText('Secondary')).toBeInTheDocument();
});

test('calls secondary button action when clicked', async () => {
  const primaryAction = jest.fn();
  const secondaryAction = jest.fn();

  render(
    <ExploreAlert
      title="Alert with buttons"
      bodyText="Body text"
      type="info"
      primaryButtonText="Primary"
      primaryButtonAction={primaryAction}
      secondaryButtonText="Secondary"
      secondaryButtonAction={secondaryAction}
    />,
  );

  await userEvent.click(screen.getByText('Secondary'));
  expect(secondaryAction).toHaveBeenCalledTimes(1);
  expect(primaryAction).not.toHaveBeenCalled();
});

test('does not render buttons when only text is provided without action', () => {
  render(
    <ExploreAlert
      title="Alert without action"
      bodyText="Body text"
      type="info"
      primaryButtonText="Primary"
    />,
  );

  expect(screen.queryByText('Primary')).not.toBeInTheDocument();
});

test('does not render buttons when only action is provided without text', () => {
  const primaryAction = jest.fn();

  render(
    <ExploreAlert
      title="Alert without text"
      bodyText="Body text"
      type="info"
      primaryButtonAction={primaryAction}
    />,
  );

  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('does not render secondary button when secondary action is missing', () => {
  const primaryAction = jest.fn();

  render(
    <ExploreAlert
      title="Alert"
      bodyText="Body text"
      type="info"
      primaryButtonText="Primary"
      primaryButtonAction={primaryAction}
      secondaryButtonText="Secondary"
    />,
  );

  expect(screen.getByText('Primary')).toBeInTheDocument();
  expect(screen.queryByText('Secondary')).not.toBeInTheDocument();
});

test('does not render secondary button when secondary text is missing', () => {
  const primaryAction = jest.fn();
  const secondaryAction = jest.fn();

  render(
    <ExploreAlert
      title="Alert"
      bodyText="Body text"
      type="info"
      primaryButtonText="Primary"
      primaryButtonAction={primaryAction}
      secondaryButtonAction={secondaryAction}
    />,
  );

  expect(screen.getByText('Primary')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /secondary/i }),
  ).not.toBeInTheDocument();
});

test('applies custom className', () => {
  const { container } = render(
    <ExploreAlert
      title="Alert"
      bodyText="Body text"
      type="info"
      className="custom-class"
    />,
  );

  expect(container.querySelector('.custom-class')).toBeInTheDocument();
});

test('renders with ReactNode as bodyText', () => {
  render(
    <ExploreAlert
      title="Alert"
      bodyText={
        <div>
          <span>Line 1</span>
          <span>Line 2</span>
        </div>
      }
      type="info"
    />,
  );

  expect(screen.getByText('Line 1')).toBeInTheDocument();
  expect(screen.getByText('Line 2')).toBeInTheDocument();
});

test('is not closable by default', () => {
  const { container } = render(
    <ExploreAlert title="Alert" bodyText="Body text" type="info" />,
  );

  expect(
    container.querySelector('.ant-alert-close-icon'),
  ).not.toBeInTheDocument();
});

test('shows icon by default', () => {
  const { container } = render(
    <ExploreAlert title="Alert" bodyText="Body text" type="info" />,
  );

  expect(container.querySelector('.anticon')).toBeInTheDocument();
});
