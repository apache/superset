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
import { TableInstance, Row, UseRowSelectRowProps } from 'react-table';
import { styled } from '@apache-superset/core/ui';
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
    justify-content: start;
    grid-gap: ${theme.sizeUnit * 12}px ${theme.sizeUnit * 4}px;
    grid-template-columns: repeat(auto-fit, 300px);
    margin-top: ${theme.sizeUnit * -6}px;
    padding: ${
      showThumbnails
        ? `${theme.sizeUnit * 8 + 3}px ${theme.sizeUnit * 20}px`
        : `${theme.sizeUnit * 8 + 1}px ${theme.sizeUnit * 20}px`
    };

    /* Full-width cards on mobile */
    @media (max-width: 767px) {
      grid-template-columns: 1fr;
      grid-gap: ${theme.sizeUnit * 4}px;
      padding-left: ${theme.sizeUnit * 4}px;
      padding-right: ${theme.sizeUnit * 4}px;
    }
  `}
`;

const CardWrapper = styled.div`
  border: 2px solid transparent;
  &.card-selected {
    border: 2px solid ${({ theme }) => theme.colorPrimary};
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
    toggleRowSelected: (value?: boolean) => void,
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
        Array.from({ length: 25 }, (_, i) => (
          <div key={i}>{renderCard({ loading })}</div>
        ))}
      {rows.length > 0 &&
        rows.map(row => {
          if (!renderCard) return null;
          prepareRow(row);
          return (
            <CardWrapper
              className={cx({
                'card-selected':
                  bulkSelectEnabled &&
                  (row as Row & UseRowSelectRowProps<any>).isSelected,
                'bulk-select': bulkSelectEnabled,
              })}
              key={row.id}
              onClick={e =>
                handleClick(
                  e,
                  (row as Row & UseRowSelectRowProps<any>).toggleRowSelected,
                )
              }
              role="none"
            >
              {renderCard({ ...row.original, loading })}
            </CardWrapper>
          );
        })}
    </CardContainer>
  );
}
