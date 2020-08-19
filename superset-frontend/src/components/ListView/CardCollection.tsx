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
import { TableInstance } from 'react-table';
import styled from '@superset-ui/style';

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
`;

export default function CardCollection({
  bulkSelectEnabled,
  loading,
  prepareRow,
  renderCard,
  rows,
}: CardCollectionProps) {
  function handleClick(event: React.FormEvent, onClick: any) {
    if (bulkSelectEnabled) {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    }
  }

  return (
    <CardContainer>
      {rows.map(row => {
        if (!renderCard) return null;
        prepareRow(row);
        return (
          <CardWrapper
            className={
              row.isSelected && bulkSelectEnabled ? 'card-selected' : ''
            }
            key={row.id}
            onClick={e => handleClick(e, row.toggleRowSelected())}
            role="none"
          >
            {renderCard({ ...row.original, loading })}
          </CardWrapper>
        );
      })}
    </CardContainer>
  );
}
