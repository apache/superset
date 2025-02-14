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
import { PureComponent, ReactNode } from 'react';
import { Metric, t } from '@superset-ui/core';
import AdhocMetricEditPopoverTitle from 'src/explore/components/controls/MetricControl/AdhocMetricEditPopoverTitle';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import {
  ISaveableDatasource,
  SaveDatasetModal,
} from 'src/SqlLab/components/SaveDatasetModal';
import { Datasource } from 'src/explore/types';
import AdhocMetricEditPopover, {
  SAVED_TAB_KEY,
} from './AdhocMetricEditPopover';
import AdhocMetric from './AdhocMetric';
import { savedMetricType } from './types';
import ControlPopover from '../ControlPopover/ControlPopover';

export type AdhocMetricPopoverTriggerProps = {
  adhocMetric: AdhocMetric;
  onMetricEdit(newMetric: Metric, oldMetric: Metric): void;
  columns: { column_name: string; type: string }[];
  savedMetricsOptions: savedMetricType[];
  savedMetric: savedMetricType;
  datasource: Datasource & ISaveableDatasource;
  children: ReactNode;
  isControlledComponent?: boolean;
  visible?: boolean;
  togglePopover?: (visible: boolean) => void;
  closePopover?: () => void;
  isNew?: boolean;
};

export type AdhocMetricPopoverTriggerState = {
  adhocMetric: AdhocMetric;
  popoverVisible: boolean;
  title: { label: string; hasCustomLabel: boolean };
  currentLabel: string;
  labelModified: boolean;
  isTitleEditDisabled: boolean;
  showSaveDatasetModal: boolean;
};

class AdhocMetricPopoverTrigger extends PureComponent<
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
    this.handleDatasetModal = this.handleDatasetModal.bind(this);

    this.state = {
      adhocMetric: props.adhocMetric,
      popoverVisible: false,
      title: {
        label: props.adhocMetric.label,
        hasCustomLabel: props.adhocMetric.hasCustomLabel,
      },
      currentLabel: '',
      labelModified: false,
      isTitleEditDisabled: false,
      showSaveDatasetModal: false,
    };
  }

  static getDerivedStateFromProps(
    nextProps: AdhocMetricPopoverTriggerProps,
    prevState: AdhocMetricPopoverTriggerState,
  ) {
    if (prevState.adhocMetric.optionName !== nextProps.adhocMetric.optionName) {
      return {
        adhocMetric: nextProps.adhocMetric,
        title: {
          label: nextProps.adhocMetric.label,
          hasCustomLabel: nextProps.adhocMetric.hasCustomLabel,
        },
        currentLabel: '',
        labelModified: false,
      };
    }
    return {
      adhocMetric: nextProps.adhocMetric,
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

  handleDatasetModal(showModal: boolean) {
    this.setState({ showSaveDatasetModal: showModal });
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
    const {
      adhocMetric,
      savedMetric,
      columns,
      savedMetricsOptions,
      datasource,
      isControlledComponent,
    } = this.props;
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

    const { visible, togglePopover, closePopover } = isControlledComponent
      ? {
          visible: this.props.visible,
          togglePopover: this.props.togglePopover,
          closePopover: this.props.closePopover,
        }
      : {
          visible: this.state.popoverVisible,
          togglePopover: this.togglePopover,
          closePopover: this.closePopover,
        };

    const overlayContent = (
      <ExplorePopoverContent>
        <AdhocMetricEditPopover
          adhocMetric={adhocMetric}
          columns={columns}
          savedMetricsOptions={savedMetricsOptions}
          savedMetric={savedMetric}
          datasource={datasource}
          handleDatasetModal={this.handleDatasetModal}
          onResize={this.onPopoverResize}
          onClose={closePopover}
          onChange={this.onChange}
          getCurrentTab={this.getCurrentTab}
          getCurrentLabel={this.getCurrentLabel}
          isNewMetric={this.props.isNew}
          isLabelModified={
            this.state.labelModified &&
            adhocMetricLabel !== this.state.title.label
          }
        />
      </ExplorePopoverContent>
    );

    const popoverTitle = (
      <AdhocMetricEditPopoverTitle
        title={title}
        onChange={this.onLabelChange}
        isEditDisabled={this.state.isTitleEditDisabled}
      />
    );

    return (
      <>
        {this.state.showSaveDatasetModal && (
          <SaveDatasetModal
            visible={this.state.showSaveDatasetModal}
            onHide={() => this.handleDatasetModal(false)}
            buttonTextOnSave={t('Save')}
            buttonTextOnOverwrite={t('Overwrite')}
            modalDescription={t(
              'Save this query as a virtual dataset to continue exploring',
            )}
            datasource={datasource}
          />
        )}
        <ControlPopover
          placement="right"
          trigger="click"
          content={overlayContent}
          defaultOpen={visible}
          open={visible}
          onOpenChange={togglePopover}
          title={popoverTitle}
          destroyTooltipOnHide
        >
          {this.props.children}
        </ControlPopover>
      </>
    );
  }
}

export default AdhocMetricPopoverTrigger;
