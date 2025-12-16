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
import { useState, Key, MouseEvent, KeyboardEvent } from 'react';
import { t } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import {
  NoAnimationDropdown,
  Button,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

/**
 * Standard menu keys for dashboard components.
 * Components can use these standard keys or define custom ones.
 */
export enum ComponentMenuKeys {
  // Common actions
  Delete = 'delete',
  Edit = 'edit',

  // Theme actions
  ApplyTheme = 'apply-theme',
  ClearTheme = 'clear-theme',

  // Markdown-specific
  EditContent = 'edit-content',
  PreviewContent = 'preview-content',

  // Row/Column-specific
  BackgroundStyle = 'background-style',

  // Tab-specific
  RenameTab = 'rename-tab',
}

// Re-export MenuItem type for convenience - allows both keyed items and dividers
export type ComponentMenuItem = MenuItem;

export interface ComponentHeaderControlsProps {
  /** Unique identifier for the component */
  componentId: string;

  /** Array of menu items to display */
  menuItems: ComponentMenuItem[];

  /** Callback when a menu item is clicked */
  onMenuClick: (key: string, domEvent: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void;

  /** Whether the component is in edit mode */
  editMode?: boolean;

  /** Whether to show the menu even in view mode */
  showInViewMode?: boolean;

  /** Z-index for the dropdown overlay */
  zIndex?: number;

  /** Additional CSS class for the trigger button */
  className?: string;

  /** Whether the menu is disabled */
  disabled?: boolean;
}

const VerticalDotsTrigger = () => {
  const theme = useTheme();
  return (
    <Icons.EllipsisOutlined
      css={css`
        transform: rotate(90deg);
        &:hover {
          cursor: pointer;
        }
      `}
      iconSize="l"
      iconColor={theme.colorTextLabel}
      className="component-menu-trigger"
    />
  );
};

/**
 * A standardized menu component for dashboard components (Markdown, Row, Column, Tab).
 *
 * Provides a consistent vertical dots menu pattern similar to SliceHeaderControls,
 * but generic enough to be used across all dashboard component types.
 *
 * Usage:
 * ```tsx
 * <ComponentHeaderControls
 *   componentId="MARKDOWN-123"
 *   menuItems={[
 *     { key: ComponentMenuKeys.Edit, label: t('Edit') },
 *     { key: ComponentMenuKeys.ApplyTheme, label: t('Apply theme') },
 *     { type: 'divider' },
 *     { key: ComponentMenuKeys.Delete, label: t('Delete'), danger: true },
 *   ]}
 *   onMenuClick={(key) => handleMenuAction(key)}
 *   editMode={editMode}
 * />
 * ```
 */
const ComponentHeaderControls = ({
  componentId,
  menuItems,
  onMenuClick,
  editMode = false,
  showInViewMode = false,
  zIndex = 99,
  className,
  disabled = false,
}: ComponentHeaderControlsProps) => {
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const theme = useTheme();

  // Don't render if not in edit mode and showInViewMode is false
  if (!editMode && !showInViewMode) {
    return null;
  }

  const handleMenuClick = ({
    key,
    domEvent,
  }: {
    key: Key;
    domEvent: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
  }) => {
    onMenuClick(String(key), domEvent);
    setIsDropdownVisible(false);
  };

  const dropdownOverlayStyle = {
    zIndex,
    animationDuration: '0s',
  };

  return (
    <NoAnimationDropdown
      popupRender={() => (
        <Menu
          onClick={handleMenuClick}
          data-test={`component-menu-${componentId}`}
          id={`component-menu-${componentId}`}
          selectable={false}
          items={menuItems}
        />
      )}
      overlayStyle={dropdownOverlayStyle}
      trigger={['click']}
      placement="bottomRight"
      open={isDropdownVisible}
      onOpenChange={visible => setIsDropdownVisible(visible)}
      disabled={disabled}
    >
      <Button
        id={`${componentId}-controls`}
        buttonStyle="link"
        aria-label={t('More Options')}
        aria-haspopup="true"
        className={className}
        css={css`
          padding: ${theme.sizeUnit}px;
          opacity: 0.7;
          transition: opacity 0.2s;
          &:hover {
            opacity: 1;
          }
        `}
      >
        <VerticalDotsTrigger />
      </Button>
    </NoAnimationDropdown>
  );
};

export default ComponentHeaderControls;
