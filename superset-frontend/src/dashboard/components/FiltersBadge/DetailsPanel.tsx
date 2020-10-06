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
import { useTheme } from '@superset-ui/core';
import {
  SearchOutlined,
  MinusCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { Collapse, Popover } from 'src/common/components/index';
import { Indent, Item, ItemIcon, Panel, Reset, Title } from './Styles';
import { IndicatorStatus } from './selectors';

export type Indicator = {
  id: string;
  name: string;
  value: string[];
  status: IndicatorStatus;
  path: string;
};

export interface IndicatorProps {
  indicator: Indicator;
  onClick: (path: string) => void;
}

const Indicator = ({
  indicator: { name, value = [], path },
  onClick,
}: IndicatorProps) => (
  <Item onClick={() => onClick(path)}>
    <ItemIcon>
      <SearchOutlined />
    </ItemIcon>
    <Title bold>{name.toUpperCase()}</Title>
    {value.length ? `: ${value.join(', ')}` : ''}
  </Item>
);

export interface DetailsPanelProps {
  appliedIndicators: Indicator[];
  incompatibleIndicators: Indicator[];
  unsetIndicators: Indicator[];
  onHighlightFilterSource: (path: string) => void;
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

  const [activePanel, setActivePanel] = useState(defaultActivePanel);

  function handlePopoverStatus(isOpen: boolean) {
    // every time the popover opens, choose the active panel anew
    if (isOpen) {
      setActivePanel(defaultActivePanel());
    }
  }

  const total =
    appliedIndicators.length +
    incompatibleIndicators.length +
    unsetIndicators.length;

  const content = (
    <Panel>
      <div>{`${total} Scoped Filters`}</div>
      <Reset>
        <Collapse ghost activeKey={[activePanel]}>
          {appliedIndicators.length ? (
            <Collapse.Panel
              key="applied"
              header={
                <Title color={theme.colors.success.base}>
                  <CheckCircleFilled />
                  {` Applied (${appliedIndicators.length})`}
                </Title>
              }
            >
              <Indent>
                {appliedIndicators.map(indicator => (
                  <Indicator
                    key={indicator.id}
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
                <Title color={theme.colors.alert.base}>
                  <ExclamationCircleFilled />
                  {` Incompatible (${incompatibleIndicators.length})`}
                </Title>
              }
            >
              <Indent>
                {incompatibleIndicators.map(indicator => (
                  <Indicator
                    key={indicator.id}
                    indicator={indicator}
                    onClick={onHighlightFilterSource}
                  />
                ))}
              </Indent>
            </Collapse.Panel>
          ) : null}
          <Collapse.Panel
            key="unset"
            header={
              <Title color={theme.colors.grayscale.dark1}>
                <MinusCircleFilled />
                {` Unset (${unsetIndicators.length})`}
              </Title>
            }
            disabled={!unsetIndicators.length}
          >
            <Indent>
              {unsetIndicators.map(indicator => (
                <Indicator
                  key={indicator.id}
                  indicator={indicator}
                  onClick={onHighlightFilterSource}
                />
              ))}
            </Indent>
          </Collapse.Panel>
        </Collapse>
      </Reset>
    </Panel>
  );

  return (
    <Popover
      content={content}
      onVisibleChange={handlePopoverStatus}
      placement="bottomRight"
      trigger="click"
    >
      {children}
    </Popover>
  );
};

export default DetailsPanelPopover;
