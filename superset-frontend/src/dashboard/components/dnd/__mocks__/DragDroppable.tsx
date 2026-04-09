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
import { type ReactNode } from 'react';
import cx from 'classnames';

function MockDraggable(props: Record<string, unknown>) {
  const { editMode, orientation, children, disableDragDrop } = props as {
    editMode?: boolean;
    orientation?: 'row' | 'column';
    disableDragDrop?: boolean;
    children: (childProps: Record<string, unknown>) => ReactNode;
  };
  const childProps = editMode
    ? {
        dragSourceRef: jest.fn(),
        dropIndicatorProps: null,
        draggingTabOnTab: false,
        'data-test': 'dragdroppable-content',
      }
    : {
        dropIndicatorProps: null,
        'data-test': 'dragdroppable-content',
      };
  return (
    <div
      data-test="dragdroppable-object"
      data-disable-drag-drop={String(!!disableDragDrop)}
      className={cx(
        'dragdroppable',
        editMode && 'dragdroppable--edit-mode',
        orientation === 'row' && 'dragdroppable-row',
        orientation === 'column' && 'dragdroppable-column',
      )}
    >
      {children(childProps)}
    </div>
  );
}

export { MockDraggable as Draggable };
