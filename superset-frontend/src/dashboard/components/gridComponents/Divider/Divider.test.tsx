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
/**
 * Licensed to the Apache Software Foundation (ASF)...
 */
import sinon from 'sinon';

import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  DIVIDER_TYPE,
  DASHBOARD_GRID_TYPE,
} from 'src/dashboard/util/componentTypes';
import { screen, render, userEvent } from 'spec/helpers/testing-library';
import Divider, { DividerProps } from './Divider';

// eslint-disable-next-line no-restricted-globals -- TODO: migrate from describe blocks
describe('Divider', () => {
  const baseProps: DividerProps = {
    id: 'id',
    parentId: 'parentId',
    component: newComponentFactory(DIVIDER_TYPE),
    depth: 1,
    parentComponent: newComponentFactory(DASHBOARD_GRID_TYPE),
    index: 0,
    editMode: false,
    handleComponentDrop: jest.fn(),
    deleteComponent: (id: string, parentId: string) => {},
  };

  const setup = (overrideProps: Partial<DividerProps> = {}) =>
    render(<Divider {...baseProps} {...overrideProps} />, {
      useDnd: true,
    });

  test('should render a Draggable', () => {
    setup();
    expect(screen.getByTestId('dragdroppable-object')).toBeInTheDocument();
  });

  test('should render a div with class "dashboard-component-divider"', () => {
    const { container } = setup();
    expect(
      container.querySelector('.dashboard-component-divider'),
    ).toBeInTheDocument();
  });

  test('should render a HoverMenu with DeleteComponentButton in editMode', () => {
    setup();
    expect(screen.queryByTestId('hover-menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    setup({ editMode: true });
    expect(screen.getByTestId('hover-menu')).toBeInTheDocument();
    expect(screen.getByRole('button').firstChild).toHaveAttribute(
      'aria-label',
      'delete',
    );
  });

  test('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    setup({ editMode: true, deleteComponent });
    userEvent.click(screen.getByRole('button'));
    expect(deleteComponent.callCount).toBe(1);
  });
});
