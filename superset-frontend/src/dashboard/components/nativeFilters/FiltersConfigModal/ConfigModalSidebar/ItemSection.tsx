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
import { FC } from 'react';
import ItemTitlePane from '../ItemTitlePane';
import { FilterRemoval } from '../types';

export interface ItemSectionContentProps {
  currentItemId: string;
  items: string[];
  removedItems: Record<string, FilterRemoval>;
  erroredItems: string[];
  getItemTitle: (id: string) => string;
  onChange: (id: string) => void;
  onRearrange: (dragIndex: number, targetIndex: number, itemId: string) => void;
  onRemove: (id: string) => void;
  restoreItem: (id: string) => void;
  dataTestId: string;
  deleteAltText: string;
  dragType: string;
  isCurrentSection: boolean;
  onCrossListDrop?: (
    sourceId: string,
    targetIndex: number,
    sourceType: 'filter' | 'customization',
  ) => void;
}

const ItemSectionContent: FC<ItemSectionContentProps> = ({
  currentItemId,
  items,
  removedItems,
  erroredItems,
  getItemTitle,
  onChange,
  onRearrange,
  onRemove,
  restoreItem,
  dataTestId,
  deleteAltText,
  dragType,
  isCurrentSection,
  onCrossListDrop,
}) => (
  <ItemTitlePane
    currentItemId={isCurrentSection ? currentItemId : ''}
    items={items}
    removedItems={removedItems}
    erroredItems={erroredItems}
    getItemTitle={getItemTitle}
    onChange={onChange}
    onRearrange={onRearrange}
    onRemove={onRemove}
    restoreItem={restoreItem}
    dataTestId={dataTestId}
    deleteAltText={deleteAltText}
    dragType={dragType}
    onCrossListDrop={onCrossListDrop}
  />
);

export default ItemSectionContent;
