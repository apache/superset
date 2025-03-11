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
import { ReactChild, RefObject, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { css, t, useTheme } from '@superset-ui/core';
import Button from 'src/components/Button';
import ModalTrigger from 'src/components/ModalTrigger';

export const ViewResultsModalTrigger = ({
  canExplore,
  exploreUrl,
  triggerNode,
  modalTitle,
  modalBody,
  modalRef,
}: {
  canExplore?: boolean;
  exploreUrl: string;
  triggerNode: ReactChild;
  modalTitle: string;
  modalBody: ReactChild;
  modalRef?: RefObject<any>;
}) => {
  const history = useHistory();
  const exploreChart = () => history.push(exploreUrl);
  const theme = useTheme();
  const handleCloseModal = useCallback(() => {
    modalRef?.current?.close();
  }, [modalRef]);
  return (
    <ModalTrigger
      ref={modalRef}
      triggerNode={triggerNode}
      modalTitle={modalTitle}
      modalBody={modalBody}
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
      modalFooter={
        <>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={exploreChart}
            disabled={!canExplore}
            tooltip={
              !canExplore
                ? t('You do not have sufficient permissions to edit the chart')
                : undefined
            }
          >
            {t('Edit chart')}
          </Button>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            onClick={handleCloseModal}
            css={css`
              margin-left: ${theme.gridUnit * 2}px;
            `}
          >
            {t('Close')}
          </Button>
        </>
      }
    />
  );
};
