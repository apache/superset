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
import { ReactNode, useState, useCallback, useEffect } from 'react';
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

const AdhocMetricPopoverTrigger = (props: AdhocMetricPopoverTriggerProps) => {
  const {
    adhocMetric: propsAdhocMetric,
    savedMetric: propsSavedMetric,
    columns,
    savedMetricsOptions,
    datasource,
    isControlledComponent,
    onMetricEdit,
    isNew,
    children,
  } = props;

  const [adhocMetric, setAdhocMetric] = useState(propsAdhocMetric);
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [title, setTitle] = useState({
    label: propsAdhocMetric.label,
    hasCustomLabel: propsAdhocMetric.hasCustomLabel,
  });
  const [currentLabel, setCurrentLabel] = useState('');
  const [labelModified, setLabelModified] = useState(false);
  const [isTitleEditDisabled, setIsTitleEditDisabled] = useState(false);
  const [showSaveDatasetModal, setShowSaveDatasetModal] = useState(false);

  // Update state when props change
  useEffect(() => {
    setAdhocMetric(propsAdhocMetric);

    if (adhocMetric.optionName !== propsAdhocMetric.optionName) {
      setTitle({
        label: propsAdhocMetric.label,
        hasCustomLabel: propsAdhocMetric.hasCustomLabel,
      });
      setCurrentLabel('');
      setLabelModified(false);
    }
  }, [propsAdhocMetric]);

  const onLabelChange = useCallback(
    (e: any) => {
      const { verbose_name, metric_name } = propsSavedMetric;
      const defaultMetricLabel = propsAdhocMetric?.getDefaultLabel();
      const label = e.target.value;

      setTitle({
        label:
          label ||
          currentLabel ||
          verbose_name ||
          metric_name ||
          defaultMetricLabel,
        hasCustomLabel: !!label,
      });
      setLabelModified(true);
    },
    [propsSavedMetric, propsAdhocMetric, currentLabel],
  );

  const onPopoverResize = useCallback(() => {
    // Force update in function component is not needed
  }, []);

  const handleDatasetModal = useCallback((showModal: boolean) => {
    setShowSaveDatasetModal(showModal);
  }, []);

  const closePopover = useCallback(() => {
    if (isControlledComponent && props.closePopover) {
      props.closePopover();
    } else {
      setPopoverVisible(false);
    }
    setLabelModified(false);
  }, [isControlledComponent, props.closePopover]);

  const togglePopover = useCallback(
    (visible: boolean) => {
      if (isControlledComponent && props.togglePopover) {
        props.togglePopover(visible);
      } else {
        setPopoverVisible(visible);
      }
    },
    [isControlledComponent, props.togglePopover],
  );

  const getCurrentTab = useCallback((tab: string) => {
    setIsTitleEditDisabled(tab === SAVED_TAB_KEY);
  }, []);

  const getCurrentLabel = useCallback(
    ({
      savedMetricLabel,
      adhocMetricLabel,
    }: {
      savedMetricLabel: string;
      adhocMetricLabel: string;
    }) => {
      const newCurrentLabel = savedMetricLabel || adhocMetricLabel;
      setCurrentLabel(newCurrentLabel);
      setLabelModified(true);

      if (savedMetricLabel || !title.hasCustomLabel) {
        setTitle({
          label: newCurrentLabel,
          hasCustomLabel: false,
        });
      }
    },
    [title.hasCustomLabel],
  );

  const onChange = useCallback(
    (newMetric: Metric, oldMetric: Metric) => {
      onMetricEdit({ ...newMetric, ...title }, oldMetric);
    },
    [onMetricEdit, title],
  );

  const { verbose_name, metric_name } = propsSavedMetric;
  const { hasCustomLabel, label } = adhocMetric;
  const adhocMetricLabel = hasCustomLabel
    ? label
    : adhocMetric.getDefaultLabel();

  const displayTitle = labelModified
    ? title
    : {
        label: verbose_name || metric_name || adhocMetricLabel,
        hasCustomLabel,
      };

  const visible = isControlledComponent ? props.visible : popoverVisible;
  const effectiveTogglePopover = isControlledComponent
    ? props.togglePopover
    : togglePopover;
  const effectiveClosePopover =
    isControlledComponent && props.closePopover
      ? props.closePopover
      : closePopover;

  const overlayContent = (
    <ExplorePopoverContent>
      <AdhocMetricEditPopover
        adhocMetric={adhocMetric}
        columns={columns}
        savedMetricsOptions={savedMetricsOptions}
        savedMetric={propsSavedMetric}
        datasource={datasource}
        handleDatasetModal={handleDatasetModal}
        onResize={onPopoverResize}
        onClose={effectiveClosePopover}
        onChange={onChange}
        getCurrentTab={getCurrentTab}
        getCurrentLabel={getCurrentLabel}
        isNewMetric={isNew}
        isLabelModified={labelModified && adhocMetricLabel !== title.label}
      />
    </ExplorePopoverContent>
  );

  const popoverTitle = (
    <AdhocMetricEditPopoverTitle
      title={displayTitle}
      onChange={onLabelChange}
      isEditDisabled={isTitleEditDisabled}
    />
  );

  return (
    <>
      {showSaveDatasetModal && (
        <SaveDatasetModal
          visible={showSaveDatasetModal}
          onHide={() => handleDatasetModal(false)}
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
        onOpenChange={effectiveTogglePopover}
        title={popoverTitle}
        destroyTooltipOnHide
      >
        {children}
      </ControlPopover>
    </>
  );
};

export default AdhocMetricPopoverTrigger;
