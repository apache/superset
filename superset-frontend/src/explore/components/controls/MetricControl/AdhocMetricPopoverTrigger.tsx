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
import { Metric } from '@superset-ui/core';
import Popover from 'src/common/components/Popover';
import AdhocMetricEditPopoverTitle from 'src/explore/components/controls/MetricControl/AdhocMetricEditPopoverTitle';
import AdhocMetricEditPopover, {
  SAVED_TAB_KEY,
} from './AdhocMetricEditPopover';
import AdhocMetric from './AdhocMetric';
import { savedMetricType } from './types';

export type AdhocMetricPopoverTriggerProps = {
  adhocMetric: AdhocMetric;
  onMetricEdit(newMetric: Metric, oldMetric: Metric): void;
  columns: { column_name: string; type: string }[];
  savedMetricsOptions: savedMetricType[];
  savedMetric: savedMetricType;
  datasourceType: string;
  children: ReactNode;
  createNew?: boolean;
};

export type AdhocMetricPopoverTriggerState = {
  popoverVisible: boolean;
  title: { label: string; hasCustomLabel: boolean };
  currentLabel: string;
  labelModified: boolean;
  isTitleEditDisabled: boolean;
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
    this.getCurrentTab = this.getCurrentTab.bind(this);
    this.getCurrentLabel = this.getCurrentLabel.bind(this);
    this.onChange = this.onChange.bind(this);

    this.state = {
      popoverVisible: false,
      title: {
        label: props.adhocMetric.label,
        hasCustomLabel: props.adhocMetric.hasCustomLabel,
      },
      currentLabel: '',
      labelModified: false,
      isTitleEditDisabled: false,
    };
  }

  onLabelChange(e: any) {
    const { verbose_name, metric_name } = this.props.savedMetric;
    const defaultMetricLabel = this.props.adhocMetric?.getDefaultLabel();
    const label = e.target.value;
    this.setState(state => ({
      title: {
        label:
          label ||
          state.currentLabel ||
          verbose_name ||
          metric_name ||
          defaultMetricLabel,
        hasCustomLabel: !!label,
      },
      labelModified: true,
    }));
  }

  onPopoverResize() {
    this.forceUpdate();
  }

  closePopover() {
    this.togglePopover(false);
    this.setState({
      labelModified: false,
    });
  }

  togglePopover(visible: boolean) {
    this.setState({
      popoverVisible: visible,
    });
  }

  getCurrentTab(tab: string) {
    this.setState({
      isTitleEditDisabled: tab === SAVED_TAB_KEY,
    });
  }

  getCurrentLabel({
    savedMetricLabel,
    adhocMetricLabel,
  }: {
    savedMetricLabel: string;
    adhocMetricLabel: string;
  }) {
    const currentLabel = savedMetricLabel || adhocMetricLabel;
    this.setState({
      currentLabel,
      labelModified: true,
    });
    if (savedMetricLabel || !this.state.title.hasCustomLabel) {
      this.setState({
        title: {
          label: currentLabel,
          hasCustomLabel: false,
        },
      });
    }
  }

  onChange(newMetric: Metric, oldMetric: Metric) {
    this.props.onMetricEdit({ ...newMetric, ...this.state.title }, oldMetric);
  }

  render() {
    const { adhocMetric, savedMetric } = this.props;
    const { verbose_name, metric_name } = savedMetric;
    const { hasCustomLabel, label } = adhocMetric;
    const adhocMetricLabel = hasCustomLabel
      ? label
      : adhocMetric.getDefaultLabel();
    const title = this.state.labelModified
      ? this.state.title
      : {
          label: verbose_name || metric_name || adhocMetricLabel,
          hasCustomLabel,
        };

    const overlayContent = (
      <AdhocMetricEditPopover
        adhocMetric={adhocMetric}
        title={title}
        columns={this.props.columns}
        savedMetricsOptions={this.props.savedMetricsOptions}
        savedMetric={this.props.savedMetric}
        datasourceType={this.props.datasourceType}
        onResize={this.onPopoverResize}
        onClose={this.closePopover}
        onChange={this.onChange}
        getCurrentTab={this.getCurrentTab}
        getCurrentLabel={this.getCurrentLabel}
      />
    );

    const popoverTitle = (
      <AdhocMetricEditPopoverTitle
        title={title}
        onChange={this.onLabelChange}
        isEditDisabled={this.state.isTitleEditDisabled}
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
