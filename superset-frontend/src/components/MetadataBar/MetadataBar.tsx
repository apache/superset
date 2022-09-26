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
import React, { useEffect, useRef, useState } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { uniqWith } from 'lodash';
import { styled } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { ContentType } from './ContentType';
import { config } from './ContentConfig';

export const MIN_NUMBER_ITEMS = 2;
export const MAX_NUMBER_ITEMS = 6;

const HORIZONTAL_PADDING = 12;
const VERTICAL_PADDING = 8;
const ICON_PADDING = 8;
const SPACE_BETWEEN_ITEMS = 16;
const ICON_WIDTH = 16;
const TEXT_MIN_WIDTH = 70;
const TEXT_MAX_WIDTH = 150;
const ORDER = {
  dashboards: 0,
  table: 1,
  sql: 2,
  rows: 3,
  tags: 4,
  description: 5,
  owner: 6,
  lastModified: 7,
};

const Bar = styled.div<{ count: number }>`
  ${({ theme, count }) => `
    display: flex;
    align-items: center;
    padding: ${VERTICAL_PADDING}px ${HORIZONTAL_PADDING}px;
    background-color: ${theme.colors.grayscale.light4};
    color: ${theme.colors.grayscale.base};
    font-size: ${theme.typography.sizes.s}px;
    min-width: ${
      HORIZONTAL_PADDING * 2 +
      (ICON_WIDTH + SPACE_BETWEEN_ITEMS) * count -
      SPACE_BETWEEN_ITEMS
    }px;
  `}
`;

const StyledItem = styled.div<{
  collapsed: boolean;
  last: boolean;
  onClick?: () => void;
}>`
  ${({ theme, collapsed, last, onClick }) => `
    max-width: ${
      ICON_WIDTH +
      ICON_PADDING +
      TEXT_MAX_WIDTH +
      (last ? 0 : SPACE_BETWEEN_ITEMS)
    }px;
    min-width: ${ICON_WIDTH + (last ? 0 : SPACE_BETWEEN_ITEMS)}px;
    overflow: hidden;
    text-overflow: ${collapsed ? 'unset' : 'ellipsis'};
    white-space: nowrap;
    padding-right: ${last ? 0 : SPACE_BETWEEN_ITEMS}px;
    text-decoration: ${onClick ? 'underline' : 'none'};
    cursor: ${onClick ? 'pointer' : 'default'};
    & > span {
      color: ${onClick && collapsed ? theme.colors.primary.base : 'undefined'};
      padding-right: ${collapsed ? 0 : ICON_PADDING}px;
    }
  `}
`;

// Make sure big tootips are truncated
const TootipContent = styled.div`
  display: -webkit-box;
  -webkit-line-clamp: 20;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Item = ({
  barWidth,
  contentType,
  collapsed,
  last = false,
}: {
  barWidth: number | undefined;
  contentType: ContentType;
  collapsed: boolean;
  last?: boolean;
}) => {
  const { icon, title, tooltip = title } = config(contentType);
  const [isTruncated, setIsTruncated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = icon;
  const { type, onClick } = contentType;

  useEffect(() => {
    setIsTruncated(
      ref.current ? ref.current.scrollWidth > ref.current.clientWidth : false,
    );
  }, [barWidth, setIsTruncated, contentType]);

  const content = (
    <StyledItem
      collapsed={collapsed}
      last={last}
      onClick={onClick ? () => onClick(type) : undefined}
      ref={ref}
    >
      <Icon iconSize="l" />
      {!collapsed && title}
    </StyledItem>
  );
  return isTruncated || collapsed || (tooltip && tooltip !== title) ? (
    <Tooltip title={<TootipContent>{tooltip}</TootipContent>}>
      {content}
    </Tooltip>
  ) : (
    content
  );
};

export interface MetadataBarProps {
  /**
   * Array of content type configurations. To see the available properties
   * for each content type, check {@link ContentType}
   */
  items: ContentType[];
}

/**
 * The metadata bar component is used to display additional information about an entity.
 * Content types are predefined and consistent across the whole app. This means that
 * they will be displayed and behave in a consistent manner, keeping the same ordering,
 * information formatting, and interactions.
 * To extend the list of content types, a developer needs to request the inclusion of the new type in the design system.
 * This process is important to make sure the new type is reviewed by the design team, improving Superset consistency.
 */
const MetadataBar = ({ items }: MetadataBarProps) => {
  const { width, ref } = useResizeDetector();
  const uniqueItems = uniqWith(items, (a, b) => a.type === b.type);
  const sortedItems = uniqueItems.sort((a, b) => ORDER[a.type] - ORDER[b.type]);
  const count = sortedItems.length;
  if (count < MIN_NUMBER_ITEMS) {
    throw Error('The minimum number of items for the metadata bar is 2.');
  }
  if (count > MAX_NUMBER_ITEMS) {
    throw Error('The maximum number of items for the metadata bar is 6.');
  }
  // Calculates the breakpoint width to collapse the bar.
  // The last item does not have a space, so we subtract SPACE_BETWEEN_ITEMS from the total.
  const breakpoint =
    (ICON_WIDTH + ICON_PADDING + TEXT_MIN_WIDTH + SPACE_BETWEEN_ITEMS) * count -
    SPACE_BETWEEN_ITEMS;
  const collapsed = Boolean(width && width < breakpoint);
  return (
    <Bar ref={ref} count={count}>
      {sortedItems.map((item, index) => (
        <Item
          barWidth={width}
          key={index}
          contentType={item}
          collapsed={collapsed}
          last={index === count - 1}
        />
      ))}
    </Bar>
  );
};

export default MetadataBar;
