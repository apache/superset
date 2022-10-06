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
import { QueryObjectFilterClause, t, styled } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { AntdDropdown as Dropdown } from 'src/components';
import ReactDOM from 'react-dom';

const MENU_ITEM_HEIGHT = 32;
const MENU_VERTICAL_SPACING = 32;

export interface ChartContextMenuProps {
  id: string;
  onSelection: (filters: QueryObjectFilterClause[]) => void;
  onClose: () => void;
}

export interface Ref {
  open: (
    filters: QueryObjectFilterClause[],
    clientX: number,
    clientY: number,
  ) => void;
}

const Filter = styled.span`
  ${({ theme }) => `
    font-weight: ${theme.typography.weights.bold};
    color: ${theme.colors.primary.base};
  `}
`;

const ChartContextMenu = (
  { id, onSelection, onClose }: ChartContextMenuProps,
  ref: RefObject<Ref>,
) => {
  const [state, setState] = useState<{
    filters: QueryObjectFilterClause[];
    clientX: number;
    clientY: number;
  }>({ filters: [], clientX: 0, clientY: 0 });

  const menu = (
    <Menu>
      {state.filters.map((filter, i) => (
        <Menu.Item key={i} onClick={() => onSelection([filter])}>
          {`${t('Drill to detail by')} `}
          <Filter>{filter.formattedVal}</Filter>
        </Menu.Item>
      ))}
      {state.filters.length === 0 && (
        <Menu.Item key="none" onClick={() => onSelection([])}>
          {t('Drill to detail')}
        </Menu.Item>
      )}
      {state.filters.length > 1 && (
        <Menu.Item key="all" onClick={() => onSelection(state.filters)}>
          {`${t('Drill to detail by')} `}
          <Filter>{t('all')}</Filter>
        </Menu.Item>
      )}
    </Menu>
  );

  const open = useCallback(
    (filters: QueryObjectFilterClause[], clientX: number, clientY: number) => {
      // Viewport height
      const vh = Math.max(
        document.documentElement.clientHeight || 0,
        window.innerHeight || 0,
      );

      // +1 for automatically added options such as 'All' and 'Drill to detail'
      const itemsCount = filters.length + 1;
      const menuHeight = MENU_ITEM_HEIGHT * itemsCount + MENU_VERTICAL_SPACING;
      // Always show the context menu inside the viewport
      const adjustedY = vh - clientY < menuHeight ? vh - menuHeight : clientY;

      setState({ filters, clientX, clientY: adjustedY });

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
          top: state.clientY,
          left: state.clientX,
          width: 1,
          height: 1,
        }}
      />
    </Dropdown>,
    document.body,
  );
};

export default forwardRef(ChartContextMenu);
