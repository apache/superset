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
import { screen, render } from 'spec/helpers/testing-library';
import { dashboardComponents } from 'src/core';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  EXTENSION_TYPE,
  DASHBOARD_GRID_TYPE,
} from 'src/dashboard/util/componentTypes';
import DashboardExtensionComponent, {
  DashboardExtensionComponentProps,
} from './DashboardExtensionComponent';

const makeComponent = (extensionComponentId?: string) => {
  const component = newComponentFactory(EXTENSION_TYPE);
  component.meta.extensionComponentId = extensionComponentId;
  return component;
};

const baseProps = (
  overrides: Partial<DashboardExtensionComponentProps> = {},
): DashboardExtensionComponentProps => ({
  id: 'ext-id',
  parentId: 'parentId',
  component: makeComponent('acme.demo'),
  parentComponent: newComponentFactory(DASHBOARD_GRID_TYPE),
  index: 0,
  depth: 1,
  editMode: false,
  availableColumnCount: 12,
  columnWidth: 50,
  onResizeStart: jest.fn(),
  onResize: jest.fn(),
  onResizeStop: jest.fn(),
  deleteComponent: jest.fn(),
  handleComponentDrop: jest.fn(),
  updateComponents: jest.fn(),
  ...overrides,
});

const setup = (props: Partial<DashboardExtensionComponentProps> = {}) =>
  render(<DashboardExtensionComponent {...baseProps(props)} />, {
    useRedux: true,
    useDnd: true,
  });

test('renders the registered contributed component', () => {
  const disposable = dashboardComponents.registerDashboardComponent(
    { id: 'acme.demo', name: 'Acme Demo' },
    () => <div data-test="acme-demo-content">Acme content</div>,
  );
  setup();
  expect(screen.getByTestId('acme-demo-content')).toBeInTheDocument();
  disposable.dispose();
});

test('renders a graceful placeholder when the component is not registered', () => {
  setup({ component: makeComponent('not.installed') });
  expect(
    screen.getByTestId('dashboard-component-extension-missing'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/requires the "not.installed" extension/),
  ).toBeInTheDocument();
});

test('passes editMode and an updateMeta that patches the instance meta', () => {
  const updateComponents = jest.fn();
  let captured: ((patch: Record<string, unknown>) => void) | undefined;
  const disposable = dashboardComponents.registerDashboardComponent(
    { id: 'acme.meta', name: 'Acme Meta' },
    ({ editMode, updateMeta }) => {
      captured = updateMeta;
      return <div>{editMode ? 'editing' : 'viewing'}</div>;
    },
  );
  setup({
    component: makeComponent('acme.meta'),
    editMode: true,
    updateComponents,
  });
  expect(screen.getByText('editing')).toBeInTheDocument();
  captured?.({ url: 'https://x.com' });
  expect(updateComponents).toHaveBeenCalledTimes(1);
  const updated = Object.values(updateComponents.mock.calls[0][0])[0] as {
    meta: { url: string };
  };
  expect(updated.meta.url).toBe('https://x.com');
  disposable.dispose();
});
