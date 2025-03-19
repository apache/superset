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
import { RefObject, useEffect, useRef, KeyboardEvent } from 'react';

import { useSelector } from 'react-redux';
import { Global, css } from '@emotion/react';
import { t } from '@superset-ui/core';
import Popover from 'src/components/Popover';
import {
  FiltersContainer,
  FiltersDetailsContainer,
  Separator,
  SectionName,
} from 'src/dashboard/components/FiltersBadge/Styles';
import { Indicator } from 'src/dashboard/components/nativeFilters/selectors';
import FilterIndicator from 'src/dashboard/components/FiltersBadge/FilterIndicator';
import { RootState } from 'src/dashboard/types';

export interface DetailsPanelProps {
  appliedCrossFilterIndicators: Indicator[];
  appliedIndicators: Indicator[];
  onHighlightFilterSource: (path: string[]) => void;
  children: JSX.Element;
  popoverVisible: boolean;
  popoverContentRef: RefObject<HTMLDivElement>;
  popoverTriggerRef: RefObject<HTMLDivElement>;
  setPopoverVisible: (visible: boolean) => void;
}

const DetailsPanelPopover = ({
  appliedCrossFilterIndicators = [],
  appliedIndicators = [],
  onHighlightFilterSource,
  children,
  popoverVisible,
  popoverContentRef,
  popoverTriggerRef,
  setPopoverVisible,
}: DetailsPanelProps) => {
  const activeTabs = useSelector<RootState>(
    state => state.dashboardState?.activeTabs,
  );
  // Combined ref array for all filter indicator elements
  const indicatorRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'Escape':
      case 'Enter':
        // timing out to allow for filter selection to happen first
        setTimeout(() => {
          // move back to the popover trigger element
          popoverTriggerRef?.current?.focus();
          // Close popover on ESC or ENTER
          setPopoverVisible(false);
        });
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault(); // Prevent scrolling
        // Navigate through filters with arrows up/down
        const currentFocusIndex = indicatorRefs.current.findIndex(
          ref => ref === document.activeElement,
        );
        const maxIndex = indicatorRefs.current.length - 1;
        let nextFocusIndex = 0;

        if (event.key === 'ArrowDown') {
          nextFocusIndex =
            currentFocusIndex >= maxIndex ? 0 : currentFocusIndex + 1;
        } else if (event.key === 'ArrowUp') {
          nextFocusIndex =
            currentFocusIndex <= 0 ? maxIndex : currentFocusIndex - 1;
        }
        indicatorRefs.current[nextFocusIndex]?.focus();
        break;
      }
      case 'Tab':
        // forcing popover context until ESC or ENTER are pressed
        event.preventDefault();
        break;
      default:
        break;
    }
  };

  const handleVisibility = (isOpen: boolean) => {
    setPopoverVisible(isOpen);
  };

  // we don't need to clean up useEffect, setting { once: true } removes the event listener after handle function is called
  useEffect(() => {
    if (popoverVisible) {
      window.addEventListener('resize', () => setPopoverVisible(false), {
        once: true,
      });
    }
  }, [popoverVisible]);

  // if tabs change, popover doesn't close automatically
  useEffect(() => {
    setPopoverVisible(false);
  }, [activeTabs]);

  const indicatorKey = (indicator: Indicator): string =>
    `${indicator.column} - ${indicator.name}`;

  const content = (
    <FiltersDetailsContainer
      ref={popoverContentRef}
      tabIndex={-1}
      onMouseLeave={() => setPopoverVisible(false)}
      onKeyDown={handleKeyDown}
      role="menu"
    >
      <Global
        styles={theme => css`
          .filterStatusPopover {
            .ant-popover-inner {
              background-color: ${theme.colors.grayscale.dark2}cc;
              .ant-popover-inner-content {
                padding: ${theme.gridUnit * 2}px;
              }
            }
            &.ant-popover-placement-bottom,
            &.ant-popover-placement-bottomLeft,
            &.ant-popover-placement-bottomRight {
              & > .ant-popover-content > .ant-popover-arrow {
                border-top-color: ${theme.colors.grayscale.dark2}cc;
                border-left-color: ${theme.colors.grayscale.dark2}cc;
              }
            }
            &.ant-popover-placement-top,
            &.ant-popover-placement-topLeft,
            &.ant-popover-placement-topRight {
              & > .ant-popover-content > .ant-popover-arrow {
                border-bottom-color: ${theme.colors.grayscale.dark2}cc;
                border-right-color: ${theme.colors.grayscale.dark2}cc;
              }
            }
            &.ant-popover-placement-left,
            &.ant-popover-placement-leftTop,
            &.ant-popover-placement-leftBottom {
              & > .ant-popover-content > .ant-popover-arrow {
                border-top-color: ${theme.colors.grayscale.dark2}cc;
                border-right-color: ${theme.colors.grayscale.dark2}cc;
              }
            }
            &.ant-popover-placement-right,
            &.ant-popover-placement-rightTop,
            &.ant-popover-placement-rightBottom {
              & > .ant-popover-content > .ant-popover-arrow {
                border-bottom-color: ${theme.colors.grayscale.dark2}cc;
                border-left-color: ${theme.colors.grayscale.dark2}cc;
              }
            }
            &.ant-popover {
              color: ${theme.colors.grayscale.light4};
              z-index: 99;
            }
          }
        `}
      />
      <div>
        {appliedCrossFilterIndicators.length ? (
          <div>
            <SectionName>
              {t(
                'Applied cross-filters (%d)',
                appliedCrossFilterIndicators.length,
              )}
            </SectionName>
            <FiltersContainer>
              {appliedCrossFilterIndicators.map(indicator => (
                <FilterIndicator
                  ref={el => indicatorRefs.current.push(el)}
                  key={indicatorKey(indicator)}
                  indicator={indicator}
                  onClick={onHighlightFilterSource}
                />
              ))}
            </FiltersContainer>
          </div>
        ) : null}
        {appliedCrossFilterIndicators.length && appliedIndicators.length ? (
          <Separator />
        ) : null}
        {appliedIndicators.length ? (
          <div>
            <SectionName>
              {t('Applied filters (%d)', appliedIndicators.length)}
            </SectionName>
            <FiltersContainer>
              {appliedIndicators.map(indicator => (
                <FilterIndicator
                  ref={el => indicatorRefs.current.push(el)}
                  key={indicatorKey(indicator)}
                  indicator={indicator}
                  onClick={onHighlightFilterSource}
                />
              ))}
            </FiltersContainer>
          </div>
        ) : null}
      </div>
    </FiltersDetailsContainer>
  );

  return (
    <Popover
      overlayClassName="filterStatusPopover"
      content={content}
      visible={popoverVisible}
      onVisibleChange={handleVisibility}
      placement="bottomRight"
      trigger={['hover']}
    >
      {children}
    </Popover>
  );
};

export default DetailsPanelPopover;
