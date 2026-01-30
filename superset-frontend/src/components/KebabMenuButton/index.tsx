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
import { css, useTheme } from '@apache-superset/core/ui';
import { Dropdown, Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import type { ButtonProps } from '@superset-ui/core/components/Button';

export interface KebabMenuButtonProps {
  /**
   * Menu items to display in the dropdown
   */
  menuItems: MenuItem[];
  /**
   * Optional: Custom icon to use instead of the default three-dot icon
   */
  icon?: ReactNode;
  /**
   * Optional: Button size (default: 'xsmall')
   */
  buttonSize?: ButtonProps['buttonSize'];
  /**
   * Optional: aria-label for accessibility
   */
  ariaLabel?: string;
  /**
   * Optional: data-test attribute for testing
   */
  dataTest?: string;
  /**
   * Optional: Button id attribute
   */
  buttonId?: string;
  /**
   * Optional: Button style (default: 'link')
   */
  buttonStyle?: ButtonProps['buttonStyle'];
  /**
   * Optional: Additional CSS for the button
   */
  buttonCss?: ReturnType<typeof css>;
  /**
   * Optional: Additional styles for the dropdown overlay
   */
  overlayStyle?: React.CSSProperties;
  /**
   * Optional: Dropdown placement (defaults to Ant Design's 'bottomLeft' if not specified)
   */
  placement?:
    | 'bottomLeft'
    | 'bottomCenter'
    | 'bottomRight'
    | 'topLeft'
    | 'topCenter'
    | 'topRight';
  /**
   * Optional: IconOrientation - 'horizontal' for horizontal dots, 'vertical' for vertical dots
   */
  iconOrientation?: 'horizontal' | 'vertical';
}

/**
 * Standardized kebab menu button component with consistent styling and behavior
 * across Welcome page cards and Dashboard/Chart cards.
 *
 * Features:
 * - Uses colorTextLabel for consistent icon color
 * - Opens on click (not hover) for better UX consistency
 * - Wraps Ant Design Dropdown with Superset conventions
 */
export function KebabMenuButton({
  menuItems,
  icon,
  buttonSize = 'xsmall',
  ariaLabel = 'More Options',
  dataTest,
  buttonId,
  buttonStyle,
  buttonCss,
  overlayStyle,
  placement,
  iconOrientation = 'horizontal',
}: KebabMenuButtonProps) {
  const theme = useTheme();

  const defaultIcon =
    iconOrientation === 'vertical' ? (
      <Icons.EllipsisOutlined
        css={css`
          color: ${theme.colorTextLabel};
          transform: rotate(90deg);
        `}
        iconSize="xl"
      />
    ) : (
      <Icons.MoreOutlined
        css={css`
          color: ${theme.colorTextLabel};
        `}
        iconSize="xl"
      />
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
        buttonStyle={buttonStyle || 'link'}
        aria-label={ariaLabel}
        aria-haspopup="true"
        data-test={dataTest}
        css={buttonCss}
      >
        {icon || defaultIcon}
      </Button>
    </Dropdown>
  );
}
