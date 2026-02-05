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
import { styled, t } from '@apache-superset/core';
import { Checkbox } from '@superset-ui/core/components';

const Container = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 4}px 0;
  `}
`;

const HeaderRow = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${theme.sizeUnit * 3}px;
    padding: 0 ${theme.sizeUnit * 4}px;
  `}
`;

const SelectionInfo = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextSecondary};
    font-size: ${theme.sizeUnit * 3.5}px;
  `}
`;

const Actions = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const ActionLink = styled.a`
  ${({ theme }) => `
    color: ${theme.colorPrimary};
    cursor: pointer;
    font-size: ${theme.sizeUnit * 3.5}px;

    &:hover {
      text-decoration: underline;
    }
  `}
`;

const ChartList = styled.div`
  ${({ theme }) => `
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.sizeUnit}px;
  `}
`;

const ChartItem = styled.div<{ disabled?: boolean }>`
  ${({ theme, disabled }) => `
    display: flex;
    align-items: center;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    cursor: ${disabled ? 'not-allowed' : 'pointer'};
    opacity: ${disabled ? 0.5 : 1};

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background-color: ${disabled ? 'transparent' : theme.colorBgTextHover};
    }
  `}
`;

const ChartName = styled.span`
  ${({ theme }) => `
    margin-left: ${theme.sizeUnit * 2}px;
    font-size: ${theme.sizeUnit * 3.5}px;
  `}
`;

const ChartMeta = styled.span`
  ${({ theme }) => `
    margin-left: auto;
    color: ${theme.colorTextSecondary};
    font-size: ${theme.sizeUnit * 3}px;
  `}
`;

export interface ChartInfo {
  id: number;
  name: string;
  vizType?: string;
}

export interface ChartSelectorProps {
  charts: ChartInfo[];
  selectedChartIds: Set<number>;
  onSelectionChange: (selectedIds: Set<number>) => void;
  disabled?: boolean;
}

export const ChartSelector = ({
  charts,
  selectedChartIds,
  onSelectionChange,
  disabled = false,
}: ChartSelectorProps) => {
  const handleSelectAll = () => {
    const allIds = new Set(charts.map(c => c.id));
    onSelectionChange(allIds);
  };

  const handleDeselectAll = () => {
    onSelectionChange(new Set());
  };

  const handleToggleChart = (chartId: number) => {
    if (disabled) return;

    const newSelection = new Set(selectedChartIds);
    if (newSelection.has(chartId)) {
      newSelection.delete(chartId);
    } else {
      newSelection.add(chartId);
    }
    onSelectionChange(newSelection);
  };

  return (
    <Container>
      <HeaderRow>
        <SelectionInfo>
          {t('%s of %s charts selected', selectedChartIds.size, charts.length)}
        </SelectionInfo>
        <Actions>
          <ActionLink onClick={handleSelectAll}>
            {t('Select all')}
          </ActionLink>
          <span>|</span>
          <ActionLink onClick={handleDeselectAll}>
            {t('Deselect all')}
          </ActionLink>
        </Actions>
      </HeaderRow>

      <ChartList>
        {charts.map(chart => (
          <ChartItem
            key={chart.id}
            onClick={() => handleToggleChart(chart.id)}
            disabled={disabled}
          >
            <Checkbox
              checked={selectedChartIds.has(chart.id)}
              onChange={() => handleToggleChart(chart.id)}
              disabled={disabled}
            />
            <ChartName>{chart.name || t('Untitled Chart')}</ChartName>
            {chart.vizType && (
              <ChartMeta>{chart.vizType}</ChartMeta>
            )}
          </ChartItem>
        ))}
      </ChartList>
    </Container>
  );
};
