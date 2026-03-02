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
import { act, render, screen } from 'spec/helpers/testing-library';
import { StatusAnnouncerProvider, useStatusAnnouncer } from './StatusAnnouncer';

// Test component that exposes the announce function
const TestConsumer = ({
  message,
  politeness,
}: {
  message: string;
  politeness?: 'polite' | 'assertive';
}) => {
  const { announce } = useStatusAnnouncer();
  return (
    <button type="button" onClick={() => announce(message, politeness)}>
      Announce
    </button>
  );
};

describe('StatusAnnouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders ARIA live regions', () => {
    render(
      <StatusAnnouncerProvider>
        <div>Content</div>
      </StatusAnnouncerProvider>,
    );

    const politeRegion = screen.getByTestId('status-announcer-polite');
    const assertiveRegion = screen.getByTestId('status-announcer-assertive');

    expect(politeRegion).toHaveAttribute('role', 'status');
    expect(politeRegion).toHaveAttribute('aria-live', 'polite');
    expect(politeRegion).toHaveAttribute('aria-atomic', 'true');

    expect(assertiveRegion).toHaveAttribute('role', 'alert');
    expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive');
    expect(assertiveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('announces polite messages', () => {
    render(
      <StatusAnnouncerProvider>
        <TestConsumer message="Data loaded" />
      </StatusAnnouncerProvider>,
    );

    const button = screen.getByText('Announce');
    act(() => {
      button.click();
    });

    const politeRegion = screen.getByTestId('status-announcer-polite');
    expect(politeRegion).toHaveTextContent('Data loaded');
  });

  it('announces assertive messages', () => {
    render(
      <StatusAnnouncerProvider>
        <TestConsumer message="Error occurred" politeness="assertive" />
      </StatusAnnouncerProvider>,
    );

    const button = screen.getByText('Announce');
    act(() => {
      button.click();
    });

    const assertiveRegion = screen.getByTestId('status-announcer-assertive');
    expect(assertiveRegion).toHaveTextContent('Error occurred');
  });

  it('clears messages after timeout', () => {
    render(
      <StatusAnnouncerProvider>
        <TestConsumer message="Temporary message" />
      </StatusAnnouncerProvider>,
    );

    const button = screen.getByText('Announce');
    act(() => {
      button.click();
    });

    const politeRegion = screen.getByTestId('status-announcer-polite');
    expect(politeRegion).toHaveTextContent('Temporary message');

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(politeRegion).toHaveTextContent('');
  });

  it('renders children correctly', () => {
    render(
      <StatusAnnouncerProvider>
        <div data-test="child-content">Child content</div>
      </StatusAnnouncerProvider>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
