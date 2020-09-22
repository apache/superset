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
import React from 'react';
import { useTheme } from '@superset-ui/core';
import {
  SearchOutlined,
  MinusCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { Collapse } from 'src/common/components/index';
import S from './Styles';
import { APPLIED, INCOMPATIBLE, UNSET } from './selectors';

export type Indicator = {
  id: string;
  name: string;
  value: string[];
  status: typeof APPLIED | typeof UNSET | typeof INCOMPATIBLE;
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
  <S.Item onClick={() => onClick(path)}>
    <S.ItemIcon>
      <SearchOutlined />
    </S.ItemIcon>
    <S.Title bold>{name.toUpperCase()}</S.Title>
    {value.length ? `: ${value.join(', ')}` : ''}
  </S.Item>
);

export interface DetailsPanelProps {
  appliedIndicators: Indicator[];
  incompatibleIndicators: Indicator[];
  unsetIndicators: Indicator[];
  onHighlightFilterSource: (path: string) => void;
}

const DetailsPanel = ({
  appliedIndicators = [],
  incompatibleIndicators = [],
  unsetIndicators = [],
  onHighlightFilterSource,
}: DetailsPanelProps) => {
  const theme = useTheme();
  const total =
    appliedIndicators.length +
    incompatibleIndicators.length +
    unsetIndicators.length;
  return (
    <S.Panel>
      <div>{`${total} Scoped Filters`}</div>
      <S.Reset>
        <Collapse ghost defaultActiveKey={['applied', 'incompatible']}>
          {appliedIndicators.length ? (
            <Collapse.Panel
              key="applied"
              header={
                <S.Title color={theme.colors.success.base}>
                  <CheckCircleFilled />
                  {` Applied (${appliedIndicators.length})`}
                </S.Title>
              }
            >
              <S.Indent>
                {appliedIndicators.map(indicator => (
                  <Indicator
                    key={indicator.id}
                    indicator={indicator}
                    onClick={onHighlightFilterSource}
                  />
                ))}
              </S.Indent>
            </Collapse.Panel>
          ) : null}
          {incompatibleIndicators.length ? (
            <Collapse.Panel
              key="incompatible"
              header={
                <S.Title color={theme.colors.alert.base}>
                  <ExclamationCircleFilled />
                  {` Incompatible (${incompatibleIndicators.length})`}
                </S.Title>
              }
            >
              <S.Indent>
                {incompatibleIndicators.map(indicator => (
                  <Indicator
                    key={indicator.id}
                    indicator={indicator}
                    onClick={onHighlightFilterSource}
                  />
                ))}
              </S.Indent>
            </Collapse.Panel>
          ) : null}
          <Collapse.Panel
            key="unset"
            header={
              <S.Title color={theme.colors.grayscale.dark1}>
                <MinusCircleFilled />
                {` Unset (${unsetIndicators.length})`}
              </S.Title>
            }
            disabled={!unsetIndicators.length}
          >
            <S.Indent>
              {unsetIndicators.map(indicator => (
                <Indicator
                  key={indicator.id}
                  indicator={indicator}
                  onClick={onHighlightFilterSource}
                />
              ))}
            </S.Indent>
          </Collapse.Panel>
        </Collapse>
      </S.Reset>
    </S.Panel>
  );
};

export default DetailsPanel;
