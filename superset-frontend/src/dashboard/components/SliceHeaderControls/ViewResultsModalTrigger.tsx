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
import { ReactChild, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { css, t, useTheme } from '@superset-ui/core';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';

export const ViewResultsModalTrigger = ({
  canExplore,
  exploreUrl,
  triggerNode,
  modalTitle,
  modalBody,
  showModal = false,
  setShowModal,
}: {
  canExplore?: boolean;
  exploreUrl: string;
  triggerNode: ReactChild;
  modalTitle: ReactChild;
  modalBody: ReactChild;
  showModal: boolean;
  setShowModal: (showModal: boolean) => void;
}) => {
  const history = useHistory();
  const exploreChart = () => history.push(exploreUrl);
  const theme = useTheme();
  const openModal = useCallback(() => setShowModal(true), [setShowModal]);
  const closeModal = useCallback(() => setShowModal(false), [setShowModal]);

  return (
    <>
      <span
        data-test="span-modal-trigger"
        onClick={openModal}
        role="button"
        tabIndex={0}
      >
        {triggerNode}
      </span>
      {(() => (
        <Modal
          css={css`
            .ant-modal-body {
              display: flex;
              flex-direction: column;
            }
          `}
          show={showModal}
          onHide={closeModal}
          closable
          title={modalTitle}
          footer={
            <>
              <Button
                buttonStyle="secondary"
                buttonSize="small"
                onClick={exploreChart}
                disabled={!canExplore}
                tooltip={
                  !canExplore
                    ? t(
                        'You do not have sufficient permissions to edit the chart',
                      )
                    : undefined
                }
              >
                {t('Edit chart')}
              </Button>
              <Button
                buttonStyle="primary"
                buttonSize="small"
                onClick={closeModal}
                css={css`
                  margin-left: ${theme.gridUnit * 2}px;
                `}
              >
                {t('Close')}
              </Button>
            </>
          }
          responsive
          resizable
          resizableConfig={{
            minHeight: theme.gridUnit * 128,
            minWidth: theme.gridUnit * 128,
            defaultSize: {
              width: 'auto',
              height: '75vh',
            },
          }}
          draggable
          destroyOnClose
        >
          {modalBody}
        </Modal>
      ))()}
    </>
  );
};
