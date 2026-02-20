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
import { MenuItemType } from '@superset-ui/core/components/Menu';
import SqlEditorTopBar, {
  SqlEditorTopBarProps,
} from 'src/SqlLab/components/SqlEditorTopBar';

jest.mock('src/components/PanelToolbar', () => ({
  __esModule: true,
  default: ({
    viewId,
    defaultPrimaryActions,
    defaultSecondaryActions,
  }: {
    viewId: string;
    defaultPrimaryActions?: React.ReactNode;
    defaultSecondaryActions?: MenuItemType[];
  }) => (
    <div
      data-test="mock-panel-toolbar"
      data-view-id={viewId}
      data-default-secondary-count={defaultSecondaryActions?.length ?? 0}
    >
      {defaultPrimaryActions}
    </div>
  ),
}));

const defaultProps: SqlEditorTopBarProps = {
  queryEditorId: 'test-query-editor-id',
  defaultPrimaryActions: <button type="button">Primary Action</button>,
  defaultSecondaryActions: [
    { key: 'action1', label: 'Action 1' },
    { key: 'action2', label: 'Action 2' },
  ],
};

const setup = (props?: Partial<SqlEditorTopBarProps>) =>
  render(<SqlEditorTopBar {...defaultProps} {...props} />);

test('renders SqlEditorTopBar component', () => {
  setup();
  const panelToolbar = screen.getByTestId('mock-panel-toolbar');
  expect(panelToolbar).toBeInTheDocument();
});

test('renders PanelToolbar with correct viewId', () => {
  setup();
  const panelToolbar = screen.getByTestId('mock-panel-toolbar');
  expect(panelToolbar).toHaveAttribute('data-view-id', 'sqllab.editor');
});

test('renders PanelToolbar with correct secondary actions count', () => {
  setup();
  const panelToolbar = screen.getByTestId('mock-panel-toolbar');
  expect(panelToolbar).toHaveAttribute('data-default-secondary-count', '2');
});

test('renders defaultPrimaryActions', () => {
  setup();
  expect(
    screen.getByRole('button', { name: 'Primary Action' }),
  ).toBeInTheDocument();
});

test('renders with custom primary actions', () => {
  const customPrimaryActions = (
    <>
      <button type="button">Custom Action 1</button>
      <button type="button">Custom Action 2</button>
    </>
  );

  setup({ defaultPrimaryActions: customPrimaryActions });

  expect(
    screen.getByRole('button', { name: 'Custom Action 1' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Custom Action 2' }),
  ).toBeInTheDocument();
});

test('renders with empty secondary actions', () => {
  setup({ defaultSecondaryActions: [] });

  const panelToolbar = screen.getByTestId('mock-panel-toolbar');
  expect(panelToolbar).toHaveAttribute('data-default-secondary-count', '0');
});
