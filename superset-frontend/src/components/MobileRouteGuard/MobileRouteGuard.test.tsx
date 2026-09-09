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
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from 'spec/helpers/testing-library';
import { useIsMobile } from 'src/hooks/useIsMobile';
import MobileRouteGuard from '.';

jest.mock('src/hooks/useIsMobile', () => ({
  useIsMobile: jest.fn(),
  isMobileConsumptionEnabled: jest.fn().mockReturnValue(true),
}));

const mockedUseIsMobile = useIsMobile as jest.MockedFunction<
  typeof useIsMobile
>;

const renderGuard = (mobileSupported?: boolean) =>
  render(
    <MemoryRouter initialEntries={['/some/route/']}>
      <MobileRouteGuard mobileSupported={mobileSupported}>
        <div data-test="guarded-content">Content</div>
      </MobileRouteGuard>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockedUseIsMobile.mockReturnValue(false);
});

test('renders children on desktop regardless of mobileSupported', () => {
  renderGuard(undefined);
  expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
});

test('renders children on mobile when the route is mobileSupported', () => {
  mockedUseIsMobile.mockReturnValue(true);
  renderGuard(true);
  expect(screen.getByTestId('guarded-content')).toBeInTheDocument();
});

test('shows the unsupported screen on mobile for unsupported routes', () => {
  mockedUseIsMobile.mockReturnValue(true);
  renderGuard(undefined);
  expect(screen.queryByTestId('guarded-content')).not.toBeInTheDocument();
  expect(
    screen.getByText("This view isn't available on mobile"),
  ).toBeInTheDocument();
});
