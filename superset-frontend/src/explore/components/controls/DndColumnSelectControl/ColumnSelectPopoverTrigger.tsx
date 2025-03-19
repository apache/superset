// DODO was here
import { useCallback, useEffect, useMemo, useState, ReactNode } from 'react';

import { useSelector } from 'react-redux';
import { AdhocColumn, t, isAdhocColumn } from '@superset-ui/core';
import { ColumnMeta, isColumnMeta } from '@superset-ui/chart-controls';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { ControlPopoverTitle } from 'src/DodoExtensions/ColumnSelectPopoverTrigger';
import ColumnSelectPopover from './ColumnSelectPopover';
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
  children: ReactNode;
  isTemporal?: boolean;
  disabledTabs?: Set<string>;
}

const defaultPopoverLabel = t('My column');
const defaultPopoverLabelRU = 'Моя колонка'; // DODO added 44120742
const editableTitleTab = 'sqlExpression';

const ColumnSelectPopoverTrigger = ({
  columns,
  editedColumn,
  onColumnEdit,
  isControlledComponent,
  children,
  isTemporal,
  disabledTabs,
  ...props
}: ColumnSelectPopoverTriggerProps) => {
  // @ts-ignore
  const datasource = useSelector(state => state.explore.datasource);
  const [popoverLabel, setPopoverLabel] = useState(defaultPopoverLabel);
  const [popoverLabelEN, setPopoverLabelEN] = useState(defaultPopoverLabel); // DODO added 44120742
  const [popoverLabelRU, setPopoverLabelRU] = useState(defaultPopoverLabel); // DODO added 44120742
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [, setIsTitleEditDisabled] = useState(true);
  const [hasCustomLabel] = useState(false);
  const [showDatasetModal, setDatasetModal] = useState(false);
  const [canHaveCustomLabel, setCanHaveCustomLabel] = useState(false); // DODO added 44120742

  let initialPopoverLabel = defaultPopoverLabel;
  let initialPopoverLabelEN = defaultPopoverLabel; // DODO added 44120742
  let initialPopoverLabelRU = defaultPopoverLabelRU; // DODO added 44120742
  if (editedColumn && isColumnMeta(editedColumn)) {
    initialPopoverLabel = editedColumn.verbose_name || editedColumn.column_name;
    // DODO added 44120742
    initialPopoverLabelEN =
      editedColumn.verbose_name_en || editedColumn.column_name;
    // DODO added 44120742
    initialPopoverLabelRU =
      editedColumn.verbose_name_ru || editedColumn.column_name;
  } else if (editedColumn && isAdhocColumn(editedColumn)) {
    initialPopoverLabel = editedColumn.label || defaultPopoverLabel;
    initialPopoverLabelEN = editedColumn.labelEN || defaultPopoverLabel; // DODO added 44120742
    initialPopoverLabelRU = editedColumn.labelRU || defaultPopoverLabelRU; // DODO added 44120742
  }

  // DODO added 44120742
  useEffect(() => {
    if (editedColumn && isColumnMeta(editedColumn)) {
      setCanHaveCustomLabel(false);
    } else if (editedColumn && isAdhocColumn(editedColumn)) {
      setCanHaveCustomLabel(true);
    }
  }, [editedColumn]);

  useEffect(() => {
    setPopoverLabel(initialPopoverLabel);
    setPopoverLabelEN(initialPopoverLabelEN); // DODO added 44120742
    setPopoverLabelRU(initialPopoverLabelRU); // DODO added 44120742
    // }, [initialPopoverLabel, popoverVisible]);
  }, [initialPopoverLabel, initialPopoverLabelEN, initialPopoverLabelRU]); // DODO changed 44120742

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
          // setLabel={setPopoverLabel} // DODO commented out 44120742
          getCurrentTab={getCurrentTab}
          isTemporal={isTemporal}
          disabledTabs={disabledTabs}
          // DODO added start 44120742
          setLabel={(value: string) => {
            setPopoverLabel(value);
            setPopoverLabelEN(value);
          }}
          labelEN={popoverLabelEN}
          labelRU={popoverLabelRU}
          setLabelEN={(value: string) => {
            setPopoverLabel(value);
            setPopoverLabelEN(value);
          }}
          setLabelRU={setPopoverLabelRU}
          // DODO added stop 44120742
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
      popoverLabelEN,
      popoverLabelRU,
      disabledTabs,
    ],
  );

  // DODO commented out 44120742
  // const onLabelChange = useCallback(
  //   (e: any) => {
  //     setPopoverLabel(e.target.value);
  //     setHasCustomLabel(true);
  //   },
  //   [setPopoverLabel, setHasCustomLabel],
  // );

  // const popoverTitle = useMemo(
  //   () => (
  //     <DndColumnSelectPopoverTitle
  //       title={popoverLabel}
  //       onChange={onLabelChange}
  //       isEditDisabled={isTitleEditDisabled}
  //       hasCustomLabel={hasCustomLabel}
  //     />
  //   ),
  //   [hasCustomLabel, isTitleEditDisabled, onLabelChange, popoverLabel],
  // );

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
        // title={popoverTitle}
        // DODO changed 44120742
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
