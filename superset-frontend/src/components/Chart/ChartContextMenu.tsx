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
import { FeatureFlag, isFeatureEnabled, SqlaFormData } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { AntdDropdown as Dropdown } from 'src/components';
import ReactDOM from 'react-dom';
import { DrillDetailMenuItems } from './DrillDetail';
import { ContextMenuPayload } from './types';

const MENU_ITEM_HEIGHT = 32;
const MENU_VERTICAL_SPACING = 32;

export interface ChartContextMenuProps {
  id: number;
  formData: SqlaFormData;
  onSelection: () => void;
  onClose: () => void;
}

export interface Ref {
  open: (
    clientX: number,
    clientY: number,
    payload?: ContextMenuPayload,
  ) => void;
}

const ChartContextMenu = (
  { id, formData, onSelection, onClose }: ChartContextMenuProps,
  ref: RefObject<Ref>,
) => {
  const [{ clientX, clientY, payload }, setState] = useState<{
    clientX: number;
    clientY: number;
    payload?: ContextMenuPayload;
  }>({ clientX: 0, clientY: 0 });

  const menu = (
    <Menu>
      {isFeatureEnabled(FeatureFlag.DRILL_TO_DETAIL) && (
        <DrillDetailMenuItems
          chartId={id}
          formData={formData}
          isContextMenu
          contextPayload={payload}
          onSelection={onSelection}
        />
      )}
      {/* Include additional menu content here */}
    </Menu>
  );

  const open = useCallback(
    (clientX: number, clientY: number, payload?: ContextMenuPayload) => {
      // Viewport height
      const vh = Math.max(
        document.documentElement.clientHeight || 0,
        window.innerHeight || 0,
      );

      const itemsCount = [
        2, // Drill to detail always has 2 top-level menu items
        // Include additional menu item counts here
      ].reduce((a, b) => a + b, 0);

      const menuHeight = MENU_ITEM_HEIGHT * itemsCount + MENU_VERTICAL_SPACING;
      // Always show the context menu inside the viewport
      const adjustedY = vh - clientY < menuHeight ? vh - menuHeight : clientY;

      setState({ clientX, clientY: adjustedY, payload });

      // Since Ant Design's Dropdown does not offer an imperative API
      // and we can't attach event triggers to charts SVG elements, we
      // use a hidden span that gets clicked on when receiving click events
      // from the charts.
      document.getElementById(`hidden-span-${id}`)?.click();
    },
    [id],
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
      overlay={menu}
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
