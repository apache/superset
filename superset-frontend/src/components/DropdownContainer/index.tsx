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
import React, { CSSProperties, useEffect, useMemo, useState } from 'react';
import { css, t, useTheme } from '@superset-ui/core';
import { useResizeDetector } from 'react-resize-detector';
import { usePrevious } from 'src/hooks/usePrevious';
import Badge from '../Badge';
import Icons from '../Icons';
import Button from '../Button';
import Popover from '../Popover';

/**
 * Horizontal container that displays overflowed items in a popover.
 * It shows an indicator of how many items are currently overflowed.
 */
export interface DropdownContainerProps {
  /**
   * Array of items. The id property is used to uniquely identify
   * the elements when rendering or dealing with event handlers.
   */
  items: {
    id: string;
    element: React.ReactElement;
  }[];
  /**
   * Event handler called every time an element moves between
   * main container and popover.
   */
  onOverflowingStateChange?: (overflowingState: {
    notOverflowed: string[];
    overflowed: string[];
  }) => void;
  /**
   * Popover additional style properties.
   */
  popoverStyle?: CSSProperties;
  /**
   * Icon of the popover trigger.
   */
  popoverTriggerIcon?: React.ReactElement;
  /**
   * Text of the popover trigger.
   */
  popoverTriggerText?: string;
  /**
   * Main container additional style properties.
   */
  style?: CSSProperties;
}

const DropdownContainer = ({
  items,
  onOverflowingStateChange,
  popoverStyle = {},
  popoverTriggerIcon,
  popoverTriggerText = t('More'),
  style,
}: DropdownContainerProps) => {
  const theme = useTheme();
  const { ref, width = 0 } = useResizeDetector<HTMLDivElement>();
  const previousWidth = usePrevious(width) || 0;
  const { current } = ref;
  const [overflowingIndex, setOverflowingIndex] = useState<number>(-1);
  const [itemsWidth, setItemsWidth] = useState<number[]>([]);

  useEffect(() => {
    const container = current?.children.item(0);
    if (container) {
      const { children } = container;
      const childrenArray = Array.from(children);

      // Stores items width once
      if (itemsWidth.length === 0) {
        setItemsWidth(
          childrenArray.map(child => child.getBoundingClientRect().width),
        );
      }

      // Calculates the index of the first overflowed element
      const index = childrenArray.findIndex(
        child =>
          child.getBoundingClientRect().right >
          container.getBoundingClientRect().right,
      );
      setOverflowingIndex(index === -1 ? children.length : index);

      if (width > previousWidth && overflowingIndex !== -1) {
        // Calculates remaining space in the container
        const button = current?.children.item(1);
        const buttonRight = button?.getBoundingClientRect().right || 0;
        const containerRight = current?.getBoundingClientRect().right || 0;
        const remainingSpace = containerRight - buttonRight;
        // Checks if the first element in the popover fits in the remaining space
        const fitsInRemainingSpace = remainingSpace >= itemsWidth[0];
        if (fitsInRemainingSpace && overflowingIndex < items.length) {
          // Moves element from popover to container
          setOverflowingIndex(overflowingIndex + 1);
        }
      }
    }
  }, [
    current,
    items.length,
    itemsWidth,
    overflowingIndex,
    previousWidth,
    width,
  ]);

  const notOverflowedItems = useMemo(
    () =>
      items
        .slice(0, overflowingIndex !== -1 ? overflowingIndex : items.length)
        .map(item => React.cloneElement(item.element, { key: item.id })),
    [items, overflowingIndex],
  );

  const notOverflowedIds = useMemo(
    () =>
      items
        .slice(0, overflowingIndex !== -1 ? overflowingIndex : items.length)
        .map(item => item.id),
    [items, overflowingIndex],
  );

  const overflowedItems = useMemo(
    () =>
      overflowingIndex !== -1
        ? items
            .slice(overflowingIndex, items.length)
            .map(item => React.cloneElement(item.element, { key: item.id }))
        : [],
    [items, overflowingIndex],
  );

  const overflowedIds = useMemo(
    () =>
      overflowingIndex !== -1
        ? items.slice(overflowingIndex, items.length).map(item => item.id)
        : [],
    [items, overflowingIndex],
  );

  useEffect(() => {
    if (onOverflowingStateChange) {
      onOverflowingStateChange({
        notOverflowed: notOverflowedIds,
        overflowed: overflowedIds,
      });
    }
  }, [notOverflowedIds, onOverflowingStateChange, overflowedIds]);

  const popoverContent = useMemo(
    () => (
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: ${theme.gridUnit * 3}px;
          width: 200px;
        `}
        style={popoverStyle}
      >
        {overflowedItems}
      </div>
    ),
    [overflowedItems, popoverStyle, theme.gridUnit],
  );

  const overflowingCount =
    overflowingIndex !== -1 ? items.length - overflowingIndex : 0;

  return (
    <div
      ref={ref}
      css={css`
        display: flex;
        align-items: center;
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: ${theme.gridUnit * 3}px;
          margin-right: ${theme.gridUnit * 3}px;
          min-width: 100px;
        `}
        style={style}
      >
        {notOverflowedItems}
      </div>
      {overflowingCount > 0 && (
        <Popover
          content={popoverContent}
          trigger="click"
          overlayInnerStyle={{
            overflow: 'auto',
            maxHeight: 500,
          }}
        >
          <Button buttonStyle="secondary">
            {popoverTriggerIcon}
            {popoverTriggerText}
            <Badge count={overflowingCount} />
            <Icons.DownOutlined
              iconSize="m"
              iconColor={theme.colors.grayscale.base}
            />
          </Button>
        </Popover>
      )}
    </div>
  );
};

export default DropdownContainer;
