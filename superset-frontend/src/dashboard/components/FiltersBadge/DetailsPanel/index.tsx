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
import React, { useEffect, useState } from 'react';
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
}

const DetailsPanelPopover = ({
  appliedCrossFilterIndicators = [],
  appliedIndicators = [],
  onHighlightFilterSource,
  children,
}: DetailsPanelProps) => {
  const [visible, setVisible] = useState(false);
  const activeTabs = useSelector<RootState>(
    state => state.dashboardState?.activeTabs,
  );

  // we don't need to clean up useEffect, setting { once: true } removes the event listener after handle function is called
  useEffect(() => {
    if (visible) {
      window.addEventListener('resize', () => setVisible(false), {
        once: true,
      });
    }
  }, [visible]);

  // if tabs change, popover doesn't close automatically
  useEffect(() => {
    setVisible(false);
  }, [activeTabs]);

  function handlePopoverStatus(isOpen: boolean) {
    setVisible(isOpen);
  }

  const indicatorKey = (indicator: Indicator): string =>
    `${indicator.column} - ${indicator.name}`;

  const content = (
    <FiltersDetailsContainer>
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
      visible={visible}
      onVisibleChange={handlePopoverStatus}
      placement="bottomRight"
      trigger="hover"
    >
      {children}
    </Popover>
  );
};

export default DetailsPanelPopover;
