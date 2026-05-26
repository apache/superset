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
import { useEffect, useState, type ReactNode, type MouseEvent } from 'react';
import { useTheme, styled, css } from '@apache-superset/core/theme';
import { Dropdown, Tooltip, Icons } from '@superset-ui/core/components';

export type FilterPanelRenderProps = {
  isOpen: boolean;
  onClose: () => void;
};

interface CompactFilterTriggerProps {
  label: ReactNode;
  hasValue: boolean;
  onClear: () => void;
  /** Render prop: receives { isOpen, onClose } and returns the panel content. */
  children: (props: FilterPanelRenderProps) => ReactNode;
  /** Shown as a hover tooltip when a value is selected (e.g. the selected label). */
  tooltipTitle?: string;
  /** ARIA popup role for the trigger button. Use 'listbox' for option panels,
   *  'dialog' for form panels (date range, numerical range). */
  popupType?: 'listbox' | 'dialog';
}

const TriggerWrapper = styled.span`
  display: inline-flex;
  align-items: center;
`;

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

// Meets WCAG 2.5.5 target size (24×24 minimum) with explicit dimensions.
const ClearButton = styled.button`
  ${({ theme }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    min-height: 24px;
    margin-left: ${theme.sizeUnit / 2}px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    color: ${theme.colorPrimary};
    border-radius: ${theme.borderRadiusSM}px;

    &:hover {
      background: ${theme.colorPrimaryBg};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimary};
      outline-offset: 2px;
    }
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

  const clearAriaLabel =
    typeof label === 'string' ? `Clear ${label} filter` : 'Clear filter';

  return (
    <TriggerWrapper>
      <Dropdown
        open={open}
        onOpenChange={visible => {
          setOpen(visible);
          if (!visible) setTooltipOpen(false);
        }}
        trigger={['click']}
        popupRender={() =>
          children({ isOpen: open, onClose: () => setOpen(false) })
        }
        placement="bottomLeft"
      >
        <Tooltip
          title={tooltipTitle}
          open={!!tooltipTitle && !open && tooltipOpen}
          onOpenChange={visible =>
            setTooltipOpen(visible && !!tooltipTitle && !open)
          }
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
            <Icons.DownOutlined
              iconSize="xs"
              iconColor={
                hasValue ? theme.colorPrimary : theme.colorTextSecondary
              }
            />
          </FilterPill>
        </Tooltip>
      </Dropdown>
      {hasValue && (
        <ClearButton
          type="button"
          data-test="compact-filter-clear"
          aria-label={clearAriaLabel}
          onClick={handleClear}
        >
          <Icons.CloseOutlined iconSize="s" iconColor={theme.colorPrimary} />
        </ClearButton>
      )}
    </TriggerWrapper>
  );
}
