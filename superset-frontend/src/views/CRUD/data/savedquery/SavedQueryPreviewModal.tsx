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
import React, { FunctionComponent } from 'react';
import { styled, t } from '@superset-ui/core';
import Modal from 'src/common/components/Modal';
import Button from 'src/components/Button';
import SyntaxHighlighterCopy from 'src/views/CRUD/data/components/SyntaxHighlighterCopy';
import withToasts, { ToastProps } from 'src/messageToasts/enhancers/withToasts';
import { useQueryPreviewState } from 'src/views/CRUD/data/hooks';

const QueryTitle = styled.div`
  color: ${({ theme }) => theme.colors.secondary.light2};
  font-size: ${({ theme }) => theme.typography.sizes.s - 1}px;
  margin-bottom: 0;
  text-transform: uppercase;
`;

const QueryLabel = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  font-size: ${({ theme }) => theme.typography.sizes.m - 1}px;
  padding: 4px 0 16px 0;
`;

const StyledModal = styled(Modal)`
  .ant-modal-content {
  }

  .ant-modal-body {
    padding: 24px;
  }

  pre {
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;
    font-weight: ${({ theme }) => theme.typography.weights.normal};
    line-height: ${({ theme }) => theme.typography.sizes.l}px;
    height: 375px;
    border: none;
  }
`;

type SavedQueryObject = {
  id: number;
  label: string;
  sql: string;
};

interface SavedQueryPreviewModalProps extends ToastProps {
  fetchData: (id: number) => {};
  onHide: () => void;
  openInSqlLab: (id: number) => {};
  queries: Array<SavedQueryObject>;
  savedQuery: SavedQueryObject;
  show: boolean;
}

const SavedQueryPreviewModal: FunctionComponent<SavedQueryPreviewModalProps> = ({
  fetchData,
  onHide,
  openInSqlLab,
  queries,
  savedQuery,
  show,
  addDangerToast,
  addSuccessToast,
}) => {
  const {
    handleKeyPress,
    handleDataChange,
    disablePrevious,
    disableNext,
  } = useQueryPreviewState<SavedQueryObject>({
    queries,
    currentQueryId: savedQuery.id,
    fetchData,
  });

  return (
    <div role="none" onKeyUp={handleKeyPress}>
      <StyledModal
        onHide={onHide}
        show={show}
        title={t('Query Preview')}
        footer={[
          <Button
            data-test="previous-saved-query"
            key="previous-saved-query"
            disabled={disablePrevious}
            onClick={() => handleDataChange(true)}
          >
            {t('Previous')}
          </Button>,
          <Button
            data-test="next-saved-query"
            key="next-saved-query"
            disabled={disableNext}
            onClick={() => handleDataChange(false)}
          >
            {t('Next')}
          </Button>,
          <Button
            data-test="open-in-sql-lab"
            key="open-in-sql-lab"
            buttonStyle="primary"
            onClick={() => openInSqlLab(savedQuery.id)}
          >
            {t('Open in SQL Lab')}
          </Button>,
        ]}
      >
        <QueryTitle>{t('Query Name')}</QueryTitle>
        <QueryLabel>{savedQuery.label}</QueryLabel>
        <SyntaxHighlighterCopy
          language="sql"
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
        >
          {savedQuery.sql || ''}
        </SyntaxHighlighterCopy>
      </StyledModal>
    </div>
  );
};

export default withToasts(SavedQueryPreviewModal);
