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

import { ReactNode, CSSProperties } from 'react';
import { css, truncationCSS, useCSSTextTruncation } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { Tooltip } from 'src/components/Tooltip';
import { MenuItemProps } from 'antd-v5';

export type MenuItemWithTruncationProps = {
  tooltipText: ReactNode;
  children: ReactNode;
  onClick?: MenuItemProps['onClick'];
  style?: CSSProperties;
  menuKey?: string;
};

export const MenuItemWithTruncation = ({
  tooltipText,
  children,
  onClick,
  style,
  menuKey,
}: MenuItemWithTruncationProps) => {
  const [itemRef, itemIsTruncated] = useCSSTextTruncation<HTMLDivElement>();

  return (
    <Menu.Item
      css={css`
        display: flex;
        line-height: 1.5em;
      `}
      eventKey={menuKey}
      onClick={onClick}
      style={style}
    >
      <Tooltip title={itemIsTruncated ? tooltipText : null}>
        <div
          ref={itemRef}
          css={css`
            max-width: 100%;
            ${truncationCSS};
          `}
        >
          {children}
        </div>
      </Tooltip>
    </Menu.Item>
  );
};
