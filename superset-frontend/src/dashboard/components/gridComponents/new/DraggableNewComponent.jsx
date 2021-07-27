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

const DRAGGABLE_PARENT_COMPONENT = {
  id: NEW_COMPONENTS_SOURCE_ID,
  type: NEW_COMPONENT_SOURCE_TYPE,
};

export default class DraggableNewComponent extends React.PureComponent {
  constructor(props) {
    super(props);
    this.renderDraggableContent = this.renderDraggableContent.bind(this);

    this.state = {
      component: { id: props.id, type: props.type },
    };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (
      nextProps.id !== prevState.component.id ||
      nextProps.type !== prevState.component.type
    ) {
      return {
        component: { id: nextProps.id, type: nextProps.type },
      };
    }
    return null;
  }

  renderDraggableContent({ dragSourceRef }) {
    const { label, className } = this.props;
    return (
      <div
        ref={dragSourceRef}
        className="new-component"
        data-test="new-component"
      >
        <div className={cx('new-component-placeholder', className)} />
        {label}
      </div>
    );
  }

  render() {
    return (
      <DragDroppable
        component={this.state.component}
        parentComponent={DRAGGABLE_PARENT_COMPONENT}
        index={0}
        depth={0}
        editMode
      >
        {this.renderDraggableContent}
      </DragDroppable>
    );
  }
}

DraggableNewComponent.propTypes = propTypes;
DraggableNewComponent.defaultProps = defaultProps;
