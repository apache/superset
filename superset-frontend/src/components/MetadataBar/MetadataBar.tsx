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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { uniqWith } from 'lodash';
import { styled } from '@superset-ui/core';
import { Tooltip, TooltipPlacement } from 'src/components/Tooltip';
import { ContentType } from './ContentType';
import { config } from './ContentConfig';
import {
  HORIZONTAL_PADDING,
  ICON_PADDING,
  ICON_WIDTH,
  VERTICAL_PADDING,
  TEXT_MIN_WIDTH,
  TEXT_MAX_WIDTH,
  SPACE_BETWEEN_ITEMS,
  ORDER,
  MIN_NUMBER_ITEMS,
  MAX_NUMBER_ITEMS,
} from './constants';

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
    border-radius: ${theme.borderRadius}px;
    line-height: 1;
  `}
`;

const StyledItem = styled.div<{
  collapsed: boolean;
  last: boolean;
  onClick?: () => void;
}>`
  ${({ theme, collapsed, last, onClick }) => `
    display: flex;
    align-items: center;
    max-width: ${
      ICON_WIDTH +
      ICON_PADDING +
      TEXT_MAX_WIDTH +
      (last ? 0 : SPACE_BETWEEN_ITEMS)
    }px;
    min-width: ${
      collapsed
        ? ICON_WIDTH + (last ? 0 : SPACE_BETWEEN_ITEMS)
        : ICON_WIDTH +
          ICON_PADDING +
          TEXT_MIN_WIDTH +
          (last ? 0 : SPACE_BETWEEN_ITEMS)
    }px;
    padding-right: ${last ? 0 : SPACE_BETWEEN_ITEMS}px;
    cursor: ${onClick ? 'pointer' : 'default'};
    & .metadata-icon {
      color: ${
        onClick && collapsed
          ? theme.colors.primary.base
          : theme.colors.grayscale.base
      };
      padding-right: ${collapsed ? 0 : ICON_PADDING}px;
      & .anticon {
        line-height: 0;
      }
    }
    & .metadata-text {
      min-width: ${TEXT_MIN_WIDTH}px;
      overflow: hidden;
      text-overflow: ${collapsed ? 'unset' : 'ellipsis'};
      white-space: nowrap;
      text-decoration: ${onClick ? 'underline' : 'none'};
      line-height: 1.4;
    }
  `}
`;

// Make sure big tooltips are truncated
const TooltipContent = styled.div`
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
  tooltipPlacement,
}: {
  barWidth: number | undefined;
  contentType: ContentType;
  collapsed: boolean;
  last?: boolean;
  tooltipPlacement: TooltipPlacement;
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
      role={onClick ? 'button' : undefined}
    >
      <Icon iconSize="l" className="metadata-icon" />
      {!collapsed && (
        <span ref={ref} className="metadata-text">
          {title}
        </span>
      )}
    </StyledItem>
  );
  return isTruncated || collapsed || (tooltip && tooltip !== title) ? (
    <Tooltip
      placement={tooltipPlacement}
      title={<TooltipContent>{tooltip}</TooltipContent>}
    >
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
  /**
   * Antd tooltip placement. To see available values, check {@link TooltipPlacement}.
   * Defaults to "top".
   */
  tooltipPlacement?: TooltipPlacement;
}

/**
 * The metadata bar component is used to display additional information about an entity.
 * Content types are predefined and consistent across the whole app. This means that
 * they will be displayed and behave in a consistent manner, keeping the same ordering,
 * information formatting, and interactions.
 * To extend the list of content types, a developer needs to request the inclusion of the new type in the design system.
 * This process is important to make sure the new type is reviewed by the design team, improving Superset consistency.
 */
const MetadataBar = ({ items, tooltipPlacement = 'top' }: MetadataBarProps) => {
  const [width, setWidth] = useState<number>();
  const [collapsed, setCollapsed] = useState(false);
  const uniqueItems = uniqWith(items, (a, b) => a.type === b.type);
  const sortedItems = uniqueItems.sort((a, b) => ORDER[a.type] - ORDER[b.type]);
  const count = sortedItems.length;
  if (count < MIN_NUMBER_ITEMS) {
    throw Error('The minimum number of items for the metadata bar is 2.');
  }
  if (count > MAX_NUMBER_ITEMS) {
    throw Error('The maximum number of items for the metadata bar is 6.');
  }

  const onResize = useCallback(
    width => {
      // Calculates the breakpoint width to collapse the bar.
      // The last item does not have a space, so we subtract SPACE_BETWEEN_ITEMS from the total.
      const breakpoint =
        (ICON_WIDTH + ICON_PADDING + TEXT_MIN_WIDTH + SPACE_BETWEEN_ITEMS) *
          count -
        SPACE_BETWEEN_ITEMS;
      setWidth(width);
      setCollapsed(Boolean(width && width < breakpoint));
    },
    [count],
  );

  const { ref } = useResizeDetector({ onResize });

  return (
    <Bar ref={ref} count={count} data-test="metadata-bar">
      {sortedItems.map((item, index) => (
        <Item
          barWidth={width}
          key={index}
          contentType={item}
          collapsed={collapsed}
          last={index === count - 1}
          tooltipPlacement={tooltipPlacement}
        />
      ))}
    </Bar>
  );
};

export default MetadataBar;
