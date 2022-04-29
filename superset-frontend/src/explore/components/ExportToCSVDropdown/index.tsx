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
import React, { ReactChild, useCallback } from 'react';
import { t, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';

enum MENU_KEYS {
  EXPORT_ORIGINAL = 'export_original',
  EXPORT_PIVOTED = 'export_pivoted',
}

interface ExportToCSVButtonProps {
  exportCSVOriginal: () => void;
  exportCSVPivoted: () => void;
  children: ReactChild;
}

const MenuItemContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;

  span[role='img'] {
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    margin-left: ${({ theme }) => theme.gridUnit * 4}px;
  }
`;

export const ExportToCSVDropdown = ({
  exportCSVOriginal,
  exportCSVPivoted,
  children,
}: ExportToCSVButtonProps) => {
  const handleMenuClick = useCallback(
    ({ key }: { key: React.Key }) => {
      switch (key) {
        case MENU_KEYS.EXPORT_ORIGINAL:
          exportCSVOriginal();
          break;
        case MENU_KEYS.EXPORT_PIVOTED:
          exportCSVPivoted();
          break;
        default:
          break;
      }
    },
    [exportCSVPivoted, exportCSVOriginal],
  );

  return (
    <AntdDropdown
      trigger={['click']}
      overlay={
        <Menu onClick={handleMenuClick} selectable={false}>
          <Menu.Item key={MENU_KEYS.EXPORT_ORIGINAL}>
            <MenuItemContent>
              {t('Original')}
              <Icons.Download />
            </MenuItemContent>
          </Menu.Item>
          <Menu.Item key={MENU_KEYS.EXPORT_PIVOTED}>
            <MenuItemContent>
              {t('Pivoted')}
              <Icons.Download />
            </MenuItemContent>
          </Menu.Item>
        </Menu>
      }
    >
      {children}
    </AntdDropdown>
  );
};
