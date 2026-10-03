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
import type { ReactNode } from 'react';
import { MenuDotsDropdown, Menu } from '@superset-ui/core/components';

export interface ComponentMenuItem {
  /** Stable key for React + telemetry. */
  key: string;
  /** Label rendered in the menu row. */
  label: ReactNode;
  /** Optional icon rendered to the left of the label. */
  icon?: ReactNode;
  /** Click handler. Provider closes the menu after firing. */
  onClick?: () => void;
  /** When true, dims and disables the row. */
  disabled?: boolean;
  /** Renders a horizontal rule above this item. */
  divider?: boolean;
  /** Marks the row as destructive (red tone). */
  danger?: boolean;
}

interface ComponentHeaderControlsProps {
  items: ComponentMenuItem[];
  /** Data-test attribute hook for the trigger button. */
  dataTest?: string;
  /**
   * Optional `aria-label` override for the trigger button. Default is the
   * generic "Component options".
   */
  ariaLabel?: string;
}

/**
 * Shared vertical-dots menu for dashboard grid components. Each component
 * (Chart, Markdown, Row, Column, Tabs) plugs in its own `items` and the
 * visual chrome — the dots icon, dropdown surface, accessible labelling —
 * lives here.
 *
 * Built on `MenuDotsDropdown` from `@superset-ui/core/components` so we get
 * the same trigger styling as Chart's `SliceHeaderControls` does today;
 * Phase 4 will converge `SliceHeaderControls` onto this same component.
 *
 * The component is intentionally render-only: it does not read Redux, does
 * not gate on `editMode`, and does not know about theming. Callers decide
 * when to render it. This keeps it reusable across edit vs view, hover
 * menus, embedded contexts, etc.
 */
export default function ComponentHeaderControls({
  items,
  dataTest = 'component-header-controls',
  ariaLabel,
}: ComponentHeaderControlsProps) {
  if (items.length === 0) return null;

  // antd Menu items: split divider markers into their own item entries.
  const menuItems = items.flatMap(item => {
    const row = {
      key: item.key,
      label: item.label,
      icon: item.icon,
      onClick: item.onClick,
      disabled: item.disabled,
      danger: item.danger,
    };
    return item.divider
      ? [{ type: 'divider' as const, key: `${item.key}-divider` }, row]
      : [row];
  });

  return (
    <MenuDotsDropdown
      data-test={dataTest}
      aria-label={ariaLabel}
      overlay={<Menu items={menuItems} />}
    />
  );
}
