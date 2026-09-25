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
import { ReactNode } from 'react';
import {
  Button,
  Dropdown,
  Icons,
  type ButtonProps,
  type DropdownProps,
} from '@superset-ui/core/components';
import type { MenuItem } from '@superset-ui/core/components/Menu';

export interface KebabMenuButtonProps {
  menuItems: MenuItem[];
  icon?: ReactNode;
  iconOrientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  dataTest?: string;
  buttonId?: string;
  buttonSize?: ButtonProps['buttonSize'];
  buttonStyle?: ButtonProps['buttonStyle'];
  placement?: DropdownProps['placement'];
  overlayStyle?: DropdownProps['overlayStyle'];
}

export function KebabMenuButton({
  menuItems,
  icon,
  iconOrientation = 'horizontal',
  ariaLabel = 'More Options',
  dataTest,
  buttonId,
  buttonSize = 'xsmall',
  buttonStyle = 'link',
  placement,
  overlayStyle,
}: KebabMenuButtonProps) {
  const defaultIcon =
    iconOrientation === 'vertical' ? (
      <Icons.EllipsisOutlined
        iconSize="xl"
        style={{ transform: 'rotate(90deg)' }}
      />
    ) : (
      <Icons.MoreOutlined iconSize="xl" />
    );

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      placement={placement}
      overlayStyle={overlayStyle}
    >
      <Button
        id={buttonId}
        buttonSize={buttonSize}
        buttonStyle={buttonStyle}
        aria-label={ariaLabel}
        aria-haspopup="true"
        data-test={dataTest}
      >
        {icon || defaultIcon}
      </Button>
    </Dropdown>
  );
}
