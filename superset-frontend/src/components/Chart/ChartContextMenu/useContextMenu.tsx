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
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { BaseFormData, ContextMenuFilters } from '@superset-ui/core';
import ChartContextMenu, {
  ChartContextMenuRef,
  ContextMenuItem,
} from './ChartContextMenu';

export const useContextMenu = (
  chartId: number,
  formData: BaseFormData & { [key: string]: any },
  onSelection?: (...args: any) => void,
  displayedItems?: ContextMenuItem[] | ContextMenuItem,
  additionalConfig?: {
    crossFilter?: Record<string, any>;
    drillToDetail?: Record<string, any>;
    drillBy?: Record<string, any>;
  },
) => {
  const contextMenuRef = useRef<ChartContextMenuRef>(null);
  const [inContextMenu, setInContextMenu] = useState(false);
  const onContextMenu = (
    offsetX: number,
    offsetY: number,
    filters: ContextMenuFilters,
  ) => {
    contextMenuRef.current?.open(offsetX, offsetY, filters);
    setInContextMenu(true);
  };

  const handleContextMenuSelected = useCallback(
    (...args: any) => {
      setInContextMenu(false);
      onSelection?.(...args);
    },
    [onSelection],
  );

  const handleContextMenuClosed = useCallback(() => {
    setInContextMenu(false);
  }, []);

  const contextMenu = useMemo(
    () => (
      <ChartContextMenu
        ref={contextMenuRef}
        id={chartId}
        formData={formData}
        onSelection={handleContextMenuSelected}
        onClose={handleContextMenuClosed}
        displayedItems={displayedItems}
        additionalConfig={additionalConfig}
      />
    ),
    [
      additionalConfig,
      chartId,
      displayedItems,
      formData,
      handleContextMenuClosed,
      handleContextMenuSelected,
    ],
  );
  return { contextMenu, inContextMenu, onContextMenu };
};
