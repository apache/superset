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
import { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import { TableInstance, Row } from 'react-table';
import { styled } from '@superset-ui/core';
import cx from 'classnames';

interface CardCollectionProps {
  bulkSelectEnabled?: boolean;
  loading: boolean;
  prepareRow: TableInstance['prepareRow'];
  renderCard?: (row: any) => ReactNode;
  rows: TableInstance['rows'];
  showThumbnails?: boolean;
}

const CardContainer = styled.div<{ showThumbnails?: boolean }>`
  ${({ theme, showThumbnails }) => `
    display: grid;
    grid-gap: ${theme.gridUnit * 12}px ${theme.gridUnit * 4}px;
    grid-template-columns: repeat(auto-fit, 300px);
    margin-top: ${theme.gridUnit * -6}px;
    padding: ${
      showThumbnails
        ? `${theme.gridUnit * 8 + 3}px ${theme.gridUnit * 9}px`
        : `${theme.gridUnit * 8 + 1}px ${theme.gridUnit * 9}px`
    };
  `}
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
  showThumbnails,
}: CardCollectionProps) {
  function handleClick(
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
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
    <CardContainer showThumbnails={showThumbnails}>
      {loading &&
        rows.length === 0 &&
        [...new Array(25)].map((e, i) => (
          <div key={i}>{renderCard({ loading })}</div>
        ))}
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
