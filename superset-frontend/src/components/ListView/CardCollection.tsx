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

interface Props {
  renderCard?: (row: any) => React.ReactNode;
  prepareRow: TableInstance['prepareRow'];
  rows: TableInstance['rows'];
  loading: boolean;
}

const CardContainer = styled.div`
  justify-content: space-between;
  flex-wrap: wrap;
  display: flex;
  padding: 8px 16px;
`;

const CardWrapper = styled.div`
  display: inline-block;
  margin: 16px;
`;

export default function CardCollection({
  renderCard,
  prepareRow,
  rows,
  loading,
}: Props) {
  return (
    <CardContainer>
      {rows.map(row => {
        if (!renderCard) return null;
        prepareRow(row);
        return (
          <CardWrapper key={row.id}>
            {renderCard({ ...row.original, loading })}
          </CardWrapper>
        );
      })}
    </CardContainer>
  );
}
