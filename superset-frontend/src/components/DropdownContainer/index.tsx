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
import React, {
  CSSProperties,
  forwardRef,
  ReactElement,
  RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { css, t, useTheme } from '@superset-ui/core';
import { useResizeDetector } from 'react-resize-detector';
import { usePrevious } from 'src/hooks/usePrevious';
import Badge from '../Badge';
import Icons from '../Icons';
import Button from '../Button';
import Popover from '../Popover';

/**
 * Container item.
 */
export interface Item {
  /**
   * String that uniquely identifies the item.
   */
  id: string;
  /**
   * The element to be rendered.
   */
  element: ReactElement;
}

/**
 * Horizontal container that displays overflowed items in a dropdown.
 * It shows an indicator of how many items are currently overflowing.
 */
export interface DropdownContainerProps {
  /**
   * Array of items. The id property is used to uniquely identify
   * the elements when rendering or dealing with event handlers.
   */
  items: Item[];
  /**
   * Event handler called every time an element moves between
   * main container and dropdown.
   */
  onOverflowingStateChange?: (overflowingState: {
    notOverflowed: string[];
    overflowed: string[];
  }) => void;
  /**
   * Option to customize the content of the dropdown.
   */
  dropdownContent?: (overflowedItems: Item[]) => ReactElement;
  /**
   * Dropdown ref.
   */
  dropdownRef?: RefObject<HTMLDivElement>;
  /**
   * Dropdown additional style properties.
   */
  dropdownStyle?: CSSProperties;
  /**
   * Displayed count in the dropdown trigger.
   */
  dropdownTriggerCount?: number;
  /**
   * Icon of the dropdown trigger.
   */
  dropdownTriggerIcon?: ReactElement;
  /**
   * Text of the dropdown trigger.
   */
  dropdownTriggerText?: string;
  /**
   * Main container additional style properties.
   */
  style?: CSSProperties;
}

export type Ref = HTMLDivElement & { open: () => void };

const DropdownContainer = forwardRef(
  (
    {
      items,
      onOverflowingStateChange,
      dropdownContent: getPopoverContent,
      dropdownRef: popoverRef,
      dropdownStyle: popoverStyle = {},
      dropdownTriggerCount: popoverTriggerCount,
      dropdownTriggerIcon: popoverTriggerIcon,
      dropdownTriggerText: popoverTriggerText = t('More'),
      style,
    }: DropdownContainerProps,
    outerRef: RefObject<Ref>,
  ) => {
    const theme = useTheme();
    const { ref, width = 0 } = useResizeDetector<HTMLDivElement>();
    const previousWidth = usePrevious(width) || 0;
    const { current } = ref;
    const [itemsWidth, setItemsWidth] = useState<number[]>([]);
    const [popoverVisible, setPopoverVisible] = useState(false);

    // We use React.useState to be able to mock the state in Jest
    const [overflowingIndex, setOverflowingIndex] = React.useState<number>(-1);

    useLayoutEffect(() => {
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
          // Checks if the first element in the dropdown fits in the remaining space
          const fitsInRemainingSpace = remainingSpace >= itemsWidth[0];
          if (fitsInRemainingSpace && overflowingIndex < items.length) {
            // Moves element from dropdown to container
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

    const reduceItems = (items: Item[]): [Item[], string[]] =>
      items.reduce(
        ([items, ids], item) => {
          items.push({
            id: item.id,
            element: React.cloneElement(item.element, { key: item.id }),
          });
          ids.push(item.id);
          return [items, ids];
        },
        [[], []] as [Item[], string[]],
      );

    const [notOverflowedItems, notOverflowedIds] = useMemo(
      () =>
        reduceItems(
          items.slice(
            0,
            overflowingIndex !== -1 ? overflowingIndex : items.length,
          ),
        ),
      [items, overflowingIndex],
    );

    const [overflowedItems, overflowedIds] = useMemo(
      () =>
        overflowingIndex !== -1
          ? reduceItems(items.slice(overflowingIndex, items.length))
          : [[], []],
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

    const overflowingCount =
      overflowingIndex !== -1 ? items.length - overflowingIndex : 0;

    const popoverContent = useMemo(
      () =>
        getPopoverContent || overflowingCount ? (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: ${theme.gridUnit * 4}px;
            `}
            data-test="dropdown-content"
            style={popoverStyle}
            ref={popoverRef}
          >
            {getPopoverContent
              ? getPopoverContent(overflowedItems)
              : overflowedItems.map(item => item.element)}
          </div>
        ) : null,
      [
        getPopoverContent,
        overflowedItems,
        overflowingCount,
        popoverRef,
        popoverStyle,
        theme.gridUnit,
      ],
    );

    useImperativeHandle(
      outerRef,
      () => ({
        ...(ref.current as HTMLDivElement),
        open: () => setPopoverVisible(true),
      }),
      [ref],
    );

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
            gap: ${theme.gridUnit * 4}px;
            margin-right: ${theme.gridUnit * 3}px;
            min-width: 100px;
          `}
          data-test="container"
          style={style}
        >
          {notOverflowedItems.map(item => item.element)}
        </div>
        {popoverContent && (
          <Popover
            content={popoverContent}
            trigger="click"
            visible={popoverVisible}
            onVisibleChange={visible => setPopoverVisible(visible)}
            placement="bottom"
          >
            <Button buttonStyle="secondary">
              {popoverTriggerIcon}
              {popoverTriggerText}
              <Badge
                count={popoverTriggerCount ?? overflowingCount}
                css={css`
                  margin-left: ${popoverTriggerCount ?? overflowingCount
                    ? '8px'
                    : '0'};
                `}
              />
              <Icons.DownOutlined
                iconSize="m"
                iconColor={theme.colors.grayscale.light1}
                css={css`
                  .anticon {
                    display: flex;
                  }
                `}
              />
            </Button>
          </Popover>
        )}
      </div>
    );
  },
);

export default DropdownContainer;
