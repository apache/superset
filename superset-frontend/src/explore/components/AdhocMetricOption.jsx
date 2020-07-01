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
import { thresholdScott } from 'd3-array';

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
    this.overlay = null;
  }

  onPopoverResize() {
    this.forceUpdate();
  }

  onOverlayEntered() {
    // isNew is used to indicate whether to automatically open the overlay
    // once the overlay has been opened, the metric/filter will never be
    // considered new again.
    this.props.adhocMetric.isNew = false;
    this.setState({ overlayShown: true });
  }

  onOverlayExited() {
    this.setState({ overlayShown: false });
  }

  closeMetricEditOverlay() {
    this.overlay.hide();
  }

  render() {
    const { adhocMetric } = this.props;
    const overlayContent = (
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
      <div
        className="metric-option"
        onMouseDownCapture={e => e.stopPropagation()}
      >
        <OverlayTrigger
          ref={ref => {
            this.overlay = ref;
          }}
          placement="right"
          trigger="click"
          disabled
          overlay={overlayContent}
          rootClose
          shouldUpdatePosition
          defaultOverlayShown={adhocMetric.isNew}
          onEntered={this.onOverlayEntered}
          onExited={this.onOverlayExited}
        >
          <Label className="option-label adhoc-option">
            {adhocMetric.label}
            <i
              className={`fa fa-caret-${
                this.state.overlayShown ? 'left' : 'right'
              } adhoc-label-arrow`}
            />
          </Label>
        </OverlayTrigger>
      </div>
    );
  }
}
AdhocMetricOption.propTypes = propTypes;
