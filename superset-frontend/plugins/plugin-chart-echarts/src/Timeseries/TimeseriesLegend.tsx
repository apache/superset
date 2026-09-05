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
import { memo } from 'react';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import type { TimeseriesCustomLegend } from './types';

const LegendViewport = styled.div<{ maxHeight: number }>`
  ${({ maxHeight, theme }) => `
    box-sizing: border-box;
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    max-height: ${maxHeight}px;
    overflow-x: hidden;
    overflow-y: auto;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    width: 100%;
  `}
`;

const SelectorRow = styled.div`
  ${({ theme }) => `
    align-items: center;
    background: ${theme.colorBgContainer};
    display: flex;
    gap: ${theme.sizeUnit}px;
    justify-content: flex-end;
    padding-bottom: ${theme.sizeUnit}px;
    position: sticky;
    top: 0;
    z-index: 1;
  `}
`;

const SelectorButton = styled.button`
  ${({ theme }) => `
    background: transparent;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorText};
    cursor: pointer;
    font: inherit;
    padding: 0 ${theme.sizeUnit}px;

    &:hover {
      color: ${theme.colorPrimary};
    }
  `}
`;

const ItemList = styled.ul`
  ${({ theme }) => `
    align-items: flex-start;
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 2}px;
    list-style: none;
    margin: 0;
    padding: 0;
  `}
`;

const LegendItem = styled.li`
  min-width: 0;
`;

const ItemButton = styled.button<{ selected: boolean }>`
  ${({ selected, theme }) => `
    align-items: flex-start;
    appearance: none;
    background: none;
    border: none;
    color: ${selected ? theme.colorText : theme.colorTextDisabled};
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    gap: ${theme.sizeUnit}px;
    max-width: 100%;
    padding: 0;
    text-align: left;

    &:disabled {
      cursor: default;
    }
  `}
`;

const Swatch = styled.span<{ color: string; selected: boolean }>`
  ${({ color, selected }) => `
    background: ${selected ? color : 'transparent'};
    border: 1px solid ${color};
    box-sizing: border-box;
    flex: 0 0 auto;
    height: 12px;
    margin-top: 2px;
    width: 12px;
  `}
`;

const Label = styled.span`
  overflow-wrap: anywhere;
  white-space: pre-line;
`;

const RowBreak = styled.li`
  flex-basis: 100%;
  height: 0;
`;

export type TimeseriesLegendProps = TimeseriesCustomLegend & {
  maxHeight: number;
  onAll: () => void;
  onHover?: (name: string | null) => void;
  onInverse: () => void;
  onToggle: (name: string) => void;
};

function TimeseriesLegend({
  items,
  maxHeight,
  onAll,
  onHover,
  onInverse,
  onToggle,
  showSelectors,
}: TimeseriesLegendProps) {
  if (items.length === 0 || maxHeight <= 0) {
    return null;
  }

  return (
    <LegendViewport data-test="timeseries-custom-legend" maxHeight={maxHeight}>
      {showSelectors && (
        <SelectorRow>
          <SelectorButton type="button" onClick={onAll}>
            {t('All')}
          </SelectorButton>
          <SelectorButton type="button" onClick={onInverse}>
            {t('Inverse')}
          </SelectorButton>
        </SelectorRow>
      )}
      <ItemList>
        {items.map((item, index) =>
          item.name === '' || item.name === '\n' ? (
            <RowBreak
              // ECharts treats these exact values as row-break sentinels.
              key={`row-break-${item.name}-${index}`}
            />
          ) : (
            <LegendItem key={item.name}>
              <ItemButton
                aria-pressed={item.selected}
                disabled={!item.interactive}
                selected={item.selected}
                type="button"
                onClick={() => {
                  if (item.interactive) {
                    onToggle(item.name);
                  }
                }}
                onMouseEnter={() => onHover?.(item.name)}
                onMouseLeave={() => onHover?.(null)}
              >
                <Swatch
                  aria-hidden
                  color={item.color}
                  selected={item.selected}
                />
                <Label>{item.name}</Label>
              </ItemButton>
            </LegendItem>
          ),
        )}
      </ItemList>
    </LegendViewport>
  );
}

export default memo(TimeseriesLegend);
