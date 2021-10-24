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
import PropTypes from 'prop-types';
import cx from 'classnames';

import DragDroppable from '../../dnd/DragDroppable';
import { NEW_COMPONENTS_SOURCE_ID } from '../../../util/constants';
import { NEW_COMPONENT_SOURCE_TYPE } from '../../../util/componentTypes';

const propTypes = {
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  className: PropTypes.string,
};

const defaultProps = {
  className: null,
};

export default class DraggableNewComponent extends React.PureComponent {
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
          <div
            ref={dragSourceRef}
            className="new-component"
            data-test="new-component"
          >
            <div className={cx('new-component-placeholder', className)} />
            {label}
          </div>
        )}
      </DragDroppable>
    );
  }
}

DraggableNewComponent.propTypes = propTypes;
DraggableNewComponent.defaultProps = defaultProps;
