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
import {
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
  type MouseEvent,
} from 'react';
import { useTheme, styled, css } from '@apache-superset/core/theme';
import { Dropdown, Tooltip, Icons } from '@superset-ui/core/components';

type FilterPanelInjectedProps = {
  onClose?: () => void;
  isOpen?: boolean;
};

interface CompactFilterTriggerProps {
  label: ReactNode;
  hasValue: boolean;
  onClear: () => void;
  children: ReactNode;
  /** Shown as a hover tooltip when a value is selected (e.g. the selected label). */
  tooltipTitle?: string;
  /** ARIA popup role for the trigger button. Use 'listbox' for option panels,
   *  'dialog' for form panels (date range, numerical range). */
  popupType?: 'listbox' | 'dialog';
}

const FilterPill = styled.button<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    height: ${theme.controlHeight}px;
    padding: 0 ${theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    border: 1px solid ${$active ? theme.colorPrimary : theme.colorBorder};
    background: ${$active ? theme.colorPrimaryBg : theme.colorBgContainer};
    color: ${$active ? theme.colorPrimary : theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${$active ? 600 : 400};
    cursor: pointer;
    white-space: nowrap;
    transition:
      border-color 0.2s,
      background 0.2s,
      color 0.2s;

    &:hover {
      border-color: ${theme.colorPrimary};
      background: ${$active ? theme.colorPrimaryBgHover : theme.colorFillAlter};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
  `}
`;

const ActiveDot = styled.span`
  ${({ theme }) => css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${theme.colorPrimary};
    flex-shrink: 0;
  `}
`;

export default function CompactFilterTrigger({
  label,
  hasValue,
  onClear,
  children,
  tooltipTitle,
  popupType = 'listbox',
}: CompactFilterTriggerProps) {
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const theme = useTheme();

  // Close dropdown on window resize — AntD Dropdown doesn't reposition
  // itself on resize so the panel ends up detached from the pill.
  useEffect(() => {
    if (!open) return;
    const handleResize = () => setOpen(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    onClear();
    setOpen(false);
  };

  const pill = (
    <Tooltip
      title={tooltipTitle}
      open={!!tooltipTitle && !open && tooltipOpen}
      onOpenChange={visible => setTooltipOpen(visible && !!tooltipTitle && !open)}
      mouseEnterDelay={0.5}
      mouseLeaveDelay={0}
    >
      <FilterPill
        $active={hasValue}
        type="button"
        data-test="compact-filter-pill"
        aria-haspopup={popupType}
        aria-expanded={open}
        aria-label={typeof label === 'string' ? label : undefined}
      >
        {hasValue && <ActiveDot />}
        <span>{label}</span>
        {hasValue ? (
          <Icons.CloseOutlined
            iconSize="xs"
            iconColor={theme.colorPrimary}
            onClick={handleClear}
          />
        ) : (
          <Icons.DownOutlined
            iconSize="xs"
            iconColor={theme.colorTextSecondary}
          />
        )}
      </FilterPill>
    </Tooltip>
  );

  return (
    // destroyPopupOnHide intentionally omitted: keeping the popup mounted
    // preserves filter component refs so external clearFilters() calls can
    // reach the panel instance after it has been opened at least once.
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      popupRender={() =>
        isValidElement(children)
          ? cloneElement(children as ReactElement<FilterPanelInjectedProps>, {
              onClose: () => setOpen(false),
              isOpen: open,
            })
          : (children as ReactElement)
      }
      placement="bottomLeft"
    >
      {pill}
    </Dropdown>
  );
}
