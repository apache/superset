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
import { css, styled } from '@superset-ui/core';
import { List as AntdList } from 'antd';
import type { ListProps, ListItemProps, ListItemMetaProps } from './types';

export interface CompactListItemProps extends ListItemProps {
  compact?: boolean;
}

const CompactListItem = styled(AntdList.Item)<CompactListItemProps>`
  && {
    ${({ compact, theme }) =>
      compact &&
      css`
        padding: ${theme.sizeUnit / 2}px ${theme.sizeUnit * 3}px
          ${theme.sizeUnit / 2}px ${theme.sizeUnit}px;
      `}
    ${({ theme }) => css`
      && a {
        color: ${theme.colorLink};
        &:hover {
          color: ${theme.colorLinkHover};
        }
      }
    `}
  }
`;

type CompactListItemWithMeta = typeof CompactListItem & {
  Meta: typeof AntdList.Item.Meta;
};

(CompactListItem as CompactListItemWithMeta).Meta = AntdList.Item.Meta;

export const List = Object.assign(AntdList, {
  Item: CompactListItem,
});

export type { ListProps, ListItemProps, ListItemMetaProps };
