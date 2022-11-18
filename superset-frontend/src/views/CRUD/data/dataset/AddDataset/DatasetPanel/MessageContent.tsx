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

const StyledContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 8}px
    ${({ theme }) => theme.gridUnit * 6}px;

  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const StyledEmptyStateBig = styled(EmptyStateBig)`
  max-width: 50%;

  p {
    width: ${({ theme }) => theme.gridUnit * 115}px;
  }
`;

export const SELECT_MESSAGE = t(
  'Datasets can be created from database tables or SQL queries. Select a database table to the left or ',
);
export const CREATE_MESSAGE = t('create dataset from SQL query');
export const VIEW_DATASET_MESSAGE = t(
  ' to open SQL Lab. From there you can save the query as a dataset.',
);

const renderEmptyDescription = () => (
  <>
    {SELECT_MESSAGE}
    <span
      role="button"
      onClick={() => {
        window.location.href = `/superset/sqllab`;
      }}
      tabIndex={0}
    >
      {CREATE_MESSAGE}
    </span>
    {VIEW_DATASET_MESSAGE}
  </>
);

export const SELECT_TABLE_TITLE = t('Select dataset source');
export const NO_COLUMNS_TITLE = t('No table columns');
export const NO_COLUMNS_DESCRIPTION = t(
  'This database table does not contain any data. Please select a different table.',
);
export const ERROR_TITLE = t('An Error Occurred');
export const ERROR_DESCRIPTION = t(
  'Unable to load columns for the selected table. Please select a different table.',
);

interface MessageContentProps {
  hasError: boolean;
  tableName?: string | null;
  hasColumns: boolean;
}

export const MessageContent = (props: MessageContentProps) => {
  const { hasError, tableName, hasColumns } = props;
  let currentImage: string | undefined = 'empty-dataset.svg';
  let currentTitle = SELECT_TABLE_TITLE;
  let currentDescription = renderEmptyDescription();
  if (hasError) {
    currentTitle = ERROR_TITLE;
    currentDescription = <>{ERROR_DESCRIPTION}</>;
    currentImage = undefined;
  } else if (tableName && !hasColumns) {
    currentImage = 'no-columns.svg';
    currentTitle = NO_COLUMNS_TITLE;
    currentDescription = <>{NO_COLUMNS_DESCRIPTION}</>;
  }
  return (
    <StyledContainer>
      <StyledEmptyStateBig
        image={currentImage}
        title={currentTitle}
        description={currentDescription}
      />
    </StyledContainer>
  );
};

export default MessageContent;
