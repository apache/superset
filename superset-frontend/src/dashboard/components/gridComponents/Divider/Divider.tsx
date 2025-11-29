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

import { PureComponent } from 'react';
import { css, styled } from '@apache-superset/core/ui';

import { Draggable } from '../../dnd/DragDroppable';
import HoverMenu from '../../menu/HoverMenu';
import DeleteComponentButton from '../../DeleteComponentButton';
import type { ConnectDragSource } from 'react-dnd';

export interface DashboardComponent {
  id: string;
  type: string;             // or more specific union
  parents?: string[];
  children?: string[];
  meta?: {
    width?: number;
    height?: number;
    headerSize?: string;
    background?: string;
    chartId?: number;
  };
}


export interface DividerProps {
  id: string;
  parentId: string;
  component: DashboardComponent;
  depth: number;
  parentComponent: DashboardComponent;
  index: number;
  editMode: boolean;
  handleComponentDrop: (dropResult: unknown) => void; 
  deleteComponent: (id: string, parentId: string) => void;
}

const DividerLine = styled.div`
  ${({ theme }) => css`
    width: 100%;
    padding: ${theme.sizeUnit * 2}px 0;
    background-color: transparent;

    &:after {
      content: '';
      height: 1px;
      width: 100%;
      background-color: ${theme.colorSplit};
      display: block;
    }

    div[draggable='true'] & {
      cursor: move;
    }

    .dashboard-component-tabs & {
      padding-left: ${theme.sizeUnit * 4}px;
      padding-right: ${theme.sizeUnit * 4}px;
    }
  `}
`;


class Divider extends PureComponent<DividerProps> {
  constructor(props: DividerProps) {
    super(props);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
  }

  handleDeleteComponent() {
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  render() {
    const {
      component,
      depth,
      parentComponent,
      index,
      handleComponentDrop,
      editMode,
    } = this.props;

    return (
      <Draggable
        component={component}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        editMode={editMode}
      >
        {({ dragSourceRef }: { dragSourceRef: ConnectDragSource }) => (
          <div ref={dragSourceRef}>
            {editMode && (
              <HoverMenu position="left">
                <DeleteComponentButton onDelete={this.handleDeleteComponent} />
              </HoverMenu>
            )}
            <DividerLine className="dashboard-component dashboard-component-divider" />
          </div>
        )}
      </Draggable>
    );
  }
}

export default Divider;
