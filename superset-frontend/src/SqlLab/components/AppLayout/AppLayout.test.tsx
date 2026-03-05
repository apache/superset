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
import React from 'react';
import { render, userEvent, waitFor } from 'spec/helpers/testing-library';
import { initialState } from 'src/SqlLab/fixtures';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import { views } from 'src/core';
import { ViewLocations } from 'src/SqlLab/contributions';
import AppLayout from './index';
import { Mock } from 'vitest';

vi.mock('src/components/ResizableSidebar/useStoredSidebarWidth');
vi.mock('src/components/Splitter', () => {
  const Splitter = ({
    onResizeEnd,
    children,
  }: {
    onResizeEnd: (sizes: number[]) => void;
    children: React.ReactNode;
  }) => (
    <div>
      {children}
      <button type="button" onClick={() => onResizeEnd([500])}>
        Resize
      </button>
      <button type="button" onClick={() => onResizeEnd([0])}>
        Resize to zero
      </button>
    </div>
  );
  // eslint-disable-next-line react/display-name
  Splitter.Panel = ({ children }: { children: React.ReactNode }) => (
    <div data-test="mock-panel">{children}</div>
  );
  return { Splitter };
});
vi.mock('@superset-ui/core/components/Grid', async importActual => ({
  ...(await importActual()),
  useBreakpoint: vi.fn().mockReturnValue(true),
}));

const defaultProps = {
  children: <div>Child</div>,
};

beforeEach(() => {
  vi.clearAllMocks();
  (useStoredSidebarWidth as Mock).mockReturnValue([250, vi.fn()]);
});

test('renders two panels', () => {
  const { getAllByTestId } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });
  expect(getAllByTestId('mock-panel')).toHaveLength(2);
});

test('renders children', () => {
  const { getByText } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });
  expect(getByText('Child')).toBeInTheDocument();
});

test('calls setWidth on sidebar resize when not hidden', async () => {
  const setWidth = vi.fn();
  (useStoredSidebarWidth as Mock).mockReturnValue([250, setWidth]);
  const { getByRole } = render(<AppLayout {...defaultProps} />, {
    useRedux: true,
    initialState,
  });

  // toggle sidebar to show
  await userEvent.click(getByRole('button', { name: 'Resize' }));
  // set different width
  await userEvent.click(getByRole('button', { name: 'Resize' }));
  await waitFor(() => expect(setWidth).toHaveBeenCalled());
});

test('renders right sidebar when view is contributed at rightSidebar location', () => {
  views.registerView(
    { id: 'test-right-sidebar-view', name: 'Test Right Sidebar View' },
    ViewLocations.sqllab.rightSidebar,
    () => React.createElement('div', null, 'Right Sidebar Content'),
  );

  const { getByText, getAllByTestId } = render(
    <AppLayout {...defaultProps} />,
    {
      useRedux: true,
      initialState,
    },
  );

  expect(getByText('Child')).toBeInTheDocument();
  expect(getAllByTestId('mock-panel')).toHaveLength(3);
});
