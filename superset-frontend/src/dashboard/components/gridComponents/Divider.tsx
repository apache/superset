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
    padding: ${theme.sizeUnit * 2}px 0; /* this is padding not margin to enable a larger mouse target */
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
      padding-left: ${theme.sizeUnit * 4}px;
      padding-right: ${theme.sizeUnit * 4}px;
    }
  `}
`;

class Divider extends PureComponent {
  constructor(props: $TSFixMe) {
    super(props);
    this.handleDeleteComponent = this.handleDeleteComponent.bind(this);
  }

  handleDeleteComponent() {
    // @ts-expect-error TS(2339): Property 'deleteComponent' does not exist on type ... Remove this comment to see the full error message
    const { deleteComponent, id, parentId } = this.props;
    deleteComponent(id, parentId);
  }

  render() {
    const {
      // @ts-expect-error TS(2339): Property 'component' does not exist on type 'Reado... Remove this comment to see the full error message
      component,
      // @ts-expect-error TS(2339): Property 'depth' does not exist on type 'Readonly<... Remove this comment to see the full error message
      depth,
      // @ts-expect-error TS(2339): Property 'parentComponent' does not exist on type ... Remove this comment to see the full error message
      parentComponent,
      // @ts-expect-error TS(2339): Property 'index' does not exist on type 'Readonly<... Remove this comment to see the full error message
      index,
      // @ts-expect-error TS(2339): Property 'handleComponentDrop' does not exist on t... Remove this comment to see the full error message
      handleComponentDrop,
      // @ts-expect-error TS(2339): Property 'editMode' does not exist on type 'Readon... Remove this comment to see the full error message
      editMode,
    } = this.props;

    return (
      <Draggable
        // @ts-expect-error TS(2322): Type '{ children: ({ dragSourceRef }: any) => Elem... Remove this comment to see the full error message
        component={component}
        parentComponent={parentComponent}
        orientation="row"
        index={index}
        depth={depth}
        onDrop={handleComponentDrop}
        editMode={editMode}
      >
        {({ dragSourceRef }: $TSFixMe) => (
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

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
Divider.propTypes = propTypes;

export default Divider;
