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
import PropTypes from 'prop-types';
import { css, styled } from '@superset-ui/core';

import { Draggable } from '../dnd/DragDroppable';
import HoverMenu from '../menu/HoverMenu';
import DeleteComponentButton from '../DeleteComponentButton';
import { componentShape } from '../../util/propShapes';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  depth: PropTypes.number.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  deleteComponent: PropTypes.func.isRequired,
};

const DividerLine = styled.div`
  ${({ theme }) => css`
    width: 100%;
    padding: ${theme.gridUnit * 2}px 0; /* this is padding not margin to enable a larger mouse target */
    background-color: transparent;

    &:after {
      content: '';
      height: 1px;
      width: 100%;
      background-color: ${theme.colors.grayscale.light2};
      display: block;
    }

    div[draggable='true'] & {
      cursor: move;
    }

    .dashboard-component-tabs & {
      padding-left: ${theme.gridUnit * 4}px;
      padding-right: ${theme.gridUnit * 4}px;
    }
  `}
`;

class Divider extends PureComponent {
  constructor(props) {
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
        {({ dragSourceRef }) => (
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

Divider.propTypes = propTypes;

export default Divider;
