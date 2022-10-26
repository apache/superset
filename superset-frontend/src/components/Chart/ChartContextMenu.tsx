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
import React, {
  forwardRef,
  RefObject,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';
import {
  BinaryQueryObjectFilterClause,
  FeatureFlag,
  isFeatureEnabled,
  QueryFormData,
} from '@superset-ui/core';
import { RootState } from 'src/dashboard/types';
import { findPermission } from 'src/utils/findPermission';
import { Menu } from 'src/components/Menu';
import { AntdDropdown as Dropdown } from 'src/components';
import { DrillDetailMenuItems } from './DrillDetail';
import { getMenuAdjustedY } from './utils';

export interface ChartContextMenuProps {
  id: number;
  formData: QueryFormData;
  onSelection: () => void;
  onClose: () => void;
}

export interface Ref {
  open: (
    clientX: number,
    clientY: number,
    filters?: BinaryQueryObjectFilterClause[],
  ) => void;
}

const ChartContextMenu = (
  { id, formData, onSelection, onClose }: ChartContextMenuProps,
  ref: RefObject<Ref>,
) => {
  const canExplore = useSelector((state: RootState) =>
    findPermission('can_explore', 'Superset', state.user?.roles),
  );

  const [{ filters, clientX, clientY }, setState] = useState<{
    clientX: number;
    clientY: number;
    filters?: BinaryQueryObjectFilterClause[];
  }>({ clientX: 0, clientY: 0 });

  const menuItems = [];
  const showDrillToDetail =
    isFeatureEnabled(FeatureFlag.DRILL_TO_DETAIL) && canExplore;

  if (showDrillToDetail) {
    menuItems.push(
      <DrillDetailMenuItems
        chartId={id}
        formData={formData}
        filters={filters}
        isContextMenu
        contextMenuY={clientY}
        onSelection={onSelection}
      />,
    );
  }

  const open = useCallback(
    (
      clientX: number,
      clientY: number,
      filters?: BinaryQueryObjectFilterClause[],
    ) => {
      const itemsCount =
        [
          showDrillToDetail ? 2 : 0, // Drill to detail always has 2 top-level menu items
        ].reduce((a, b) => a + b, 0) || 1; // "No actions" appears if no actions in menu

      const adjustedY = getMenuAdjustedY(clientY, itemsCount);
      setState({
        clientX,
        clientY: adjustedY,
        filters,
      });

      // Since Ant Design's Dropdown does not offer an imperative API
      // and we can't attach event triggers to charts SVG elements, we
      // use a hidden span that gets clicked on when receiving click events
      // from the charts.
      document.getElementById(`hidden-span-${id}`)?.click();
    },
    [id, showDrillToDetail],
  );

  useImperativeHandle(
    ref,
    () => ({
      open,
    }),
    [open],
  );

  return ReactDOM.createPortal(
    <Dropdown
      overlay={
        <Menu>
          {menuItems.length ? (
            menuItems
          ) : (
            <Menu.Item disabled>No actions</Menu.Item>
          )}
        </Menu>
      }
      trigger={['click']}
      onVisibleChange={value => !value && onClose()}
    >
      <span
        id={`hidden-span-${id}`}
        css={{
          visibility: 'hidden',
          position: 'fixed',
          top: clientY,
          left: clientX,
          width: 1,
          height: 1,
        }}
      />
    </Dropdown>,
    document.body,
  );
};

export default forwardRef(ChartContextMenu);
