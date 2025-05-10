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
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { t, styled, css } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { StyledModal } from 'src/components/Modal';
import ErrorBoundary from 'src/components/ErrorBoundary';
import { Form } from 'src/components/Form';
import Footer from 'src/dashboard/components/nativeFilters/FiltersConfigModal/Footer/Footer';
import { CancelConfirmationAlert } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/Footer/CancelConfirmationAlert';
import ChartCustomizationTitlePane from './ChartCustomizationTitlePane';
import ChartCustomizationForm from './ChartCustomizationForm';
import { createDefaultChartCustomizationItem } from './utils';
import { ChartCustomizationItem } from './types';
import RemovedFilter from '../FiltersConfigModal/FiltersConfigForm/RemovedFilter';
import { selectChartCustomizationItems } from './selectors';

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

  const existingItems = useSelector(selectChartCustomizationItems);

  useEffect(() => {
    if (isOpen && !initialLoadComplete) {
      if (existingItems && existingItems.length > 0) {
        setItems(existingItems);

        setCurrentId(existingItems[0].id);
      } else {
        const newItem = createDefaultChartCustomizationItem();
        setCurrentId(newItem.id);
        setItems([newItem]);
      }
      setInitialLoadComplete(true);
    }
  }, [isOpen, initialLoadComplete, existingItems]);

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
              canSave={!form.getFieldsError().some(e => e.errors.length)}
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
                  const timerId = window.setTimeout(() => {
                    setItems(prev => {
                      const updatedItems = prev.filter(i => i.id !== id);
                      return updatedItems;
                    });

                    if (currentId === id) {
                      const nextItem = items.find(
                        i => i.id !== id && !i.removed,
                      );
                      setCurrentId(nextItem?.id || null);
                    }
                  }, 3000);

                  setItems(prev =>
                    prev.map(i =>
                      i.id === id
                        ? { ...i, removed: true, removeTimerId: timerId }
                        : i,
                    ),
                  );

                  if (currentId === id) {
                    const nextItem = items.find(i => i.id !== id && !i.removed);
                    setCurrentId(nextItem?.id || id);
                  }
                } else {
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
                    if (currentItem.removeTimerId) {
                      clearTimeout(currentItem.removeTimerId);
                    }
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
