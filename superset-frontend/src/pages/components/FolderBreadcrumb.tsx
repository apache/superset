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
import { styled } from '@apache-superset/core/theme';
import { Breadcrumb as AntdBreadcrumb } from 'antd';
import { FolderIcon, FolderOpenIcon } from './assetIcons';
import type { FolderBreadcrumbProps } from './types';

const StyledBreadcrumb = styled(AntdBreadcrumb)`
  ${({ theme }) => `
    margin: ${theme.sizeUnit * 2}px 0 ${theme.sizeUnit * 4}px;
    font-size: ${theme.fontSize}px;
    line-height: ${theme.sizeUnit * 6}px;

    .ant-breadcrumb-separator {
      color: ${theme.colorTextTertiary};
      margin-inline: ${theme.sizeUnit * 2}px;
    }

    .ant-breadcrumb-link {
      color: ${theme.colorTextSecondary};
    }

    a.ant-breadcrumb-link:hover,
    .ant-breadcrumb-link a:hover {
      color: ${theme.colorPrimary};
      background: transparent;
    }

    /* Semantic emphasis: the trailing item is the current location. */
    li:last-of-type .ant-breadcrumb-link {
      color: ${theme.colorText};
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

const ItemLabel = styled.span<{ clickable?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  ${({ clickable, theme }) =>
    clickable &&
    `
      cursor: pointer;

      &:hover {
        color: ${theme.colorPrimary};
      }
    `}
`;

const DEFAULT_SEPARATOR = '>';

export function FolderBreadcrumb({
  items,
  separator = DEFAULT_SEPARATOR,
  className,
}: FolderBreadcrumbProps) {
  const antdItems = items.map((item, index) => {
    const isCurrent = index === items.length - 1;
    const Icon = isCurrent ? FolderOpenIcon : FolderIcon;
    const clickable = !isCurrent && Boolean(item.onClick || item.href);
    return {
      key: item.key,
      href: item.href,
      onClick: item.onClick ? () => item.onClick?.(item.key) : undefined,
      title: (
        <ItemLabel clickable={clickable}>
          {!item.hideIcon && <Icon iconSize="m" aria-hidden />}
          {item.title}
        </ItemLabel>
      ),
    };
  });

  return (
    <StyledBreadcrumb
      className={className}
      separator={separator}
      items={antdItems}
    />
  );
}
