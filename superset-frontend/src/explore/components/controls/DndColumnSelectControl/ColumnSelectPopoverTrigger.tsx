// DODO was here (TODO)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { AdhocColumn, t, isAdhocColumn } from '@superset-ui/core';
import { ColumnMeta, isColumnMeta } from '@superset-ui/chart-controls';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
// DODO added
import { ControlPopoverTitle } from 'src/DodoExtensions/ColumnSelectPopoverTrigger';
import ColumnSelectPopover from './ColumnSelectPopover';
// DODO changed
// import { DndColumnSelectPopoverTitle } from './DndColumnSelectPopoverTitle';
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
const defaultPopoverLabelRU = t('Моя колонка');
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
  // DODO added
  const [popoverLabelEN, setPopoverLabelEN] = useState(defaultPopoverLabel);
  const [popoverLabelRU, setPopoverLabelRU] = useState(defaultPopoverLabel);

  const [popoverVisible, setPopoverVisible] = useState(false);
  const [isTitleEditDisabled, setIsTitleEditDisabled] = useState(true);
  const [showDatasetModal, setDatasetModal] = useState(false);

  // DODO added
  const [canHaveCustomLabel, setCanHaveCustomLabel] = useState(false);

  let initialPopoverLabel = defaultPopoverLabel;
  // DODO added
  let initialPopoverLabelEN = defaultPopoverLabel;
  let initialPopoverLabelRU = defaultPopoverLabelRU;

  if (editedColumn && isColumnMeta(editedColumn)) {
    initialPopoverLabel = editedColumn.verbose_name || editedColumn.column_name;
    // DODO added
    initialPopoverLabelEN =
      editedColumn.verbose_name_EN || editedColumn.column_name;
    initialPopoverLabelRU =
      editedColumn.verbose_name_RU || editedColumn.column_name;
  } else if (editedColumn && isAdhocColumn(editedColumn)) {
    initialPopoverLabel = editedColumn.label || defaultPopoverLabel;
    // DODO added
    initialPopoverLabelEN = editedColumn.labelEN || defaultPopoverLabel;
    initialPopoverLabelRU = editedColumn.labelRU || defaultPopoverLabelRU;
  }

  // DODO added
  useEffect(() => {
    if (editedColumn && isColumnMeta(editedColumn)) {
      setCanHaveCustomLabel(false);
    } else if (editedColumn && isAdhocColumn(editedColumn)) {
      setCanHaveCustomLabel(true);
    }
  }, [editedColumn]);

  useEffect(() => {
    setPopoverLabel(initialPopoverLabel);
    // DODO added
    setPopoverLabelEN(initialPopoverLabelEN);
    setPopoverLabelRU(initialPopoverLabelRU);
  }, [initialPopoverLabel, initialPopoverLabelEN, initialPopoverLabelRU]);

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
    // DODO added
    console.log('isTitleEditDisabled', isTitleEditDisabled);
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
          getCurrentTab={getCurrentTab}
          isTemporal={isTemporal}
          // DODO changed
          setLabel={(value: string) => {
            setPopoverLabel(value);
            setPopoverLabelEN(value);
          }}
          // DODO added
          labelEN={popoverLabelEN}
          labelRU={popoverLabelRU}
          setLabelEN={(value: string) => {
            setPopoverLabel(value);
            setPopoverLabelEN(value);
          }}
          setLabelRU={setPopoverLabelRU}
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
      // DODO added
      popoverLabelEN,
      popoverLabelRU,
    ],
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
        // DODO changed
        title={() => (
          <ControlPopoverTitle
            canHaveCustomLabel={canHaveCustomLabel}
            popoverLabel={popoverLabel}
            popoverLabelRU={popoverLabelRU}
            onLabelChange={(value: string) => {
              setPopoverLabel(value);
            }}
            onLabelRUChange={(value: string) => setPopoverLabelRU(value)}
          />
        )}
        destroyTooltipOnHide
      >
        {children}
      </ControlPopover>
    </>
  );
};

export default ColumnSelectPopoverTrigger;
