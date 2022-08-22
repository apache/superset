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
import { t, styled } from '@superset-ui/core';
import { EmptyStateBig } from 'src/components/EmptyState';

const StyledEmptyStateBig = styled(EmptyStateBig)`
  p {
    width: ${({ theme }) => theme.gridUnit * 115}px;
  }
`;

const renderDescription = () => (
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

export default function DatasetPanel() {
  return (
    <StyledEmptyStateBig
      image="empty-dataset.svg"
      title={t('Select dataset source')}
      description={renderDescription()}
    />
  );
}
