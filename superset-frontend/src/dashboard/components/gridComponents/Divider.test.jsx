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
import sinon from 'sinon';

import Divider from 'src/dashboard/components/gridComponents/Divider';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  DIVIDER_TYPE,
  DASHBOARD_GRID_TYPE,
} from 'src/dashboard/util/componentTypes';
import { screen, render, userEvent } from 'spec/helpers/testing-library';

describe('Divider', () => {
  const props = {
    id: 'id',
    parentId: 'parentId',
    component: newComponentFactory(DIVIDER_TYPE),
    depth: 1,
    parentComponent: newComponentFactory(DASHBOARD_GRID_TYPE),
    index: 0,
    editMode: false,
    handleComponentDrop() {},
    deleteComponent() {},
  };

  const setup = overrideProps =>
    // We have to wrap provide DragDropContext for the underlying DragDroppable
    // otherwise we cannot assert on DragDroppable children
    render(<Divider {...props} {...overrideProps} />, {
      useDnd: true,
    });

  it('should render a Draggable', () => {
    setup();
    expect(screen.getByTestId('dragdroppable-object')).toBeInTheDocument();
  });

  it('should render a div with class "dashboard-component-divider"', () => {
    const { container } = setup();
    expect(
      container.querySelector('.dashboard-component-divider'),
    ).toBeInTheDocument();
  });

  it('should render a HoverMenu with DeleteComponentButton in editMode', () => {
    setup();
    expect(screen.queryByTestId('hover-menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    // we cannot set props on the Divider because of the WithDragDropContext wrapper
    setup({ editMode: true });
    expect(screen.getByTestId('hover-menu')).toBeInTheDocument();
    expect(screen.getByRole('button').firstChild).toHaveAttribute(
      'aria-label',
      'trash',
    );
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    setup({ editMode: true, deleteComponent });
    userEvent.click(screen.getByRole('button'));
    expect(deleteComponent.callCount).toBe(1);
  });
});
