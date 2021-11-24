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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdhocColumn,
  FeatureFlag,
  isFeatureEnabled,
  t,
} from '@superset-ui/core';
import {
  ColumnMeta,
  isAdhocColumn,
  isColumnMeta,
} from '@superset-ui/chart-controls';
import Popover from 'src/components/Popover';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import ColumnSelectPopover from './ColumnSelectPopover';
import { DndColumnSelectPopoverTitle } from './DndColumnSelectPopoverTitle';

interface ColumnSelectPopoverTriggerProps {
  columns: ColumnMeta[];
  editedColumn?: ColumnMeta | AdhocColumn;
  onColumnEdit: (editedColumn: ColumnMeta | AdhocColumn) => void;
  isControlledComponent?: boolean;
  visible?: boolean;
  togglePopover?: (visible: boolean) => void;
  closePopover?: () => void;
  children: React.ReactNode;
}

const defaultPopoverLabel = t('My column');
const editableTitleTab = 'sqlExpression';

const isAdhocColumnsEnabled = isFeatureEnabled(FeatureFlag.UX_BETA);

const ColumnSelectPopoverTrigger = ({
  columns,
  editedColumn,
  onColumnEdit,
  isControlledComponent,
  children,
  ...props
}: ColumnSelectPopoverTriggerProps) => {
  const [popoverLabel, setPopoverLabel] = useState(defaultPopoverLabel);
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [isTitleEditDisabled, setIsTitleEditDisabled] = useState(true);
  const [hasCustomLabel, setHasCustomLabel] = useState(false);

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
          onClose={handleClosePopover}
          onChange={onColumnEdit}
          label={popoverLabel}
          setLabel={setPopoverLabel}
          getCurrentTab={getCurrentTab}
          isAdhocColumnsEnabled={isAdhocColumnsEnabled}
        />
      </ExplorePopoverContent>
    ),
    [
      columns,
      editedColumn,
      getCurrentTab,
      handleClosePopover,
      onColumnEdit,
      popoverLabel,
    ],
  );

  const onLabelChange = useCallback((e: any) => {
    setPopoverLabel(e.target.value);
    setHasCustomLabel(true);
  }, []);

  const popoverTitle = useMemo(
    () => (
      <DndColumnSelectPopoverTitle
        title={popoverLabel}
        onChange={onLabelChange}
        isEditDisabled={isTitleEditDisabled}
        hasCustomLabel={hasCustomLabel}
      />
    ),
    [hasCustomLabel, isTitleEditDisabled, onLabelChange, popoverLabel],
  );

  return (
    <Popover
      placement="right"
      trigger="click"
      content={overlayContent}
      defaultVisible={visible}
      visible={visible}
      onVisibleChange={handleTogglePopover}
      title={isAdhocColumnsEnabled && popoverTitle}
      destroyTooltipOnHide
    >
      {children}
    </Popover>
  );
};

export default ColumnSelectPopoverTrigger;
