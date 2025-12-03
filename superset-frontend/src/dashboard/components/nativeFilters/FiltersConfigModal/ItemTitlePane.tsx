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
import { useRef, FC } from 'react';

import { styled } from '@apache-superset/core/ui';

import ItemTitleContainer from './ItemTitleContainer';
import { FilterRemoval } from './types';

interface Props {
  restoreItem: (id: string) => void;
  getItemTitle: (id: string) => string;
  onRearrange: (dragIndex: number, targetIndex: number, itemId: string) => void;
  onRemove: (id: string) => void;
  onChange: (id: string) => void;
  removedItems: Record<string, FilterRemoval>;
  currentItemId: string;
  items: string[];
  erroredItems: string[];
  dataTestId?: string;
  deleteAltText?: string;
  dragType?: string;
  onCrossListDrop?: (
    sourceId: string,
    targetIndex: number,
    sourceType: 'filter' | 'customization',
  ) => void;
}

const TabsContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
  padding-top: 2px;
`;

const ItemTitlePane: FC<Props> = ({
  getItemTitle,
  onChange,
  onRemove,
  onRearrange,
  restoreItem,
  currentItemId,
  items,
  removedItems,
  erroredItems,
  dataTestId,
  deleteAltText,
  dragType,
  onCrossListDrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <TabsContainer>
      <ItemTitleContainer
        ref={containerRef}
        items={items}
        currentItemId={currentItemId}
        removedItems={removedItems}
        getItemTitle={getItemTitle}
        erroredItems={erroredItems}
        onChange={onChange}
        onRemove={onRemove}
        onRearrange={onRearrange}
        restoreItem={restoreItem}
        dataTestId={dataTestId}
        deleteAltText={deleteAltText}
        dragType={dragType}
        onCrossListDrop={onCrossListDrop}
      />
    </TabsContainer>
  );
};

export default ItemTitlePane;
