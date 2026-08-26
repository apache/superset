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
import { useState } from 'react';
import type { ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { GenericDataType } from '@apache-superset/core/common';
import { EmptyState, Input } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { ColumnTypeLabel } from '@superset-ui/chart-controls';

interface MockColumn {
  readonly name: string;
  readonly type: GenericDataType;
}

interface MockDataset {
  readonly id: string;
  readonly name: string;
  readonly columns: readonly MockColumn[];
}

/**
 * Static placeholder rows. The Data tab does not call the dataset API —
 * a later change wires this list, and each dataset's columns, to
 * `/api/v1/dataset/`, the same endpoint `datasetMetadata.ts` already reads a
 * single bound dataset's columns from.
 */
const MOCK_DATASETS: readonly MockDataset[] = [
  {
    id: 'sales',
    name: 'sales',
    columns: [
      { name: 'order_id', type: GenericDataType.String },
      { name: 'order_date', type: GenericDataType.Temporal },
      { name: 'sales_amount', type: GenericDataType.Numeric },
      { name: 'region', type: GenericDataType.String },
    ],
  },
  {
    id: 'coffee_sales',
    name: 'coffee_sales',
    columns: [
      { name: 'product', type: GenericDataType.String },
      { name: 'roast_date', type: GenericDataType.Temporal },
      { name: 'unit_price', type: GenericDataType.Numeric },
      { name: 'is_decaf', type: GenericDataType.Boolean },
    ],
  },
];

const matches = (dataset: MockDataset, query: string): boolean =>
  query.trim() === '' ||
  dataset.name.toLowerCase().includes(query.trim().toLowerCase());

/**
 * The panel's own scroll column, set down from the tab bar and in from the
 * panel edge — the same step `Palette`'s `Column` and `Outline`'s `Panel`
 * take from theirs, so the four tabs of one rail start on one line.
 */
const Column = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 5}px;
    min-height: 0;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit}px 0;
  `}
`;

const List = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    overflow-y: auto;
    min-height: 0;
  `}
`;

const DatasetButton = styled.button`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    width: 100%;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadiusSM}px;
    background-color: ${theme.colorFillQuaternary};
    color: ${theme.colorText};
    font-size: ${theme.fontSizeSM}px;
    text-align: left;
    cursor: pointer;
    transition: background-color ${theme.motionDurationMid};

    .data-panel-chevron {
      display: flex;
      flex: 0 0 auto;
      color: ${theme.colorTextTertiary};
    }

    &:hover {
      background-color: ${theme.colorFillTertiary};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: -2px;
    }
  `}
`;

const ColumnList = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    margin-top: ${theme.sizeUnit}px;
    margin-left: ${theme.sizeUnit * 2}px;
    padding-left: ${theme.sizeUnit * 3}px;
    border-left: 1px solid ${theme.colorBorder};
  `}
`;

const ColumnRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorText};
  `}
`;

/**
 * Datasets and their columns, to browse rather than to place.
 *
 * Building Blocks places widgets onto the canvas; this tab answers "what
 * data is there to use" without touching any widget's binding — expanding a
 * row reads its columns and nothing else happens.
 */
export default function DataPanel(): ReactElement {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const found = MOCK_DATASETS.filter(dataset => matches(dataset, query));

  const toggle = (id: string): void =>
    setExpanded(previous => {
      const next = new Set(previous);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  return (
    <Column data-test="data-panel">
      <Input
        allowClear
        value={query}
        aria-label={t('Search datasets')}
        placeholder={t('Search datasets…')}
        data-test="data-panel-search"
        prefix={<Icons.SearchOutlined iconSize="s" />}
        onChange={event => setQuery(event.target.value)}
      />
      {found.length === 0 ? (
        <div data-test="data-panel-empty">
          <EmptyState
            size="small"
            image="filter-results.svg"
            title={t('No matching datasets')}
            description={t('Nothing here is called “%s”.', query)}
          />
        </div>
      ) : (
        <List>
          {found.map(dataset => {
            const isOpen = expanded.has(dataset.id);
            return (
              <div
                key={dataset.id}
                data-test={`data-panel-dataset-${dataset.id}`}
              >
                <DatasetButton
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(dataset.id)}
                >
                  <span className="data-panel-chevron" aria-hidden>
                    {isOpen ? (
                      <Icons.UpOutlined iconSize="s" />
                    ) : (
                      <Icons.DownOutlined iconSize="s" />
                    )}
                  </span>
                  {dataset.name}
                </DatasetButton>
                {isOpen && (
                  <ColumnList data-test={`data-panel-columns-${dataset.id}`}>
                    {dataset.columns.map(column => (
                      <ColumnRow key={column.name}>
                        <ColumnTypeLabel type={column.type} />
                        {column.name}
                      </ColumnRow>
                    ))}
                  </ColumnList>
                )}
              </div>
            );
          })}
        </List>
      )}
    </Column>
  );
}
