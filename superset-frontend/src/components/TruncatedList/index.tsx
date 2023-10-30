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

import React, { ReactNode, useMemo, useRef } from 'react';
import { styled, t, useTruncation } from '@superset-ui/core';
import { Tooltip } from '../Tooltip';

export type TruncatedListProps<ListItemType> = {
  /**
   * Array of input items of type `ListItemType`.
   */
  items: ListItemType[];

  /**
   * Renderer for items not overflowed into the tooltip.
   * Required if `ListItemType` is not renderable by React.
   */
  renderVisibleItem?: (item: ListItemType) => ReactNode;

  /**
   * Renderer for items that are overflowed into the tooltip.
   * Required if `ListItemType` is not renderable by React.
   */
  renderTooltipItem?: (item: ListItemType) => ReactNode;

  /**
   * Returns the React key for an item.
   */
  getKey?: (item: ListItemType) => React.Key;

  /**
   * The max number of links that should appear in the tooltip.
   */
  maxLinks?: number;
};

const StyledTruncatedList = styled.div`
  & > span {
    width: 100%;
    display: flex;

    .ant-tooltip-open {
      display: inline;
    }
  }
`;

const StyledVisibleItems = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  width: 100%;
  vertical-align: bottom;
`;

const StyledVisibleItem = styled.span`
  &:not(:last-child)::after {
    content: ', ';
  }
`;

const StyledTooltipItem = styled.div`
  .link {
    color: ${({ theme }) => theme.colors.grayscale.light5};
    display: block;
    text-decoration: underline;
  }
`;

const StyledPlus = styled.span`
  ${({ theme }) => `
  cursor: pointer;
  color: ${theme.colors.primary.dark1};
  font-weight: ${theme.typography.weights.normal};
  `}
`;

export default function TruncatedList<ListItemType>({
  items,
  renderVisibleItem = item => item,
  renderTooltipItem = item => item,
  getKey = item => item as unknown as React.Key,
  maxLinks = 20,
}: TruncatedListProps<ListItemType>) {
  const itemsNotInTooltipRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const [elementsTruncated, hasHiddenElements] = useTruncation(
    itemsNotInTooltipRef,
    plusRef,
  ) as [number, boolean];

  const nMoreItems = useMemo(
    () => (items.length > maxLinks ? items.length - maxLinks : undefined),
    [items, maxLinks],
  );

  const itemsNotInTooltip = useMemo(
    () => (
      <StyledVisibleItems ref={itemsNotInTooltipRef} data-test="crosslinks">
        {items.map(item => (
          <StyledVisibleItem key={getKey(item)}>
            {renderVisibleItem(item)}
          </StyledVisibleItem>
        ))}
      </StyledVisibleItems>
    ),
    [getKey, items, renderVisibleItem],
  );

  const itemsInTooltip = useMemo(
    () =>
      items
        .slice(0, maxLinks)
        .map(item => (
          <StyledTooltipItem key={getKey(item)}>
            {renderTooltipItem(item)}
          </StyledTooltipItem>
        )),
    [getKey, items, maxLinks, renderTooltipItem],
  );

  return (
    <StyledTruncatedList>
      <Tooltip
        placement="top"
        title={
          elementsTruncated ? (
            <>
              {itemsInTooltip}
              {nMoreItems && <span>{t('+ %s more', nMoreItems)}</span>}
            </>
          ) : null
        }
      >
        {itemsNotInTooltip}
        {hasHiddenElements && (
          <StyledPlus ref={plusRef}>+{elementsTruncated}</StyledPlus>
        )}
      </Tooltip>
    </StyledTruncatedList>
  );
}
