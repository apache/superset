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
import {
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { t } from '@apache-superset/core';
import { Metric } from '@superset-ui/core';
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
  savedMetric: savedMetricType | Record<string, never>;
  datasource: Datasource & ISaveableDatasource;
  children: ReactNode;
  isControlledComponent?: boolean;
  visible?: boolean;
  togglePopover?: (visible: boolean) => void;
  closePopover?: () => void;
  isNew?: boolean;
};

interface TitleState {
  label: string;
  hasCustomLabel: boolean;
}

interface ComponentState {
  adhocMetric: AdhocMetric;
  popoverVisible: boolean;
  title: TitleState;
  currentLabel: string;
  labelModified: boolean;
  isTitleEditDisabled: boolean;
  showSaveDatasetModal: boolean;
}

type Action =
  | { type: 'SET_ADHOC_METRIC'; payload: AdhocMetric }
  | { type: 'SET_POPOVER_VISIBLE'; payload: boolean }
  | { type: 'SET_TITLE'; payload: TitleState }
  | { type: 'SET_CURRENT_LABEL'; payload: string }
  | { type: 'SET_LABEL_MODIFIED'; payload: boolean }
  | { type: 'SET_TITLE_EDIT_DISABLED'; payload: boolean }
  | { type: 'SET_SHOW_SAVE_DATASET_MODAL'; payload: boolean }
  | {
      type: 'RESET_ON_OPTION_CHANGE';
      payload: { adhocMetric: AdhocMetric; title: TitleState };
    }
  | { type: 'UPDATE_ADHOC_METRIC'; payload: AdhocMetric }
  | { type: 'CLOSE_POPOVER' }
  | {
      type: 'ON_LABEL_CHANGE';
      payload: { label: string; currentLabel: string; fallbackLabel: string };
    }
  | {
      type: 'GET_CURRENT_LABEL';
      payload: { currentLabel: string; hasCustomLabel: boolean };
    };

function reducer(state: ComponentState, action: Action): ComponentState {
  switch (action.type) {
    case 'SET_ADHOC_METRIC':
      return { ...state, adhocMetric: action.payload };
    case 'SET_POPOVER_VISIBLE':
      return { ...state, popoverVisible: action.payload };
    case 'SET_TITLE':
      return { ...state, title: action.payload };
    case 'SET_CURRENT_LABEL':
      return { ...state, currentLabel: action.payload };
    case 'SET_LABEL_MODIFIED':
      return { ...state, labelModified: action.payload };
    case 'SET_TITLE_EDIT_DISABLED':
      return { ...state, isTitleEditDisabled: action.payload };
    case 'SET_SHOW_SAVE_DATASET_MODAL':
      return { ...state, showSaveDatasetModal: action.payload };
    case 'RESET_ON_OPTION_CHANGE':
      return {
        ...state,
        adhocMetric: action.payload.adhocMetric,
        title: action.payload.title,
        currentLabel: '',
        labelModified: false,
      };
    case 'UPDATE_ADHOC_METRIC':
      return { ...state, adhocMetric: action.payload };
    case 'CLOSE_POPOVER':
      return { ...state, popoverVisible: false, labelModified: false };
    case 'ON_LABEL_CHANGE': {
      const { label, currentLabel, fallbackLabel } = action.payload;
      return {
        ...state,
        title: {
          label: label || currentLabel || fallbackLabel,
          hasCustomLabel: !!label,
        },
        labelModified: true,
      };
    }
    case 'GET_CURRENT_LABEL': {
      const { currentLabel, hasCustomLabel } = action.payload;
      const newState: ComponentState = {
        ...state,
        currentLabel,
        labelModified: true,
      };
      if (currentLabel || !hasCustomLabel) {
        newState.title = {
          label: currentLabel,
          hasCustomLabel: false,
        };
      }
      return newState;
    }
    default:
      return state;
  }
}

function AdhocMetricPopoverTrigger({
  adhocMetric: propsAdhocMetric,
  onMetricEdit,
  columns,
  savedMetricsOptions,
  savedMetric,
  datasource,
  children,
  isControlledComponent,
  visible: propsVisible,
  togglePopover: propsTogglePopover,
  closePopover: propsClosePopover,
  isNew,
}: AdhocMetricPopoverTriggerProps) {
  const initialState: ComponentState = {
    adhocMetric: propsAdhocMetric,
    popoverVisible: false,
    title: {
      label: propsAdhocMetric.label,
      hasCustomLabel: propsAdhocMetric.hasCustomLabel,
    },
    currentLabel: '',
    labelModified: false,
    isTitleEditDisabled: false,
    showSaveDatasetModal: false,
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  // Track previous optionName to detect when the metric changes externally
  const prevOptionNameRef = useRef(propsAdhocMetric.optionName);

  // Handle getDerivedStateFromProps logic
  useEffect(() => {
    if (prevOptionNameRef.current !== propsAdhocMetric.optionName) {
      dispatch({
        type: 'RESET_ON_OPTION_CHANGE',
        payload: {
          adhocMetric: propsAdhocMetric,
          title: {
            label: propsAdhocMetric.label,
            hasCustomLabel: propsAdhocMetric.hasCustomLabel,
          },
        },
      });
    } else {
      dispatch({ type: 'UPDATE_ADHOC_METRIC', payload: propsAdhocMetric });
    }
    prevOptionNameRef.current = propsAdhocMetric.optionName;
  }, [propsAdhocMetric]);

  const [, forceUpdate] = useState({});

  const onPopoverResize = useCallback(() => {
    forceUpdate({});
  }, []);

  const onLabelChange = useCallback(
    (e: { target: { value: string } }) => {
      const { verbose_name, metric_name } = savedMetric;
      const defaultMetricLabel = propsAdhocMetric?.getDefaultLabel();
      const label = e.target.value;
      dispatch({
        type: 'ON_LABEL_CHANGE',
        payload: {
          label,
          currentLabel: state.currentLabel,
          fallbackLabel: verbose_name || metric_name || defaultMetricLabel,
        },
      });
    },
    [savedMetric, propsAdhocMetric, state.currentLabel],
  );

  const handleDatasetModal = useCallback((showModal: boolean) => {
    dispatch({ type: 'SET_SHOW_SAVE_DATASET_MODAL', payload: showModal });
  }, []);

  const closePopover = useCallback(() => {
    dispatch({ type: 'CLOSE_POPOVER' });
  }, []);

  const togglePopover = useCallback((visible: boolean) => {
    dispatch({ type: 'SET_POPOVER_VISIBLE', payload: visible });
  }, []);

  const getCurrentTab = useCallback((tab: string) => {
    dispatch({
      type: 'SET_TITLE_EDIT_DISABLED',
      payload: tab === SAVED_TAB_KEY,
    });
  }, []);

  const getCurrentLabel = useCallback(
    ({
      savedMetricLabel,
      adhocMetricLabel,
    }: {
      savedMetricLabel: string;
      adhocMetricLabel: string;
    }) => {
      const currentLabel = savedMetricLabel || adhocMetricLabel;
      dispatch({
        type: 'GET_CURRENT_LABEL',
        payload: {
          currentLabel,
          hasCustomLabel: state.title.hasCustomLabel,
        },
      });
    },
    [state.title.hasCustomLabel],
  );

  const onChange = useCallback(
    (newMetric: Metric, oldMetric: Metric) => {
      onMetricEdit({ ...newMetric, ...state.title }, oldMetric);
    },
    [onMetricEdit, state.title],
  );

  const { verbose_name, metric_name } = savedMetric;
  const { hasCustomLabel, label } = state.adhocMetric;
  const adhocMetricLabel = hasCustomLabel
    ? label
    : state.adhocMetric.getDefaultLabel();
  const title = state.labelModified
    ? state.title
    : {
        label: verbose_name || metric_name || adhocMetricLabel,
        hasCustomLabel,
      };

  const {
    visible,
    togglePopover: toggle,
    closePopover: close,
  } = isControlledComponent
    ? {
        visible: propsVisible,
        togglePopover: propsTogglePopover ?? togglePopover,
        closePopover: propsClosePopover ?? closePopover,
      }
    : {
        visible: state.popoverVisible,
        togglePopover,
        closePopover,
      };

  const overlayContent = (
    <ExplorePopoverContent>
      <AdhocMetricEditPopover
        adhocMetric={state.adhocMetric}
        columns={columns}
        savedMetricsOptions={savedMetricsOptions}
        savedMetric={savedMetric as savedMetricType}
        datasource={
          datasource as unknown as {
            type?: string;
            id?: number | string;
            extra?: string;
          }
        }
        handleDatasetModal={handleDatasetModal}
        onResize={onPopoverResize}
        onClose={close}
        onChange={onChange as (newMetric: unknown, oldMetric?: unknown) => void}
        getCurrentTab={getCurrentTab}
        getCurrentLabel={getCurrentLabel}
        isNewMetric={isNew}
        isLabelModified={
          state.labelModified && adhocMetricLabel !== state.title.label
        }
      />
    </ExplorePopoverContent>
  );

  const popoverTitle = (
    <AdhocMetricEditPopoverTitle
      title={title}
      onChange={onLabelChange}
      isEditDisabled={state.isTitleEditDisabled}
    />
  );

  return (
    <>
      {state.showSaveDatasetModal && (
        <SaveDatasetModal
          visible={state.showSaveDatasetModal}
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
        onOpenChange={toggle}
        title={popoverTitle}
        destroyTooltipOnHide
      >
        {children}
      </ControlPopover>
    </>
  );
}

export default memo(AdhocMetricPopoverTrigger);
