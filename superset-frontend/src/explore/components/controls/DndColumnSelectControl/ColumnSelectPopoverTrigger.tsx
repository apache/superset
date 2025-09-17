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
import { useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
import { useSelector } from 'react-redux';

import {
  AdhocColumn,
  t,
  isAdhocColumn,
  Metric,
  QueryFormMetric,
} from '@superset-ui/core';
import { ColumnMeta, isColumnMeta } from '@superset-ui/chart-controls';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import ColumnSelectPopover from './ColumnSelectPopover';
import { DndColumnSelectPopoverTitle } from './DndColumnSelectPopoverTitle';
import ControlPopover from '../ControlPopover/ControlPopover';

const defaultPopoverLabel = t('My column');
const editableTitleTab = 'sqlExpression';

interface ColumnSelectPopoverTriggerProps {
  columns: ColumnMeta[];
  editedColumn?: ColumnMeta | AdhocColumn;
  onColumnEdit: (editedColumn: ColumnMeta | AdhocColumn) => void;
  isControlledComponent?: boolean;
  visible?: boolean;
  togglePopover?: (visible: boolean) => void;
  closePopover?: () => void;
  children: ReactNode;
  isTemporal?: boolean;
  disabledTabs?: Set<string>;
  metrics?: Metric[];
  selectedMetrics?: QueryFormMetric[];
}

const ColumnSelectPopoverTriggerWrapper = (
  props: ColumnSelectPopoverTriggerProps,
) => {
  const datasource = useSelector(
    (state: any) => state?.explore?.datasource || null,
  );

  return <ColumnSelectPopoverTriggerInner {...props} datasource={datasource} />;
};

interface ColumnSelectPopoverTriggerInnerProps
  extends ColumnSelectPopoverTriggerProps {
  datasource?: any;
}

const ColumnSelectPopoverTriggerInner = ({
  columns,
  editedColumn,
  onColumnEdit,
  isControlledComponent,
  children,
  isTemporal,
  disabledTabs,
  metrics,
  selectedMetrics,
  datasource,
  ...props
}: ColumnSelectPopoverTriggerInnerProps) => {
  const [popoverLabel, setPopoverLabel] = useState(defaultPopoverLabel);
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [isTitleEditDisabled, setIsTitleEditDisabled] = useState(true);
  const [hasCustomLabel, setHasCustomLabel] = useState(false);
  const [showDatasetModal, setDatasetModal] = useState(false);

  let initialPopoverLabel = defaultPopoverLabel;
  if (editedColumn && isColumnMeta(editedColumn)) {
    initialPopoverLabel = editedColumn.verbose_name || editedColumn.column_name;
  } else if (editedColumn && isAdhocColumn(editedColumn)) {
    initialPopoverLabel = editedColumn.label || defaultPopoverLabel;
  }

  useEffect(() => {
    setPopoverLabel(initialPopoverLabel);
  }, [initialPopoverLabel, popoverVisible]);

  const togglePopover = useCallback((visible: boolean) => {
    setPopoverVisible(visible);
  }, []);

  const closePopover = useCallback(() => {
    setPopoverVisible(false);
  }, []);

  const { visible, handleTogglePopover, handleClosePopover } =
    isControlledComponent
      ? {
          visible: props.visible,
          handleTogglePopover: props.togglePopover!,
          handleClosePopover: props.closePopover!,
        }
      : {
          visible: popoverVisible,
          handleTogglePopover: togglePopover,
          handleClosePopover: closePopover,
        };

  const getCurrentTab = useCallback((tab: string) => {
    setIsTitleEditDisabled(tab !== editableTitleTab);
  }, []);

  const overlayContent = useMemo(
    () => (
      <ExplorePopoverContent>
        <ColumnSelectPopover
          editedColumn={editedColumn}
          columns={columns}
          setDatasetModal={setDatasetModal}
          onClose={handleClosePopover}
          onChange={onColumnEdit}
          hasCustomLabel={hasCustomLabel}
          label={popoverLabel}
          setLabel={setPopoverLabel}
          getCurrentTab={getCurrentTab}
          isTemporal={isTemporal}
          disabledTabs={disabledTabs}
          metrics={metrics}
          selectedMetrics={selectedMetrics}
          datasource={datasource}
        />
      </ExplorePopoverContent>
    ),
    [
      columns,
      editedColumn,
      getCurrentTab,
      hasCustomLabel,
      handleClosePopover,
      isTemporal,
      onColumnEdit,
      popoverLabel,
      disabledTabs,
      metrics,
      selectedMetrics,
      datasource,
    ],
  );

  const onLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPopoverLabel(e.target.value);
      setHasCustomLabel(true);
    },
    [setPopoverLabel, setHasCustomLabel],
  );

  const popoverTitle = useMemo(() => {
    if (disabledTabs?.has('saved') && disabledTabs?.has('sqlExpression')) {
      return <span>{t('Tooltip contents')}</span>;
    }
    return (
      <DndColumnSelectPopoverTitle
        title={popoverLabel}
        onChange={onLabelChange}
        isEditDisabled={isTitleEditDisabled}
        hasCustomLabel={hasCustomLabel}
      />
    );
  }, [
    hasCustomLabel,
    isTitleEditDisabled,
    onLabelChange,
    popoverLabel,
    disabledTabs,
  ]);

  return (
    <>
      {showDatasetModal && (
        <SaveDatasetModal
          visible={showDatasetModal}
          onHide={() => setDatasetModal(false)}
          buttonTextOnSave={t('Save')}
          buttonTextOnOverwrite={t('Overwrite')}
          modalDescription={t(
            'Save this query as a virtual dataset to continue exploring',
          )}
          datasource={datasource}
        />
      )}
      <ControlPopover
        trigger="click"
        content={overlayContent}
        defaultOpen={visible}
        open={visible}
        onOpenChange={handleTogglePopover}
        title={popoverTitle}
        destroyTooltipOnHide
      >
        {children}
      </ControlPopover>
    </>
  );
};

export default ColumnSelectPopoverTriggerWrapper;
