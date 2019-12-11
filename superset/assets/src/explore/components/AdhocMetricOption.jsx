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
import { Label, OverlayTrigger } from 'react-bootstrap';

import AdhocMetricEditPopover from './AdhocMetricEditPopover';
import AdhocMetric from '../AdhocMetric';
import columnType from '../propTypes/columnType';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric),
  onMetricEdit: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(columnType),
  multi: PropTypes.bool,
  datasourceType: PropTypes.string,
};

export default class AdhocMetricOption extends React.PureComponent {
  constructor(props) {
    super(props);
    this.closeMetricEditOverlay = this.closeMetricEditOverlay.bind(this);
    this.onOverlayEntered = this.onOverlayEntered.bind(this);
    this.onOverlayExited = this.onOverlayExited.bind(this);
    this.onPopoverResize = this.onPopoverResize.bind(this);
    this.state = { overlayShown: false };
  }

  onPopoverResize() {
    this.forceUpdate();
  }

  onOverlayEntered() {
    this.setState({ overlayShown: false });
  }

  onOverlayExited() {
    this.setState({ overlayShown: false });
  }

  closeMetricEditOverlay() {
    this.refs.overlay.hide();
  }

  render() {
    const { adhocMetric } = this.props;
    const overlay = (
      <AdhocMetricEditPopover
        onResize={this.onPopoverResize}
        adhocMetric={adhocMetric}
        onChange={this.props.onMetricEdit}
        onClose={this.closeMetricEditOverlay}
        columns={this.props.columns}
        datasourceType={this.props.datasourceType}
      />
    );

    return (
      <OverlayTrigger
        ref="overlay"
        placement="right"
        trigger="click"
        disabled
        overlay={overlay}
        rootClose
        shouldUpdatePosition
        defaultOverlayShown={!adhocMetric.fromFormData}
        onEntered={this.onOverlayEntered}
        onExited={this.onOverlayExited}
      >
        <Label style={{ margin: this.props.multi ? 0 : 3, cursor: 'pointer' }}>
          <div
            onMouseDownCapture={e => {
              e.stopPropagation();
            }}
          >
            <span className="m-r-5 option-label">
              {adhocMetric.label}
              <i
                className={`glyphicon glyphicon-triangle-${
                  this.state.overlayShown ? 'left' : 'right'
                } adhoc-label-arrow`}
              />
            </span>
          </div>
        </Label>
      </OverlayTrigger>
    );
  }
}
AdhocMetricOption.propTypes = propTypes;
