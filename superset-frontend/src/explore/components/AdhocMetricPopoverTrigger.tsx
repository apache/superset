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
import React, { ReactNode } from 'react';
import Popover from 'src/common/components/Popover';
import AdhocMetricEditPopoverTitle from 'src/explore/components/AdhocMetricEditPopoverTitle';
import AdhocMetricEditPopover from './AdhocMetricEditPopover';
import AdhocMetric from '../AdhocMetric';
import { savedMetricType } from '../types';

export type AdhocMetricPopoverTriggerProps = {
  adhocMetric: AdhocMetric;
  onMetricEdit: () => void;
  columns: { column_name: string; type: string }[];
  savedMetrics: savedMetricType[];
  savedMetric: savedMetricType;
  datasourceType: string;
  children: ReactNode;
  createNew?: boolean;
};

export type AdhocMetricPopoverTriggerState = {
  popoverVisible: boolean;
  title: { label: string; hasCustomLabel: boolean };
};

class AdhocMetricPopoverTrigger extends React.PureComponent<
  AdhocMetricPopoverTriggerProps,
  AdhocMetricPopoverTriggerState
> {
  constructor(props: AdhocMetricPopoverTriggerProps) {
    super(props);
    this.onPopoverResize = this.onPopoverResize.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.closePopover = this.closePopover.bind(this);
    this.togglePopover = this.togglePopover.bind(this);
    this.state = {
      popoverVisible: false,
      title: {
        label: props.adhocMetric.label,
        hasCustomLabel: props.adhocMetric.hasCustomLabel,
      },
    };
  }

  onLabelChange(e: any) {
    const label = e.target.value;
    this.setState({
      title: {
        label: label || this.props.adhocMetric.label,
        hasCustomLabel: !!label,
      },
    });
  }

  onPopoverResize() {
    this.forceUpdate();
  }

  closePopover() {
    this.togglePopover(false);
  }

  togglePopover(visible: boolean) {
    this.setState({
      popoverVisible: visible,
    });
  }

  render() {
    const { adhocMetric } = this.props;

    const overlayContent = (
      <AdhocMetricEditPopover
        adhocMetric={adhocMetric}
        title={this.state.title}
        columns={this.props.columns}
        savedMetrics={this.props.savedMetrics}
        savedMetric={this.props.savedMetric}
        datasourceType={this.props.datasourceType}
        onResize={this.onPopoverResize}
        onClose={this.closePopover}
        onChange={this.props.onMetricEdit}
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
      <Popover
        placement="right"
        trigger="click"
        content={overlayContent}
        defaultVisible={this.state.popoverVisible}
        visible={this.state.popoverVisible}
        onVisibleChange={this.togglePopover}
        title={popoverTitle}
        destroyTooltipOnHide={this.props.createNew}
      >
        {this.props.children}
      </Popover>
    );
  }
}

export default AdhocMetricPopoverTrigger;
