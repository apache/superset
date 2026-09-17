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
import { MouseEventHandler, ReactNode } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '../Tooltip';

export interface PopoverSectionProps {
  title: string;
  isSelected?: boolean;
  onSelect?: MouseEventHandler<HTMLButtonElement>;
  info?: string;
  children?: ReactNode;
}

export default function PopoverSection({
  title,
  isSelected,
  children,
  onSelect,
  info,
}: PopoverSectionProps) {
  const theme = useTheme();
  return (
    <div
      css={{
        paddingBottom: theme.sizeUnit * 2,
        opacity: isSelected ? 1 : 0.6,
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        css={css`
          appearance: none;
          border: none;
          background: none;
          padding: 0;
          font: inherit;
          text-align: left;
          width: 100%;
          display: flex;
          align-items: center;
          cursor: ${onSelect ? 'pointer' : 'default'};
        `}
      >
        <strong data-test="popover-title">{title}</strong>
        {info && (
          <Tooltip
            title={info}
            css={css`
              margin-left: ${theme.sizeUnit}px;
              margin-right: ${theme.sizeUnit}px;
            `}
          >
            {/* role is auto-computed by BaseIconComponent as "img" since
                there's no onClick, so no explicit role needed here. */}
            <Icons.InfoCircleOutlined
              iconSize="s"
              iconColor={theme.colorIcon}
            />
          </Tooltip>
        )}
        <Icons.CheckOutlined
          iconSize="s"
          iconColor={isSelected ? theme.colorPrimary : theme.colorIcon}
        />
      </button>
      <div
        css={css`
          margin-left: ${theme.sizeUnit}px;
          margin-top: ${theme.sizeUnit}px;
        `}
      >
        {children}
      </div>
    </div>
  );
}
