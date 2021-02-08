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

const propTypes = {
  position: PropTypes.oneOf(['left', 'top']),
  innerRef: PropTypes.func,
  dotCount: PropTypes.number,
};

const defaultProps = {
  position: 'left',
  innerRef: null,
  dotCount: 8,
};

export default class DragHandle extends React.PureComponent {
  render() {
    const { innerRef, position, dotCount } = this.props;
    return (
      <div
        ref={innerRef}
        className={cx(
          'drag-handle',
          position === 'left' && 'drag-handle--left',
          position === 'top' && 'drag-handle--top',
        )}
      >
        {Array(dotCount)
          .fill(null)
          .map((_, i) => (
            <div key={`handle-dot-${i}`} className="drag-handle-dot" />
          ))}
      </div>
    );
  }
}

DragHandle.propTypes = propTypes;
DragHandle.defaultProps = defaultProps;
