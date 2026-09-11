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
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from 'react';
import { t } from '@apache-superset/core/translation';
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
    line-height: 1;
    transition:
      border-color 0.2s,
      background 0.2s,
      color 0.2s;

    /* AntD anticon spans carry vertical-align: -0.125em from global styles.
       align-self centers the span within the pill; the inner flex+align-items
       centers the svg within the span. */
    .anticon {
      display: flex;
      align-items: center;
      align-self: center;
      line-height: 0;
    }

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
  // Tracks whether tooltip should be suppressed after dropdown close.
  // Brave (and some other browsers) fire a synthetic mouseover on newly-exposed
  // elements when a popup disappears, triggering Tooltip onOpenChange(true)
  // without real user intent. We suppress until the cursor actually leaves the
  // pill (onMouseLeave), which is the first reliable "hover reset" signal.
  const tooltipSuppressedRef = useRef(false);

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
    tooltipSuppressedRef.current = true;
    setTooltipOpen(false);
  };

  return (
    <Dropdown
      open={open}
      onOpenChange={visible => {
        setOpen(visible);
        if (!visible) {
          tooltipSuppressedRef.current = true;
          setTooltipOpen(false);
        }
      }}
      trigger={['click']}
      popupRender={() =>
        children({ isOpen: open, onClose: () => setOpen(false) })
      }
      placement="bottomLeft"
      destroyPopupOnHide
    >
      <Tooltip
        title={tooltipTitle}
        open={!!tooltipTitle && !open && tooltipOpen}
        onOpenChange={visible => {
          if (visible && tooltipSuppressedRef.current) return;
          setTooltipOpen(visible && !!tooltipTitle && !open);
        }}
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
          onMouseLeave={() => {
            tooltipSuppressedRef.current = false;
          }}
        >
          {hasValue && <ActiveDot />}
          <span>{label}</span>
          {hasValue ? (
            <Icons.CloseOutlined
              iconSize="s"
              iconColor={theme.colorPrimary}
              onClick={handleClear}
              data-test="compact-filter-clear"
              aria-label={
                typeof label === 'string'
                  ? t('Clear %s filter', label)
                  : undefined
              }
            />
          ) : (
            <Icons.DownOutlined
              iconSize="s"
              iconColor={theme.colorTextSecondary}
            />
          )}
        </FilterPill>
      </Tooltip>
    </Dropdown>
  );
}
