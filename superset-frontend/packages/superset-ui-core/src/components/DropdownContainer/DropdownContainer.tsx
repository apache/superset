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
  cloneElement,
  forwardRef,
  ForwardedRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';

import { Global } from '@emotion/react';
import { t } from '@apache-superset/core/translation';
import { usePrevious } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/theme';
import { useResizeDetector } from 'react-resize-detector';
import { Badge, Icons, Button, Tooltip, Popover } from '..';
import { DropdownContainerProps, DropdownItem, DropdownRef } from './types';

const MAX_HEIGHT = 500;

export const DropdownContainer = forwardRef(
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
    outerRef: ForwardedRef<DropdownRef>,
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

    // When the item set changes, the overflow index is briefly reset while the
    // new widths are measured (see the layout effect below). During that window
    // the dropdown content momentarily becomes empty, which would hide and then
    // re-show the trigger, causing a flicker. We track whether a recalculation
    // is pending so the trigger can stay mounted across the transient (when it
    // was showing content just before) without lingering in the steady state
    // when nothing actually overflows.
    const [recalculating, setRecalculating] = useState(false);

    // One-shot confirmation pass: when the layout effect settles on "nothing
    // overflows" right after an item-set-change reset, the geometry may still
    // be mid-reflow. These refs coordinate a single rAF follow-up measurement
    // per item-set change so a transiently-bad "fits" verdict cannot latch.
    //
    // pendingConfirmForLengthRef: holds the items.length for which a
    // confirmation is pending (-1 = none pending). Set in the reset (else)
    // branch; cleared by the rAF callback after it settles.
    const pendingConfirmForLengthRef = useRef(-1);
    // confirmationScheduledRef: true once the rAF has been requested for the
    // current pending length, preventing a second rAF on the setItemsWidth
    // re-run that follows the first provisional measurement.
    const confirmationScheduledRef = useRef(false);
    // hadContentAtLastChangeRef: true when the trigger was showing at the
    // moment the most recent item-set change was detected. Keeps the trigger
    // mounted across the entire confirmation window (not just one render cycle)
    // without letting it linger once the rAF callback has settled. Cleared by
    // the rAF callback before calling setRecalculating(false).
    const hadContentAtLastChangeRef = useRef(false);
    // Guards rAF callbacks from firing after the component unmounts.
    // Stores the pending confirmation rAF handle so it can be cancelled when a
    // newer item-set change supersedes it, or on unmount.
    const rafIdRef = useRef(0);
    // Bumped on every item-set change. A scheduled rAF captures the version at
    // schedule time and ignores itself if a newer change has superseded it, so
    // a stale frame can never clobber a newer item set's state.
    const confirmVersionRef = useRef(0);
    // The items.length the layout effect last observed, used to detect a new
    // item set (additions/removals) on any measurement path, not just the reset.
    const prevItemsLengthRef = useRef(items.length);
    useEffect(
      () => () => {
        // Cancel a queued confirmation frame on unmount so it can never fire
        // after the component is gone (no post-unmount state update).
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
      },
      [],
    );
    // Persists the inner container element for the rAF confirmation callback.
    // Updated each time the layout effect finds a valid container so the rAF
    // does not need to re-derive it through ref.current, which may be null by
    // the time the callback fires in certain timing / test scenarios.
    const containerRef = useRef<Element | null>(null);

    // callback to update item widths so that the useLayoutEffect runs whenever
    // width of any of the child changes
    const recalculateItemWidths = useCallback(() => {
      const mainItemsContainerNode = current?.children.item(0);
      if (mainItemsContainerNode) {
        const visibleChildrenElements = Array.from(
          mainItemsContainerNode.children,
        );
        setItemsWidth(prevGlobalWidths => {
          if (prevGlobalWidths.length !== items.length) {
            return prevGlobalWidths;
          }

          const newGlobalWidths = [...prevGlobalWidths];
          let changed = false;
          visibleChildrenElements.forEach((child, indexInVisible) => {
            const originalItemIndex = indexInVisible;
            if (originalItemIndex < newGlobalWidths.length) {
              const newWidth = child.getBoundingClientRect().width;
              if (newGlobalWidths[originalItemIndex] !== newWidth) {
                newGlobalWidths[originalItemIndex] = newWidth;
                changed = true;
              }
            }
          });

          return changed ? newGlobalWidths : prevGlobalWidths;
        });
      }
    }, [current?.children, items.length]);

    const reduceItems = (items: DropdownItem[]): [DropdownItem[], string[]] =>
      items.reduce(
        ([items, ids], item) => {
          items.push({
            id: item.id,
            element: cloneElement(item.element, { key: item.id }),
          });
          ids.push(item.id);
          return [items, ids];
        },
        [[], []] as [DropdownItem[], string[]],
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

    useEffect(() => {
      const container = current?.children.item(0);
      if (!container) return;

      const childrenArray = Array.from(container.children);

      const resizeObserver = new ResizeObserver(() => {
        recalculateItemWidths();
      });

      childrenArray.map(child => resizeObserver.observe(child));

      // eslint-disable-next-line consistent-return
      return () => {
        childrenArray.map(child => resizeObserver.unobserve(child));
        resizeObserver.disconnect();
      };
    }, [items.length, current, recalculateItemWidths]);

    const overflowingCount =
      overflowingIndex !== -1 ? items.length - overflowingIndex : 0;

    const popoverContent = useMemo(
      () =>
        dropdownContent || overflowingCount ? (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: ${theme.sizeUnit * 4}px;
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
        theme.sizeUnit,
        dropdownStyle,
        overflowedItems,
      ],
    );

    useLayoutEffect(() => {
      if (popoverVisible) {
        return;
      }
      const container = current?.children.item(0);
      if (container) {
        containerRef.current = container;
        const { children } = container;
        const childrenArray = Array.from(children);

        // Detect a new item set (additions/removals shift the positional
        // measurements the overflow split relies on). Arm a confirmation pass
        // for it here so EVERY measurement path below — not just the reset
        // branch — gets a follow-up; otherwise a fit->overflow transition (the
        // bar was fitting, so the reset branch is skipped) could settle a
        // transient "fits" verdict with no rescue. Also supersede any
        // confirmation still pending for the previous item set: bump the version
        // (so its stale rAF ignores itself) and cancel its frame.
        if (prevItemsLengthRef.current !== items.length) {
          prevItemsLengthRef.current = items.length;
          pendingConfirmForLengthRef.current = items.length;
          confirmationScheduledRef.current = false;
          hadContentAtLastChangeRef.current = !!popoverContent;
          confirmVersionRef.current += 1;
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = 0;
          }
        }

        // If items length change, add all items to the container
        // and recalculate the widths
        if (itemsWidth.length !== items.length) {
          if (childrenArray.length === items.length) {
            setItemsWidth(
              childrenArray.map(child => child.getBoundingClientRect().width),
            );
          } else {
            setOverflowingIndex(-1);
            setRecalculating(true);
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
            // Guard: itemsWidth may be stale when its length doesn't match the
            // current item set (its updater bails on a length mismatch). An
            // undefined entry would otherwise inject NaN into the sum.
            if (itemsWidth[i] === undefined) {
              break;
            }
            sum += itemsWidth[i];
            if (sum <= remainingSpace) {
              newOverflowingIndex = i + 1;
            } else {
              break;
            }
          }
        }

        // A "nothing overflows" verdict on the pass that consumed an item-set-
        // change reset may reflect a transient mid-reflow measurement. When that
        // happens, do NOT settle immediately. Instead:
        //   • If the rAF hasn't been scheduled yet: schedule it (one-shot) and
        //     return without settling. On the already-overflowing reset path
        //     recalculating stays true, which keeps the trigger mounted across
        //     the window; on the fit->overflow path the bar had no trigger to
        //     preserve, so the transient stays invisible either way.
        //   • If the rAF is already scheduled (a second layout effect run
        //     triggered by the setItemsWidth call above): also return without
        //     settling for the same reason.
        // The rAF callback reads the DOM directly at a point where the browser
        // has reflowed and calls the setters itself. It also resets the guard
        // refs so subsequent effect runs (e.g. from a real resize) behave
        // normally.
        if (
          newOverflowingIndex === -1 &&
          pendingConfirmForLengthRef.current === items.length
        ) {
          if (!confirmationScheduledRef.current) {
            confirmationScheduledRef.current = true;
            const scheduledVersion = confirmVersionRef.current;
            rafIdRef.current = requestAnimationFrame(() => {
              rafIdRef.current = 0;
              // A newer item-set change superseded this confirmation while the
              // frame was queued; let the newer one's own confirmation settle.
              if (confirmVersionRef.current !== scheduledVersion) return;
              // The normal layout-effect settle path can run before this
              // frame (for example, from the setItemsWidth render) and clear
              // the pending confirmation. In that case this queued frame is
              // stale and must not overwrite the settled overflow index.
              if (
                pendingConfirmForLengthRef.current !== items.length ||
                !confirmationScheduledRef.current
              ) {
                return;
              }
              // Reset guard refs so future layout effect runs are unaffected.
              pendingConfirmForLengthRef.current = -1;
              confirmationScheduledRef.current = false;
              hadContentAtLastChangeRef.current = false;
              const el = containerRef.current;
              if (!el) {
                setOverflowingIndex(-1);
                setRecalculating(false);
                return;
              }
              const kids = Array.from(el.children);
              const confirmIdx = kids.findIndex(
                c =>
                  c.getBoundingClientRect().right >
                  el.getBoundingClientRect().right + 1,
              );
              setOverflowingIndex(confirmIdx);
              setRecalculating(false);
            });
          }
          // Either way (just scheduled or already pending): hold off settling so
          // recalculating stays true and the button guard keeps the trigger mounted.
          return;
        }

        pendingConfirmForLengthRef.current = -1;
        confirmationScheduledRef.current = false;
        // Clear the "had content at last change" flag on a normal settle so a
        // stale value can't keep the trigger mounted in a later recalculation
        // window (the guard reads it while `recalculating` is true).
        hadContentAtLastChangeRef.current = false;
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
        setOverflowingIndex(newOverflowingIndex);
        setRecalculating(false);
      }
    }, [
      current,
      items.length,
      itemsWidth,
      overflowedItems.length,
      previousWidth,
      width,
      popoverVisible,
    ]);

    useEffect(() => {
      if (onOverflowingStateChange) {
        onOverflowingStateChange({
          notOverflowed: notOverflowedIds,
          overflowed: overflowedIds,
        });
      }
    }, [notOverflowedIds, onOverflowingStateChange, overflowedIds]);

    // On the already-overflowing reset path, recalculating stays true during the
    // rAF confirmation window (the layout effect returns early without settling),
    // and hadContentAtLastChangeRef records whether the trigger was showing when
    // the change was detected; together they keep the trigger mounted for the
    // full window and stop it lingering once the rAF settles. On the
    // fit->overflow path recalculating is not set, but the bar had no trigger to
    // preserve there, so nothing flickers.
    const showDropdownButton =
      !!popoverContent || (recalculating && hadContentAtLastChangeRef.current);

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
            gap: ${theme.sizeUnit * 4}px;
            margin-right: ${theme.sizeUnit * 4}px;
            min-width: 0px;
          `}
          data-test="container"
          style={style}
        >
          {notOverflowedItems.map(item => item.element)}
        </div>
        {showDropdownButton && (
          <>
            <Global
              styles={css`
                .ant-popover-inner {
                  // Some OS versions only show the scroll when hovering.
                  // These settings will make the scroll always visible.
                  ::-webkit-scrollbar {
                    -webkit-appearance: none;
                    width: 14px;
                  }
                  ::-webkit-scrollbar-thumb {
                    border-radius: 9px;
                    background-color: ${theme.colorFillSecondary};
                    border: 3px solid transparent;
                    background-clip: content-box;
                  }
                  ::-webkit-scrollbar-track {
                    background-color: ${theme.colorFillQuaternary};
                    border-left: 1px solid ${theme.colorFillTertiary};
                  }
                }
              `}
            />

            <Popover
              styles={{
                body: {
                  maxHeight: `${MAX_HEIGHT}px`,
                  overflow: showOverflow ? 'auto' : 'visible',
                },
              }}
              content={popoverContent}
              trigger="click"
              open={popoverVisible && !!popoverContent}
              onOpenChange={visible => {
                // While a recalculation keeps the trigger mounted but there is
                // no content yet, ignore open attempts so it stays visible
                // without opening an empty popover.
                if (popoverContent) setPopoverVisible(visible);
              }}
              placement="bottom"
              forceRender={forceRender}
              fresh // This prop prevents caching and stale data for filter scoping.
            >
              <Tooltip title={dropdownTriggerTooltip}>
                <Button
                  buttonStyle="secondary"
                  data-test="dropdown-container-btn"
                  icon={dropdownTriggerIcon}
                  css={css`
                    padding-left: ${theme.paddingXS}px;
                    padding-right: ${theme.paddingXXS}px;
                    gap: ${theme.sizeXXS}px;
                  `}
                >
                  {dropdownTriggerText}
                  <Badge
                    count={dropdownTriggerCount ?? overflowingCount}
                    color={
                      (dropdownTriggerCount ?? overflowingCount) > 0
                        ? theme.colorPrimary
                        : theme.colorTextSecondary
                    }
                    showZero
                    css={css`
                      margin-left: ${theme.sizeUnit * 2}px;
                    `}
                  />
                  <Icons.DownOutlined
                    iconSize="m"
                    iconColor={theme.colorIcon}
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
