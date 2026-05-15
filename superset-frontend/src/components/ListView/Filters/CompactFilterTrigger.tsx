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
import { useState, type ReactNode, type MouseEvent } from 'react';
import { useTheme, styled, css } from '@apache-superset/core/theme';
import { Popover, Icons } from '@superset-ui/core/components';

interface CompactFilterTriggerProps {
  label: ReactNode;
  hasValue: boolean;
  onClear: () => void;
  children: ReactNode;
}

const FilterPill = styled.button<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    height: 32px;
    padding: 0 ${theme.sizeUnit * 3}px;
    border-radius: 16px;
    border: 1px solid ${$active ? theme.colorPrimary : theme.colorBorder};
    background: ${$active ? theme.colorPrimaryBg : theme.colorBgContainer};
    color: ${$active ? theme.colorPrimary : theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${$active ? 600 : 400};
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.2s, background 0.2s, color 0.2s;

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

const PopoverContent = styled.div`
  ${({ theme }) => css`
    min-width: 220px;

    label {
      display: block;
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextLabel};
      margin-bottom: ${theme.sizeUnit}px;
    }
  `}
`;

export default function CompactFilterTrigger({
  label,
  hasValue,
  onClear,
  children,
}: CompactFilterTriggerProps) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    onClear();
    setOpen(false);
  };

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      content={<PopoverContent>{children}</PopoverContent>}
      placement="bottomLeft"
      arrow={false}
      destroyTooltipOnHide
    >
      <FilterPill
        $active={hasValue}
        type="button"
        data-test="compact-filter-pill"
        aria-haspopup="dialog"
        aria-expanded={open}
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
    </Popover>
  );
}
