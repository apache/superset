// DODO was here
import React, { ReactNode } from 'react';
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
  // DODO changed
  title: {
    label: string;
    labelRU: string;
    labelEN: string;
    hasCustomLabel: boolean;
  };
  currentLabel: string;
  // DODO added
  currentLabelRU: string;
  labelModified: boolean;
  isTitleEditDisabled: boolean;
  showSaveDatasetModal: boolean;
};

class AdhocMetricPopoverTrigger extends React.PureComponent<
  AdhocMetricPopoverTriggerProps,
  AdhocMetricPopoverTriggerState
> {
  constructor(props: AdhocMetricPopoverTriggerProps) {
    super(props);
    this.onPopoverResize = this.onPopoverResize.bind(this);
    // DODO changed
    // this.onLabelChange = this.onLabelChange.bind(this);
    // DODO added
    this.onLabelENChange = this.onLabelENChange.bind(this);
    this.onLabelRUChange = this.onLabelRUChange.bind(this);

    this.closePopover = this.closePopover.bind(this);
    this.togglePopover = this.togglePopover.bind(this);
    this.getCurrentTab = this.getCurrentTab.bind(this);
    this.getCurrentLabel = this.getCurrentLabel.bind(this);
    this.onChange = this.onChange.bind(this);
    this.handleDatasetModal = this.handleDatasetModal.bind(this);

    // DODO changed
    this.state = {
      adhocMetric: props.adhocMetric,
      popoverVisible: false,
      title: {
        label: props.adhocMetric.label,
        hasCustomLabel: props.adhocMetric.hasCustomLabel,
        // DODO added
        labelEN: props.adhocMetric.labelEN,
        labelRU: props.adhocMetric.labelRU,
      },
      currentLabel: '',
      // DODO added
      currentLabelRU: '',

      labelModified: false,
      isTitleEditDisabled: false,
      showSaveDatasetModal: false,
    };
  }

  // DODO changed
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
          // DODO added
          labelEN: nextProps.adhocMetric.labelEN,
          labelRU: nextProps.adhocMetric.labelRU,
        },
        currentLabel: '',
        labelModified: false,
      };
    }
    return {
      adhocMetric: nextProps.adhocMetric,
    };
  }

  // DODO added
  onLabelENChange(e: any) {
    const { verbose_name, metric_name } = this.props.savedMetric;
    const defaultMetricLabel = this.props.adhocMetric?.getDefaultLabel();
    const label = e.target.value;

    const finalLabelEN =
      label ||
      this.state.currentLabel ||
      verbose_name ||
      metric_name ||
      defaultMetricLabel;
    const finalLabelRU = this.state.title.labelRU;

    this.setState(() => ({
      title: {
        hasCustomLabel: !!label,
        label: finalLabelEN,
        labelEN: finalLabelEN,
        labelRU: finalLabelRU,
      },
      labelModified: true,
    }));
  }

  // DODO added
  onLabelRUChange(e: any) {
    const { verbose_name, metric_name } = this.props.savedMetric;
    const defaultMetricLabel = this.props.adhocMetric?.getDefaultLabelRU();
    const label = e.target.value;

    const finalLabelEN = this.state.title.labelEN;
    const finalLabelRU =
      label ||
      this.state.currentLabelRU ||
      verbose_name ||
      metric_name ||
      defaultMetricLabel;

    this.setState(() => ({
      title: {
        hasCustomLabel: !!label,
        label: finalLabelEN,
        labelEN: finalLabelEN,
        labelRU: finalLabelRU,
      },
      labelModified: true,
    }));
  }

  // DODO changed
  // onLabelChange(e: any) {}

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

  // DODO changed
  getCurrentLabel({
    savedMetricLabel,
    adhocMetricLabel,
    // DODO added
    adhocMetricLabelRU,
  }: {
    savedMetricLabel: string;
    adhocMetricLabel: string;
    adhocMetricLabelRU: string;
  }) {
    const currentLabel = savedMetricLabel || adhocMetricLabel;
    // DODO added
    const currentLabelRU = savedMetricLabel || adhocMetricLabelRU;

    this.setState({
      currentLabel,
      labelModified: true,
      // DODO added
      currentLabelRU,
    });
    if (savedMetricLabel || !this.state.title.hasCustomLabel) {
      this.setState({
        title: {
          label: currentLabel,
          hasCustomLabel: false,
          // DODO added
          labelEN: currentLabel,
          labelRU: currentLabelRU,
        },
      });
    }
  }

  onChange(newMetric: Metric, oldMetric: Metric) {
    this.props.onMetricEdit({ ...newMetric, ...this.state.title }, oldMetric);
  }

  // DODO changed
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
    // DODO added
    const { hasCustomLabel, label, labelRU } = adhocMetric;

    const adhocMetricLabel = hasCustomLabel
      ? label
      : adhocMetric.getDefaultLabel();
    // DODO added
    const adhocMetricLabelRU = hasCustomLabel
      ? labelRU
      : adhocMetric.getDefaultLabelRU();

    const title = this.state.labelModified
      ? this.state.title
      : {
          label: verbose_name || metric_name || adhocMetricLabel,
          hasCustomLabel,
          // DODO added
          labelEN: verbose_name || metric_name || adhocMetricLabel,
          labelRU: verbose_name || metric_name || adhocMetricLabelRU,
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

    // DODO changed
    const popoverTitle = (
      <AdhocMetricEditPopoverTitle
        title={title}
        // DODO changed
        // onChange={this.onLabelChange}
        isEditDisabled={this.state.isTitleEditDisabled}
        // DODO added
        onChangeEN={this.onLabelENChange}
        onChangeRU={this.onLabelRUChange}
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
          defaultVisible={visible}
          visible={visible}
          onVisibleChange={togglePopover}
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
