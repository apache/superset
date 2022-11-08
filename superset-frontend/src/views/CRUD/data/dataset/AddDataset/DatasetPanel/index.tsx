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
import React from 'react';
import { supersetTheme, t, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { EmptyStateBig } from 'src/components/EmptyState';

type DatasetPanelProps = {
  tableName?: string | null;
};

const StyledEmptyStateBig = styled(EmptyStateBig)`
  p {
    width: ${({ theme }) => theme.gridUnit * 115}px;
  }
`;

const StyledDatasetPanel = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 8}px
    ${({ theme }) => theme.gridUnit * 6}px;

  .table-name {
    font-size: ${({ theme }) => theme.gridUnit * 6}px;
    font-weight: ${({ theme }) => theme.typography.weights.medium};
    padding-bottom: ${({ theme }) => theme.gridUnit * 20}px;
    margin: 0;

    .anticon:first-of-type {
      margin-right: ${({ theme }) => theme.gridUnit * 4}px;
    }

    .anticon:nth-of-type(2) {
      margin-left: ${({ theme }) => theme.gridUnit * 4}px;
    }
  }

  span {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
`;

const renderEmptyDescription = () => (
  <>
    {t(
      'Datasets can be created from database tables or SQL queries. Select a database table to the left or ',
    )}
    <span
      role="button"
      onClick={() => {
        window.location.href = `/superset/sqllab`;
      }}
      tabIndex={0}
    >
      {t('create dataset from SQL query')}
    </span>
    {t(' to open SQL Lab. From there you can save the query as a dataset.')}
  </>
);

const DatasetPanel = ({ tableName }: DatasetPanelProps) =>
  tableName ? (
    <StyledDatasetPanel>
      <div className="table-name">
        <Icons.Table iconColor={supersetTheme.colors.grayscale.base} />
        {tableName}
      </div>
      <span>{t('Table columns')}</span>
    </StyledDatasetPanel>
  ) : (
    <StyledEmptyStateBig
      image="empty-dataset.svg"
      title={t('Select dataset source')}
      description={renderEmptyDescription()}
    />
  );

export default DatasetPanel;
