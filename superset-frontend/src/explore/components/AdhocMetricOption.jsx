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
    this.onPopoverResize = this.onPopoverResize.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.openPopover = this.openPopover.bind(this);
    this.closePopover = this.closePopover.bind(this);
    this.togglePopover = this.togglePopover.bind(this);
    this.state = {
      popoverVisible: undefined,
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

  openPopover() {
    this.setState({ popoverVisible: false });
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
    const { adhocMetric } = this.props;
    const { isNew } = adhocMetric;
    if (isNew) {
      // new metrics automaticall open the popover
      // once the metric is rendered, then it's not new.
      // testing this by selecting multiple new columns to create multiple
      // new adhoc metrics
      adhocMetric.isNew = false;
    }

    const overlayContent = (
      <AdhocMetricEditPopover
        adhocMetric={adhocMetric}
        title={this.state.title}
        columns={this.props.columns}
        datasourceType={this.props.datasourceType}
        onResize={this.onPopoverResize}
        onChange={this.props.onMetricEdit}
        onClose={this.closePopover}
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
          defaultVisible={isNew}
          visible={this.state.popoverVisible}
          onVisibleChange={this.togglePopover}
          title={popoverTitle}
        >
          <Label className="option-label adhoc-option" data-test="option-label">
            {adhocMetric.label}
            <i className="fa fa-caret-right adhoc-label-arrow" />
          </Label>
        </Popover>
      </div>
    );
  }
}

export default AdhocMetricOption;

AdhocMetricOption.propTypes = propTypes;
