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
  CSSProperties,
  cloneElement,
  forwardRef,
  ReactElement,
  RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  ReactNode,
} from 'react';

import { Global } from '@emotion/react';
import { css, t, useTheme, usePrevious } from '@superset-ui/core';
import { useResizeDetector } from 'react-resize-detector';
import Badge from '../Badge';
import Icons from '../Icons';
import Button from '../Button';
import Popover from '../Popover';
import { Tooltip } from '../Tooltip';

const MAX_HEIGHT = 500;

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
   * Text of the dropdown trigger tooltip
   */
  dropdownTriggerTooltip?: ReactNode | null;
  /**
   * Main container additional style properties.
   */
  style?: CSSProperties;
  /**
   * Force render popover content before it's first opened
   */
  forceRender?: boolean;
}

export type Ref = HTMLDivElement & { open: () => void };

const DropdownContainer = forwardRef(
  (
    {
      items,
      onOverflowingStateChange,
      dropdownContent,
      dropdownRef,
      dropdownStyle = {},
      dropdownTriggerCount,
      dropdownTriggerIcon,
      dropdownTriggerText = t('More'),
      dropdownTriggerTooltip = null,
      forceRender,
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
    const [overflowingIndex, setOverflowingIndex] = useState<number>(-1);

    let targetRef = useRef<HTMLDivElement>(null);
    if (dropdownRef) {
      targetRef = dropdownRef;
    }

    const [showOverflow, setShowOverflow] = useState(false);

    const reduceItems = (items: Item[]): [Item[], string[]] =>
      items.reduce(
        ([items, ids], item) => {
          items.push({
            id: item.id,
            element: cloneElement(item.element, { key: item.id }),
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
          ? reduceItems(items.slice(overflowingIndex))
          : [[], []],
      [items, overflowingIndex],
    );

    useLayoutEffect(() => {
      if (popoverVisible) {
        return;
      }
      const container = current?.children.item(0);
      if (container) {
        const { children } = container;
        const childrenArray = Array.from(children);
        // If items length change, add all items to the container
        // and recalculate the widths
        if (itemsWidth.length !== items.length) {
          if (childrenArray.length === items.length) {
            setItemsWidth(
              childrenArray.map(child => child.getBoundingClientRect().width),
            );
          } else {
            setOverflowingIndex(-1);
            return;
          }
        }

        // Calculates the index of the first overflowed element
        // +1 is to give at least one pixel of difference and avoid flakiness
        const index = childrenArray.findIndex(
          child =>
            child.getBoundingClientRect().right >
            container.getBoundingClientRect().right + 1,
        );

        // If elements fit (-1) and there's overflowed items
        // then preserve the overflow index. We can't use overflowIndex
        // directly because the items may have been modified
        let newOverflowingIndex =
          index === -1 && overflowedItems.length > 0
            ? items.length - overflowedItems.length
            : index;

        if (width > previousWidth) {
          // Calculates remaining space in the container
          const button = current?.children.item(1);
          const buttonRight = button?.getBoundingClientRect().right || 0;
          const containerRight = current?.getBoundingClientRect().right || 0;
          const remainingSpace = containerRight - buttonRight;

          // Checks if some elements in the dropdown fits in the remaining space
          let sum = 0;
          for (let i = childrenArray.length; i < items.length; i += 1) {
            sum += itemsWidth[i];
            if (sum <= remainingSpace) {
              newOverflowingIndex = i + 1;
            } else {
              break;
            }
          }
        }

        setOverflowingIndex(newOverflowingIndex);
      }
    }, [
      current,
      items.length,
      itemsWidth,
      overflowedItems.length,
      previousWidth,
      width,
    ]);

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
        dropdownContent || overflowingCount ? (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: ${theme.gridUnit * 4}px;
            `}
            data-test="dropdown-content"
            style={dropdownStyle}
            ref={targetRef}
          >
            {dropdownContent
              ? dropdownContent(overflowedItems)
              : overflowedItems.map(item => item.element)}
          </div>
        ) : null,
      [
        dropdownContent,
        overflowingCount,
        theme.gridUnit,
        dropdownStyle,
        overflowedItems,
      ],
    );

    useLayoutEffect(() => {
      if (popoverVisible) {
        // Measures scroll height after rendering the elements
        setTimeout(() => {
          if (targetRef.current) {
            // We only set overflow when there's enough space to display
            // Select's popovers because they are restrained by the overflow property.
            setShowOverflow(targetRef.current.scrollHeight > MAX_HEIGHT);
          }
        }, 100);
      }
    }, [popoverVisible]);

    useImperativeHandle(
      outerRef,
      () => ({
        ...(ref.current as HTMLDivElement),
        open: () => setPopoverVisible(true),
      }),
      [ref],
    );

    // Closes the popover when scrolling on the document
    useEffect(() => {
      document.onscroll = popoverVisible
        ? () => setPopoverVisible(false)
        : null;
      return () => {
        document.onscroll = null;
      };
    }, [popoverVisible]);

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
            margin-right: ${theme.gridUnit * 4}px;
            min-width: 0px;
          `}
          data-test="container"
          style={style}
        >
          {notOverflowedItems.map(item => item.element)}
        </div>
        {popoverContent && (
          <>
            <Global
              styles={css`
                .antd5-popover-inner {
                  // Some OS versions only show the scroll when hovering.
                  // These settings will make the scroll always visible.
                  ::-webkit-scrollbar {
                    -webkit-appearance: none;
                    width: 14px;
                  }
                  ::-webkit-scrollbar-thumb {
                    border-radius: 9px;
                    background-color: ${theme.colors.grayscale.light1};
                    border: 3px solid transparent;
                    background-clip: content-box;
                  }
                  ::-webkit-scrollbar-track {
                    background-color: ${theme.colors.grayscale.light4};
                    border-left: 1px solid ${theme.colors.grayscale.light2};
                  }
                }
              `}
            />

            <Popover
              overlayInnerStyle={{
                maxHeight: `${MAX_HEIGHT}px`,
                overflow: showOverflow ? 'auto' : 'visible',
              }}
              content={popoverContent}
              trigger="click"
              open={popoverVisible}
              onOpenChange={visible => setPopoverVisible(visible)}
              placement="bottom"
              forceRender={forceRender}
            >
              <Tooltip title={dropdownTriggerTooltip}>
                <Button
                  buttonStyle="secondary"
                  data-test="dropdown-container-btn"
                >
                  {dropdownTriggerIcon}
                  {dropdownTriggerText}
                  <Badge
                    count={dropdownTriggerCount ?? overflowingCount}
                    color={
                      (dropdownTriggerCount ?? overflowingCount) > 0
                        ? theme.colors.primary.base
                        : theme.colors.grayscale.light1
                    }
                    showZero
                    css={css`
                      margin-left: ${theme.gridUnit * 2}px;
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
              </Tooltip>
            </Popover>
          </>
        )}
      </div>
    );
  },
);

export default DropdownContainer;
