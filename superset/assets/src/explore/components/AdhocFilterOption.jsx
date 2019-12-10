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

import AdhocFilterEditPopover from './AdhocFilterEditPopover';
import AdhocFilter from '../AdhocFilter';
import columnType from '../propTypes/columnType';
import adhocMetricType from '../propTypes/adhocMetricType';

const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onFilterEdit: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      columnType,
      PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
      adhocMetricType,
    ]),
  ).isRequired,
  datasource: PropTypes.object,
};

export default class AdhocFilterOption extends React.PureComponent {
  constructor(props) {
    super(props);
    this.closeFilterEditOverlay = this.closeFilterEditOverlay.bind(this);
    this.onPopoverResize = this.onPopoverResize.bind(this);
    this.onOverlayEntered = this.onOverlayEntered.bind(this);
    this.onOverlayExited = this.onOverlayExited.bind(this);
    this.state = { overlayShown: false };
  }

  onPopoverResize() {
    this.forceUpdate();
  }

  onOverlayEntered() {
    this.setState({ overlayShown: true });
  }

  onOverlayExited() {
    this.setState({ overlayShown: false });
  }

  onMouseDown(e) {
    e.stopPropagation();
  }

  closeFilterEditOverlay() {
    this.refs.overlay.hide();
  }

  render() {
    const { adhocFilter } = this.props;
    const overlay = (
      <AdhocFilterEditPopover
        onResize={this.onPopoverResize}
        adhocFilter={adhocFilter}
        onChange={this.props.onFilterEdit}
        onClose={this.closeFilterEditOverlay}
        options={this.props.options}
        datasource={this.props.datasource}
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
        onEntered={this.onOverlayEntered}
        onExited={this.onOverlayExited}
      >
        <Label className="adhoc-filter-option">
          <div onMouseDownCapture={this.onMouseDown}>
            <span className="m-r-5 option-label">
              {adhocFilter.getDefaultLabel()}
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
AdhocFilterOption.propTypes = propTypes;
