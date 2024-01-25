// DODO was here (TODO)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { AdhocColumn, t, isAdhocColumn } from '@superset-ui/core';
import { ColumnMeta, isColumnMeta } from '@superset-ui/chart-controls';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import ColumnSelectPopover from './ColumnSelectPopover';
import { DndColumnSelectPopoverTitle } from './DndColumnSelectPopoverTitle';
import ControlPopover from '../ControlPopover/ControlPopover';

interface ColumnSelectPopoverTriggerProps {
  columns: ColumnMeta[];
  editedColumn?: ColumnMeta | AdhocColumn;
  onColumnEdit: (editedColumn: ColumnMeta | AdhocColumn) => void;
  isControlledComponent?: boolean;
  visible?: boolean;
  togglePopover?: (visible: boolean) => void;
  closePopover?: () => void;
  children: React.ReactNode;
  isTemporal?: boolean;
}

const defaultPopoverLabel = t('My column');
const editableTitleTab = 'sqlExpression';

const ColumnSelectPopoverTrigger = ({
  columns,
  editedColumn,
  onColumnEdit,
  isControlledComponent,
  children,
  isTemporal,
  ...props
}: ColumnSelectPopoverTriggerProps) => {
  // @ts-ignore
  const datasource = useSelector(state => state.explore.datasource);
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
          label={popoverLabel}
          setLabel={setPopoverLabel}
          getCurrentTab={getCurrentTab}
          isTemporal={isTemporal}
        />
      </ExplorePopoverContent>
    ),
    [
      columns,
      editedColumn,
      getCurrentTab,
      handleClosePopover,
      isTemporal,
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
        defaultVisible={visible}
        visible={visible}
        onVisibleChange={handleTogglePopover}
        title={popoverTitle}
        destroyTooltipOnHide
      >
        {children}
      </ControlPopover>
    </>
  );
};

export default ColumnSelectPopoverTrigger;
