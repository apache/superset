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
import cx from 'classnames';
import { css, styled } from '@superset-ui/core';

import { DragDroppable } from 'src/dashboard/components/dnd/DragDroppable';
import { NEW_COMPONENTS_SOURCE_ID } from 'src/dashboard/util/constants';
import { NEW_COMPONENT_SOURCE_TYPE } from 'src/dashboard/util/componentTypes';

const propTypes = {
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  className: PropTypes.string,
};

const defaultProps = {
  className: null,
};

const NewComponent = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    padding: ${theme.gridUnit * 4}px;
    background: ${theme.colors.grayscale.light5};
    cursor: move;

    &:not(.static):hover {
      background: ${theme.colors.grayscale.light4};
    }
  `}
`;

const NewComponentPlaceholder = styled.div`
  ${({ theme }) => css`
    position: relative;
    background: ${theme.colors.grayscale.light4};
    width: ${theme.gridUnit * 10}px;
    height: ${theme.gridUnit * 10}px;
    margin-right: ${theme.gridUnit * 4}px;
    border: 1px solid ${theme.colors.grayscale.light5};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${theme.colors.text.label};
    font-size: ${theme.typography.sizes.xxl}px;

    &.fa-window-restore {
      font-size: ${theme.typography.sizes.l}px;
    }

    &.fa-area-chart {
      font-size: ${theme.typography.sizes.xl}px;
    }

    &.divider-placeholder:after {
      content: '';
      height: 2px;
      width: 100%;
      background-color: ${theme.colors.grayscale.light2};
    }
  `}
`;

export default class DraggableNewComponent extends PureComponent {
  render() {
    const { label, id, type, className, meta } = this.props;
    return (
      <DragDroppable
        component={{ type, id, meta }}
        parentComponent={{
          id: NEW_COMPONENTS_SOURCE_ID,
          type: NEW_COMPONENT_SOURCE_TYPE,
        }}
        index={0}
        depth={0}
        editMode
      >
        {({ dragSourceRef }) => (
          <NewComponent ref={dragSourceRef} data-test="new-component">
            <NewComponentPlaceholder
              className={cx('new-component-placeholder', className)}
            />
            {label}
          </NewComponent>
        )}
      </DragDroppable>
    );
  }
}

DraggableNewComponent.propTypes = propTypes;
DraggableNewComponent.defaultProps = defaultProps;
