import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { t, styled, css } from '@superset-ui/core';
import { StyledModal } from 'src/components/Modal';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { Form } from 'src/components/Form';
import Footer from 'src/dashboard/components/nativeFilters/FiltersConfigModal/Footer/Footer';
import { CancelConfirmationAlert } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/Footer/CancelConfirmationAlert';
import ChartCustomizationTitlePane from './ChartCustomizationTitlePane';
import ChartCustomizationForm from './ChartCustomizationForm';
import { generateGroupById } from './utils';
import { ChartCustomizationItem } from './types';
import RemovedFilter from '../FiltersConfigModal/FiltersConfigForm/RemovedFilter';

const MIN_WIDTH = 880;
const MODAL_MARGIN = 16;

const StyledModalWrapper = styled(StyledModal)<{ expanded: boolean }>`
  min-width: ${MIN_WIDTH}px;
  width: ${({ expanded }) => (expanded ? '100%' : MIN_WIDTH)} !important;

  @media (max-width: ${MIN_WIDTH + MODAL_MARGIN * 2}px) {
    width: 100% !important;
    min-width: auto;
  }

  .antd5-modal-body {
    padding: 0px;
  }

  ${({ expanded }) =>
    expanded &&
    css`
      height: 100%;
      .antd5-modal-body {
        flex: 1 1 auto;
      }
      .antd5-modal-content {
        height: 100%;
      }
    `}
`;

const StyledModalBody = styled.div<{ expanded: boolean }>`
  display: flex;
  height: ${({ expanded }) => (expanded ? '100%' : '700px')};
  flex-direction: row;
  flex: 1;
`;

const ContentArea = styled.div`
  flex-grow: 3;
  overflow-y: auto;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const Sidebar = styled.div`
  width: ${({ theme }) => theme.gridUnit * 60}px;
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

export interface ChartCustomizationModalProps {
  isOpen: boolean;
  dashboardId: number;
  onCancel: () => void;
  onSave: (dashboardId: number, items: ChartCustomizationItem[]) => void;
}

const ChartCustomizationModal = ({
  isOpen,
  dashboardId,
  onCancel,
  onSave,
}: ChartCustomizationModalProps) => {
  const [expanded] = useState(false);
  const [form] = Form.useForm();
  const [items, setItems] = useState<ChartCustomizationItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saveAlertVisible, setSaveAlertVisible] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const currentItem = useMemo(
    () => items.find(i => i.id === currentId),
    [items, currentId],
  );

  const handleSave = useCallback(() => {
    form.validateFields().then(() => {
      onSave(dashboardId, items);
      onCancel();
    });
  }, [form, items, onSave, onCancel, dashboardId]);

  const handleConfirmCancel = () => {
    setSaveAlertVisible(false);
    onCancel();
  };

  // This effect runs once when the modal is opened
  useEffect(() => {
    if (isOpen && items.length === 0 && !initialLoadComplete) {
      const newItem: ChartCustomizationItem = {
        id: generateGroupById(),
        title: t('[untitled]'),
        dataset: null,
        description: '',
        settings: {
          sortFilter: false,
          hasDefaultValue: false,
          isRequired: false,
          selectFirstByDefault: false,
        },
        customization: {
          name: '',
          dataset: null,
          sortAscending: true,
          defaultValue: undefined,
          hasDefaultValue: false,
          isRequired: false,
          selectFirst: false,
        },
      };
      setItems([newItem]);
      setCurrentId(newItem.id);
      setInitialLoadComplete(true);
    }
  }, [isOpen, items.length, initialLoadComplete]);

  // Reset initialLoadComplete when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setInitialLoadComplete(false);
    }
  }, [isOpen]);

  return (
    <StyledModalWrapper
      open={isOpen}
      onCancel={() => setSaveAlertVisible(true)}
      onOk={handleSave}
      title={t('Chart customization')}
      expanded={expanded}
      destroyOnClose
      centered
      maskClosable={false}
      footer={
        <div
          css={css`
            display: flex;
            justify-content: flex-end;
            align-items: flex-end;
          `}
        >
          {saveAlertVisible ? (
            <CancelConfirmationAlert
              title={t('There are unsaved changes.')}
              onConfirm={handleConfirmCancel}
              onDismiss={() => setSaveAlertVisible(false)}
            >
              {t('Are you sure you want to cancel?')}
            </CancelConfirmationAlert>
          ) : (
            <Footer
              onDismiss={() => setSaveAlertVisible(false)}
              onCancel={() => setSaveAlertVisible(true)}
              handleSave={handleSave}
              canSave
              saveAlertVisible={false}
              onConfirmCancel={handleConfirmCancel}
            />
          )}
        </div>
      }
    >
      <ErrorBoundary>
        <StyledModalBody expanded={expanded}>
          <Sidebar>
            <ChartCustomizationTitlePane
              items={items}
              currentId={currentId}
              setCurrentId={setCurrentId}
              onChange={setCurrentId}
              onAdd={item => {
                setItems([...items, item]);
                setCurrentId(item.id);
              }}
              onRemove={(id, shouldRemove) => {
                if (shouldRemove) {
                  // Soft delete and schedule full removal
                  const timerId = window.setTimeout(() => {
                    setItems(prev => {
                      const updatedItems = prev.filter(i => i.id !== id);
                      return updatedItems;
                    });

                    // If the deleted item was selected, clear the selection
                    if (currentId === id) {
                      setCurrentId(null);
                    }
                  }, 3000);

                  setItems(prev =>
                    prev.map(i =>
                      i.id === id
                        ? { ...i, removed: true, removeTimerId: timerId }
                        : i,
                    ),
                  );

                  // If current item is deleted, we still want to show the removed state
                  if (currentId === id) {
                    // Temporarily set to null to trigger a re-render
                    setCurrentId(null);
                    // Then set it back to show the removed state
                    setTimeout(() => setCurrentId(id), 0);
                  }
                } else {
                  // Undo deletion
                  setItems(prev =>
                    prev.map(i => {
                      if (i.id === id) {
                        if (i.removeTimerId) {
                          clearTimeout(i.removeTimerId);
                        }
                        return {
                          ...i,
                          removed: false,
                          removeTimerId: undefined,
                        };
                      }
                      return i;
                    }),
                  );

                  // If the restored item was previously selected, reselect it
                  if (currentId === null) {
                    setCurrentId(id);
                  }
                }
              }}
            />
          </Sidebar>

          <ContentArea>
            {currentItem &&
              (currentItem.removed ? (
                <RemovedFilter
                  onClick={() => {
                    // Clear the timeout to prevent actual removal
                    if (currentItem.removeTimerId) {
                      clearTimeout(currentItem.removeTimerId);
                    }

                    // Update item to restore it
                    setItems(prev =>
                      prev.map(i =>
                        i.id === currentItem.id
                          ? { ...i, removed: false, removeTimerId: undefined }
                          : i,
                      ),
                    );
                  }}
                />
              ) : (
                <ChartCustomizationForm
                  form={form}
                  item={currentItem}
                  onUpdate={updatedItem => {
                    setItems(prev =>
                      prev.map(i =>
                        i.id === updatedItem.id ? updatedItem : i,
                      ),
                    );
                  }}
                />
              ))}
          </ContentArea>
        </StyledModalBody>
      </ErrorBoundary>
    </StyledModalWrapper>
  );
};
export default memo(ChartCustomizationModal);
