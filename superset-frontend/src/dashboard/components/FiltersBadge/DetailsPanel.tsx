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
import React, { useState } from 'react';
import { t, useTheme, css } from '@superset-ui/core';
import {
  SearchOutlined,
  MinusCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { Collapse, Popover } from 'src/common/components/index';
import { Global } from '@emotion/core';
import {
  Indent,
  Item,
  ItemIcon,
  Panel,
  Reset,
  Title,
  FilterValue,
} from './Styles';
import { Indicator } from './selectors';

export interface IndicatorProps {
  indicator: Indicator;
  onClick: (path: string[]) => void;
}

const Indicator = ({
  indicator: { column, name, value = [], path },
  onClick,
}: IndicatorProps) => {
  return (
    <Item onClick={() => onClick([...path, `LABEL-${column}`])}>
      <Title bold>
        <ItemIcon>
          <SearchOutlined />
        </ItemIcon>
        {name.toUpperCase()}
        {value.length ? ': ' : ''}
      </Title>
      <FilterValue>{value.length ? value.join(', ') : ''}</FilterValue>
    </Item>
  );
};

export interface DetailsPanelProps {
  appliedIndicators: Indicator[];
  incompatibleIndicators: Indicator[];
  unsetIndicators: Indicator[];
  onHighlightFilterSource: (path: string[]) => void;
  children: JSX.Element;
}

const DetailsPanelPopover = ({
  appliedIndicators = [],
  incompatibleIndicators = [],
  unsetIndicators = [],
  onHighlightFilterSource,
  children,
}: DetailsPanelProps) => {
  const theme = useTheme();

  function defaultActivePanel() {
    if (incompatibleIndicators.length) return 'incompatible';
    if (appliedIndicators.length) return 'applied';
    return 'unset';
  }

  const [activePanels, setActivePanels] = useState<string[]>(() => [
    defaultActivePanel(),
  ]);

  function handlePopoverStatus(isOpen: boolean) {
    // every time the popover opens, make sure the most relevant panel is active
    if (isOpen) {
      if (!activePanels.includes(defaultActivePanel())) {
        setActivePanels([...activePanels, defaultActivePanel()]);
      }
    }
  }

  function handleActivePanelChange(panels: string | string[]) {
    // need to convert to an array so that handlePopoverStatus will work
    if (typeof panels === 'string') {
      setActivePanels([panels]);
    } else {
      setActivePanels(panels);
    }
  }

  const content = (
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
          {appliedIndicators.length ? (
            <Collapse.Panel
              key="applied"
              header={
                <Title bold color={theme.colors.success.base}>
                  <CheckCircleFilled />{' '}
                  {t('Applied Filters (%d)', appliedIndicators.length)}
                </Title>
              }
            >
              <Indent>
                {appliedIndicators.map(indicator => (
                  <Indicator
                    key={indicator.column}
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
              header={
                <Title bold color={theme.colors.alert.base}>
                  <ExclamationCircleFilled />{' '}
                  {t(
                    'Incompatible Filters (%d)',
                    incompatibleIndicators.length,
                  )}
                </Title>
              }
            >
              <Indent>
                {incompatibleIndicators.map(indicator => (
                  <Indicator
                    key={indicator.column}
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
              header={
                <Title bold color={theme.colors.grayscale.light1}>
                  <MinusCircleFilled />{' '}
                  {t('Unset Filters (%d)', unsetIndicators.length)}
                </Title>
              }
              disabled={!unsetIndicators.length}
            >
              <Indent>
                {unsetIndicators.map(indicator => (
                  <Indicator
                    key={indicator.column}
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
  );

  return (
    <Popover
      overlayClassName="filterStatusPopover"
      content={content}
      onVisibleChange={handlePopoverStatus}
      placement="bottom"
      trigger="click"
    >
      {children}
    </Popover>
  );
};

export default DetailsPanelPopover;
