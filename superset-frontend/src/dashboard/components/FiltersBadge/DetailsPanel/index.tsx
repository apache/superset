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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Global, css } from '@emotion/react';
import { t, useTheme } from '@superset-ui/core';
import {
  MinusCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import Popover from 'src/components/Popover';
import Collapse from 'src/components/Collapse';
import Icons from 'src/components/Icons';
import {
  Indent,
  Panel,
  Reset,
  Title,
} from 'src/dashboard/components/FiltersBadge/Styles';
import { Indicator } from 'src/dashboard/components/FiltersBadge/selectors';
import FilterIndicator from 'src/dashboard/components/FiltersBadge/FilterIndicator';

export interface DetailsPanelProps {
  appliedCrossFilterIndicators: Indicator[];
  appliedIndicators: Indicator[];
  incompatibleIndicators: Indicator[];
  unsetIndicators: Indicator[];
  onHighlightFilterSource: (path: string[]) => void;
  children: JSX.Element;
}

const DetailsPanelPopover = ({
  appliedCrossFilterIndicators = [],
  appliedIndicators = [],
  incompatibleIndicators = [],
  unsetIndicators = [],
  onHighlightFilterSource,
  children,
}: DetailsPanelProps) => {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();

  // we don't need to clean up useEffect, setting { once: true } removes the event listener after handle function is called
  useEffect(() => {
    if (visible) {
      window.addEventListener('resize', () => setVisible(false), {
        once: true,
      });
    }
  }, [visible]);

  const getDefaultActivePanel = useCallback(() => {
    const result = [];
    if (appliedCrossFilterIndicators.length) {
      result.push('appliedCrossFilters');
    }
    if (appliedIndicators.length) {
      result.push('applied');
    }
    if (incompatibleIndicators.length) {
      result.push('incompatible');
    }
    if (result.length) {
      return result;
    }
    return ['unset'];
  }, [
    appliedCrossFilterIndicators.length,
    appliedIndicators.length,
    incompatibleIndicators.length,
  ]);

  const [activePanels, setActivePanels] = useState<string[]>(() =>
    getDefaultActivePanel(),
  );

  const handlePopoverStatus = useCallback(
    (isOpen: boolean) => {
      setVisible(isOpen);
      // every time the popover opens, make sure the most relevant panel is active
      if (isOpen) {
        setActivePanels(getDefaultActivePanel());
      }
    },
    [getDefaultActivePanel],
  );

  const handleActivePanelChange = useCallback((panels: string | string[]) => {
    // need to convert to an array so that handlePopoverStatus will work
    if (typeof panels === 'string') {
      setActivePanels([panels]);
    } else {
      setActivePanels(panels);
    }
  }, []);

  const indicatorKey = (indicator: Indicator): string =>
    `${indicator.column} - ${indicator.name}`;

  const appliedCrossFilterIndicatorsHeader = useMemo(
    () => (
      <Title bold color={theme.colors.primary.light1}>
        <Icons.CursorTarget
          css={{ fill: theme.colors.primary.light1 }}
          iconSize="xl"
        />
        {t('Applied Cross Filters (%d)', appliedCrossFilterIndicators.length)}
      </Title>
    ),
    [appliedCrossFilterIndicators.length, theme.colors.primary.light1],
  );

  const appliedIndicatorsHeader = useMemo(
    () => (
      <Title bold color={theme.colors.success.base}>
        <CheckCircleFilled />{' '}
        {t('Applied Filters (%d)', appliedIndicators.length)}
      </Title>
    ),
    [appliedIndicators.length, theme.colors.success.base],
  );

  const incompatibleIndicatorsHeader = useMemo(
    () => (
      <Title bold color={theme.colors.alert.base}>
        <ExclamationCircleFilled />{' '}
        {t('Incompatible Filters (%d)', incompatibleIndicators.length)}
      </Title>
    ),
    [incompatibleIndicators.length, theme.colors.alert.base],
  );

  const unsetIndicatorsHeader = useMemo(
    () => (
      <Title bold color={theme.colors.grayscale.light1}>
        <MinusCircleFilled /> {t('Unset Filters (%d)', unsetIndicators.length)}
      </Title>
    ),
    [theme.colors.grayscale.light1, unsetIndicators.length],
  );

  const indentStyle = useMemo(
    () => ({
      paddingBottom: theme.gridUnit * 3,
    }),
    [theme.gridUnit],
  );

  const content = useMemo(
    () => (
      <Panel>
        <Global
          styles={css`
            .filterStatusPopover {
              .ant-popover-inner {
                background-color: ${theme.colors.grayscale.dark2}cc;
                .ant-popover-inner-content {
                  padding-top: 0;
                  padding-bottom: 0;
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
        <Reset>
          <Collapse
            ghost
            light
            activeKey={activePanels}
            onChange={handleActivePanelChange}
          >
            {appliedCrossFilterIndicators.length ? (
              <Collapse.Panel
                key="appliedCrossFilters"
                header={appliedCrossFilterIndicatorsHeader}
              >
                <Indent css={indentStyle}>
                  {appliedCrossFilterIndicators.map(indicator => (
                    <FilterIndicator
                      key={indicatorKey(indicator)}
                      indicator={indicator}
                      onClick={onHighlightFilterSource}
                    />
                  ))}
                </Indent>
              </Collapse.Panel>
            ) : null}
            {appliedIndicators.length ? (
              <Collapse.Panel key="applied" header={appliedIndicatorsHeader}>
                <Indent css={indentStyle}>
                  {appliedIndicators.map(indicator => (
                    <FilterIndicator
                      key={indicatorKey(indicator)}
                      indicator={indicator}
                      onClick={onHighlightFilterSource}
                    />
                  ))}
                </Indent>
              </Collapse.Panel>
            ) : null}
            {incompatibleIndicators.length ? (
              <Collapse.Panel
                key="incompatible"
                header={incompatibleIndicatorsHeader}
              >
                <Indent css={indentStyle}>
                  {incompatibleIndicators.map(indicator => (
                    <FilterIndicator
                      key={indicatorKey(indicator)}
                      indicator={indicator}
                      onClick={onHighlightFilterSource}
                    />
                  ))}
                </Indent>
              </Collapse.Panel>
            ) : null}
            {unsetIndicators.length ? (
              <Collapse.Panel
                key="unset"
                header={unsetIndicatorsHeader}
                disabled={!unsetIndicators.length}
              >
                <Indent css={indentStyle}>
                  {unsetIndicators.map(indicator => (
                    <FilterIndicator
                      key={indicatorKey(indicator)}
                      indicator={indicator}
                      onClick={onHighlightFilterSource}
                    />
                  ))}
                </Indent>
              </Collapse.Panel>
            ) : null}
          </Collapse>
        </Reset>
      </Panel>
    ),
    [
      activePanels,
      appliedCrossFilterIndicators,
      appliedCrossFilterIndicatorsHeader,
      appliedIndicators,
      appliedIndicatorsHeader,
      handleActivePanelChange,
      incompatibleIndicators,
      incompatibleIndicatorsHeader,
      indentStyle,
      onHighlightFilterSource,
      theme.colors.grayscale.dark2,
      theme.colors.grayscale.light4,
      unsetIndicators,
      unsetIndicatorsHeader,
    ],
  );

  return (
    <Popover
      overlayClassName="filterStatusPopover"
      content={content}
      visible={visible}
      onVisibleChange={handlePopoverStatus}
      placement="bottom"
      trigger="click"
    >
      {children}
    </Popover>
  );
};

export default React.memo(DetailsPanelPopover);
