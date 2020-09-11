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
import { OverlayTrigger } from 'react-bootstrap';
import { t, withTheme } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

import Label from 'src/components/Label';
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
  partitionColumn: PropTypes.string,
};
class AdhocFilterOption extends React.PureComponent {
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
    // isNew is used to indicate whether to automatically open the overlay
    // once the overlay has been opened, the metric/filter will never be
    // considered new again.
    this.props.adhocFilter.isNew = false;
    this.setState({ overlayShown: true });
  }

  onOverlayExited() {
    this.setState({ overlayShown: false });
  }

  closeFilterEditOverlay() {
    this.refs.overlay.hide();
  }

  render() {
    const { adhocFilter, theme } = this.props;
    const overlay = (
      <AdhocFilterEditPopover
        onResize={this.onPopoverResize}
        adhocFilter={adhocFilter}
        onChange={this.props.onFilterEdit}
        onClose={this.closeFilterEditOverlay}
        options={this.props.options}
        datasource={this.props.datasource}
        partitionColumn={this.props.partitionColumn}
        theme={theme}
      />
    );
    return (
      <div onMouseDownCapture={e => e.stopPropagation()}>
        {adhocFilter.isExtra && (
          <InfoTooltipWithTrigger
            icon="exclamation-triangle"
            placement="top"
            className="m-r-5 text-muted"
            tooltip={t(`
                This filter was inherited from the dashboard's context.
                It won't be saved when saving the chart.
              `)}
          />
        )}
        <OverlayTrigger
          ref="overlay"
          placement="right"
          trigger="click"
          disabled
          overlay={overlay}
          rootClose
          shouldUpdatePosition
          defaultOverlayShown={adhocFilter.isNew}
          onEntered={this.onOverlayEntered}
          onExited={this.onOverlayExited}
        >
          <Label className="option-label adhoc-option adhoc-filter-option">
            {adhocFilter.getDefaultLabel()}
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

export default withTheme(AdhocFilterOption);

AdhocFilterOption.propTypes = propTypes;
