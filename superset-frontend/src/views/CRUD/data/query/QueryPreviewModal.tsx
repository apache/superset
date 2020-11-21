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
import React, { useState } from 'react';
import { styled, t } from '@superset-ui/core';
import Modal from 'src/common/components/Modal';
import cx from 'classnames';
import Button from 'src/components/Button';
import withToasts, { ToastProps } from 'src/messageToasts/enhancers/withToasts';
import SyntaxHighlighterCopy from 'src/views/CRUD/data/components/SyntaxHighlighterCopy';
import { useQueryPreviewState } from 'src/views/CRUD/data/hooks';
import { QueryObject } from 'src/views/CRUD/types';

const QueryTitle = styled.div`
  color: ${({ theme }) => theme.colors.secondary.light2};
  font-size: ${({ theme }) => theme.typography.sizes.s - 1}px;
  margin-bottom: 0;
  text-transform: uppercase;
`;

const QueryLabel = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  font-size: ${({ theme }) => theme.typography.sizes.m - 1}px;
  padding: 4px 0 24px 0;
`;

const QueryViewToggle = styled.div`
  margin: 0 0 ${({ theme }) => theme.gridUnit * 6}px 0;
`;

const TabButton = styled.div`
  display: inline;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
  margin-right: ${({ theme }) => theme.gridUnit * 4}px;
  color: ${({ theme }) => theme.colors.secondary.dark1};

  &.active,
  &:focus,
  &:hover {
    background: ${({ theme }) => theme.colors.secondary.light4};
    border-bottom: none;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }

  &:hover:not(.active) {
    background: ${({ theme }) => theme.colors.secondary.light5};
  }
`;
const StyledModal = styled(Modal)`
  .ant-modal-body {
    padding: ${({ theme }) => theme.gridUnit * 6}px;
  }

  pre {
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;
    font-weight: ${({ theme }) => theme.typography.weights.normal};
    line-height: ${({ theme }) => theme.typography.sizes.l}px;
    height: 375px;
    border: none;
  }
`;

interface QueryPreviewModalProps extends ToastProps {
  onHide: () => void;
  openInSqlLab: (id: number) => any;
  queries: QueryObject[];
  query: QueryObject;
  fetchData: (id: number) => any;
  show: boolean;
}

function QueryPreviewModal({
  onHide,
  openInSqlLab,
  queries,
  query,
  fetchData,
  show,
  addDangerToast,
  addSuccessToast,
}: QueryPreviewModalProps) {
  const {
    handleKeyPress,
    handleDataChange,
    disablePrevious,
    disableNext,
  } = useQueryPreviewState<QueryObject>({
    queries,
    currentQueryId: query.id,
    fetchData,
  });

  const [currentTab, setCurrentTab] = useState<'user' | 'executed'>('user');

  const { id, sql, executed_sql } = query;
  return (
    <div role="none" onKeyUp={handleKeyPress}>
      <StyledModal
        onHide={onHide}
        show={show}
        title={t('Query Preview')}
        footer={[
          <Button
            data-test="previous-query"
            key="previous-query"
            disabled={disablePrevious}
            onClick={() => handleDataChange(true)}
          >
            {t('Previous')}
          </Button>,
          <Button
            data-test="next-query"
            key="next-query"
            disabled={disableNext}
            onClick={() => handleDataChange(false)}
          >
            {t('Next')}
          </Button>,
          <Button
            data-test="open-in-sql-lab"
            key="open-in-sql-lab"
            buttonStyle="primary"
            onClick={() => openInSqlLab(id)}
          >
            {t('Open in SQL Lab')}
          </Button>,
        ]}
      >
        <QueryTitle>{t('Tab Name')}</QueryTitle>
        <QueryLabel>{query.tab_name}</QueryLabel>
        <QueryViewToggle>
          <TabButton
            role="button"
            data-test="toggle-user-sql"
            className={cx({ active: currentTab === 'user' })}
            onClick={() => setCurrentTab('user')}
          >
            {t('User query')}
          </TabButton>
          <TabButton
            role="button"
            data-test="toggle-executed-sql"
            className={cx({ active: currentTab === 'executed' })}
            onClick={() => setCurrentTab('executed')}
          >
            {t('Executed query')}
          </TabButton>
        </QueryViewToggle>
        <SyntaxHighlighterCopy
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
          language="sql"
        >
          {(currentTab === 'user' ? sql : executed_sql) || ''}
        </SyntaxHighlighterCopy>
      </StyledModal>
    </div>
  );
}

export default withToasts(QueryPreviewModal);
