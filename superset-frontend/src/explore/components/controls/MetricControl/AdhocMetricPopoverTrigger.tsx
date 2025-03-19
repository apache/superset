// DODO was here
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
  title: {
    label: string;
    labelRU: string; // DODO added 44120742
    labelEN: string; // DODO added 44120742
    hasCustomLabel: boolean;
  };
  currentLabel: string;
  currentLabelRU: string; // DODO added 44120742
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
    // this.onLabelChange = this.onLabelChange.bind(this);
    this.onLabelENChange = this.onLabelENChange.bind(this); // DODO added 44120742
    this.onLabelRUChange = this.onLabelRUChange.bind(this); // DODO added 44120742
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
        labelEN: props.adhocMetric.labelEN, // DODO added 44120742
        labelRU: props.adhocMetric.labelRU, // DODO added 44120742
        hasCustomLabel: props.adhocMetric.hasCustomLabel,
      },
      currentLabel: '',
      currentLabelRU: '', // DODO added 44120742
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
          labelEN: nextProps.adhocMetric.labelEN, // DODO added 44120742
          labelRU: nextProps.adhocMetric.labelRU, // DODO added 44120742
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

  onLabelENChange(e: any) {
    const { verbose_name, metric_name } = this.props.savedMetric;
    const defaultMetricLabel = this.props.adhocMetric?.getDefaultLabel();
    const label = e.target.value;
    // DODO added 44120742
    const finalLabelEN =
      label ||
      this.state.currentLabel ||
      verbose_name ||
      metric_name ||
      defaultMetricLabel;
    const finalLabelRU = this.state.title.labelRU;

    this.setState(state => ({
      title: {
        label: finalLabelEN, // DODO changed 44120742
        labelEN: finalLabelEN, // DODO added 44120742
        labelRU: finalLabelRU, // DODO added 44120742
        hasCustomLabel: !!label,
      },
      labelModified: true,
    }));
  }

  // DODO added 44120742
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
    adhocMetricLabelRU, // DODO added 44120742
  }: {
    savedMetricLabel: string;
    adhocMetricLabel: string;
    adhocMetricLabelRU: string; // DODO added 44120742
  }) {
    const currentLabel = savedMetricLabel || adhocMetricLabel;
    const currentLabelRU = savedMetricLabel || adhocMetricLabelRU; // DODO added 44120742
    this.setState({
      currentLabel,
      currentLabelRU, // DODO added 44120742
      labelModified: true,
    });
    if (savedMetricLabel || !this.state.title.hasCustomLabel) {
      this.setState({
        title: {
          label: currentLabel,
          labelEN: currentLabel, // DODO added 44120742
          labelRU: currentLabelRU, // DODO added 44120742
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
    // const { hasCustomLabel, label } = adhocMetric;
    const { hasCustomLabel, label, labelRU } = adhocMetric; // DODO changed 44120742
    const adhocMetricLabel = hasCustomLabel
      ? label
      : adhocMetric.getDefaultLabel();
    // DODO added 44120742
    const adhocMetricLabelRU = hasCustomLabel
      ? labelRU
      : adhocMetric.getDefaultLabelRU();
    const title = this.state.labelModified
      ? this.state.title
      : {
          label: verbose_name || metric_name || adhocMetricLabel,
          labelEN: verbose_name || metric_name || adhocMetricLabel, // DODO added 44120742
          labelRU: verbose_name || metric_name || adhocMetricLabelRU, // DODO added 44120742
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
            (adhocMetricLabel !== this.state.title.label ||
              adhocMetricLabelRU !== this.state.title.labelRU) // DODO added 44120742
          }
        />
      </ExplorePopoverContent>
    );

    const popoverTitle = (
      <AdhocMetricEditPopoverTitle
        title={title}
        // onChange={this.onLabelChange}
        onChangeEN={this.onLabelENChange} // DODO added 44120742
        onChangeRU={this.onLabelRUChange} // DODO added 44120742
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
