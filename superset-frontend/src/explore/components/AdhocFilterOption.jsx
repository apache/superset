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
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

import Popover from 'src/common/components/Popover';
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
    this.onPopoverResize = this.onPopoverResize.bind(this);
    this.closePopover = this.closePopover.bind(this);
    this.togglePopover = this.togglePopover.bind(this);
    this.state = {
      // automatically open the popover the the metric is new
      popoverVisible: !!props.adhocFilter.isNew,
    };
  }

  componentDidMount() {
    const { adhocFilter } = this.props;
    // isNew is used to auto-open the popup. Once popup is opened, it's not
    // considered new anymore.
    // put behind setTimeout so in case consequetive re-renderings are triggered
    // for some reason, the popup can still show up.
    setTimeout(() => {
      adhocFilter.isNew = false;
    });
  }

  onPopoverResize() {
    this.forceUpdate();
  }

  closePopover() {
    this.setState({ popoverVisible: false });
  }

  togglePopover(visible) {
    this.setState(({ popoverVisible }) => {
      return {
        popoverVisible: visible === undefined ? !popoverVisible : visible,
      };
    });
  }

  render() {
    const { adhocFilter } = this.props;
    const overlayContent = (
      <AdhocFilterEditPopover
        adhocFilter={adhocFilter}
        options={this.props.options}
        datasource={this.props.datasource}
        partitionColumn={this.props.partitionColumn}
        onResize={this.onPopoverResize}
        onClose={this.closePopover}
        onChange={this.props.onFilterEdit}
      />
    );

    return (
      <div
        role="button"
        tabIndex={0}
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
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
        <Popover
          placement="right"
          trigger="click"
          content={overlayContent}
          defaultVisible={adhocFilter.isNew}
          visible={this.state.popoverVisible}
          onVisibleChange={this.togglePopover}
        >
          <Label className="option-label adhoc-option adhoc-filter-option">
            {adhocFilter.getDefaultLabel()}
            <i className="fa fa-caret-right adhoc-label-arrow" />
          </Label>
        </Popover>
      </div>
    );
  }
}

export default AdhocFilterOption;

AdhocFilterOption.propTypes = propTypes;
