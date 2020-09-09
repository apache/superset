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
import { TableInstance, Row } from 'react-table';
import { styled } from '@superset-ui/core';
import cx from 'classnames';

interface CardCollectionProps {
  bulkSelectEnabled?: boolean;
  loading: boolean;
  prepareRow: TableInstance['prepareRow'];
  renderCard?: (row: any) => React.ReactNode;
  rows: TableInstance['rows'];
}

const CardContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(459px, max-content));
  grid-gap: ${({ theme }) => theme.gridUnit * 8}px;
  justify-content: center;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 4}px;
`;

const CardWrapper = styled.div`
  border: 2px solid transparent;
  &.card-selected {
    border: 2px solid ${({ theme }) => theme.colors.primary.base};
  }
  &.bulk-select {
    cursor: pointer;
  }
`;

export default function CardCollection({
  bulkSelectEnabled,
  loading,
  prepareRow,
  renderCard,
  rows,
}: CardCollectionProps) {
  function handleClick(
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    toggleRowSelected: Row['toggleRowSelected'],
  ) {
    if (bulkSelectEnabled) {
      event.preventDefault();
      event.stopPropagation();
      toggleRowSelected();
    }
  }

  if (!renderCard) return null;
  return (
    <CardContainer>
      {loading &&
        rows.length === 0 &&
        [...new Array(25)].map((e, i) => {
          return <div key={i}>{renderCard({ loading })}</div>;
        })}
      {rows.length > 0 &&
        rows.map(row => {
          if (!renderCard) return null;
          prepareRow(row);
          return (
            <CardWrapper
              className={cx({
                'card-selected': bulkSelectEnabled && row.isSelected,
                'bulk-select': bulkSelectEnabled,
              })}
              key={row.id}
              onClick={e => handleClick(e, row.toggleRowSelected)}
              role="none"
            >
              {renderCard({ ...row.original, loading })}
            </CardWrapper>
          );
        })}
    </CardContainer>
  );
}
