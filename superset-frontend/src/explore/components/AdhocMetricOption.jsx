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
import { withTheme } from '@superset-ui/core';

import Popover from 'src/common/components/Popover';
import Label from 'src/components/Label';
import AdhocMetricEditPopoverTitle from 'src/explore/components/AdhocMetricEditPopoverTitle';
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

class AdhocMetricOption extends React.PureComponent {
  constructor(props) {
    super(props);
    this.closeMetricEditOverlay = this.closeMetricEditOverlay.bind(this);
    this.onOverlayEntered = this.onOverlayEntered.bind(this);
    this.onPopoverResize = this.onPopoverResize.bind(this);
    this.handleVisibleChange = this.handleVisibleChange.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.state = {
      overlayShown: false,
      title: {
        label: props.adhocMetric.label,
        hasCustomLabel: props.adhocMetric.hasCustomLabel,
      },
    };
  }

  onLabelChange(e) {
    const label = e.target.value;
    this.setState({
      title: {
        label,
        hasCustomLabel: true,
      },
    });
  }

  onPopoverResize() {
    this.forceUpdate();
  }

  onOverlayEntered() {
    // isNew is used to indicate whether to automatically open the overlay
    // once the overlay has been opened, the metric/filter will never be
    // considered new again.
    this.props.adhocMetric.isNew = false;
    this.setState({
      overlayShown: true,
      title: {
        label: this.props.adhocMetric.label,
        hasCustomLabel: this.props.adhocMetric.hasCustomLabel,
      },
    });
  }

  closeMetricEditOverlay() {
    this.setState({ overlayShown: false });
  }

  handleVisibleChange(visible) {
    if (visible) {
      this.onOverlayEntered();
    } else {
      this.closeMetricEditOverlay();
    }
  }

  render() {
    const { adhocMetric } = this.props;
    const overlayContent = (
      <AdhocMetricEditPopover
        onResize={this.onPopoverResize}
        adhocMetric={adhocMetric}
        title={this.state.title}
        onChange={this.props.onMetricEdit}
        onClose={this.closeMetricEditOverlay}
        columns={this.props.columns}
        datasourceType={this.props.datasourceType}
      />
    );

    const popoverTitle = (
      <AdhocMetricEditPopoverTitle
        title={this.state.title}
        defaultLabel={adhocMetric.label}
        onChange={this.onLabelChange}
      />
    );

    return (
      <div
        className="metric-option"
        data-test="metric-option"
        role="button"
        tabIndex={0}
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <Popover
          placement="right"
          trigger="click"
          disabled
          content={overlayContent}
          defaultVisible={adhocMetric.isNew}
          onVisibleChange={this.handleVisibleChange}
          visible={this.state.overlayShown}
          title={popoverTitle}
        >
          <Label className="option-label adhoc-option" data-test="option-label">
            {adhocMetric.label}
            <i
              className={`fa fa-caret-${
                this.state.overlayShown ? 'left' : 'right'
              } adhoc-label-arrow`}
            />
          </Label>
        </Popover>
      </div>
    );
  }
}

export default withTheme(AdhocMetricOption);

AdhocMetricOption.propTypes = propTypes;
