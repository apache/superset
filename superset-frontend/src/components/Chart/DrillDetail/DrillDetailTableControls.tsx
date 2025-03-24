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

import { useCallback, useMemo } from 'react';
import { Tag } from 'src/components/Tags';
import {
  BinaryQueryObjectFilterClause,
  css,
  isAdhocColumn,
  t,
  useTheme,
} from '@superset-ui/core';
import RowCountLabel from 'src/explore/components/RowCountLabel';
import Icons from 'src/components/Icons';

export type TableControlsProps = {
  filters: BinaryQueryObjectFilterClause[];
  setFilters: (filters: BinaryQueryObjectFilterClause[]) => void;
  totalCount?: number;
  loading: boolean;
  onReload: () => void;
};

export default function TableControls({
  filters,
  setFilters,
  totalCount,
  loading,
  onReload,
}: TableControlsProps) {
  const theme = useTheme();
  const filterMap: Record<string, BinaryQueryObjectFilterClause> = useMemo(
    () =>
      Object.assign(
        {},
        ...filters.map(filter => ({
          [isAdhocColumn(filter.col)
            ? (filter.col.label as string)
            : filter.col]: filter,
        })),
      ),
    [filters],
  );

  const removeFilter = useCallback(
    colName => {
      const updatedFilterMap = { ...filterMap };
      delete updatedFilterMap[colName];
      setFilters([...Object.values(updatedFilterMap)]);
    },
    [filterMap, setFilters],
  );

  const filterTags = useMemo(
    () =>
      Object.entries(filterMap)
        .map(([colName, { val, formattedVal }]) => ({
          colName,
          val: formattedVal ?? val,
        }))
        .sort((a, b) => a.colName.localeCompare(b.colName)),
    [filterMap],
  );

  return (
    <div
      css={css`
        display: flex;
        justify-content: space-between;
        padding: ${theme.gridUnit / 2}px 0;
        margin-bottom: ${theme.gridUnit * 2}px;
      `}
    >
      <div
        css={css`
          display: flex;
          flex-wrap: wrap;
        `}
      >
        {filterTags.map(({ colName, val }, index) => (
          <Tag
            editable
            onDelete={removeFilter.bind(null, colName)}
            index={index}
            id={index}
            key={colName}
            name={`${colName}=${val}`}
            data-test="filter-col"
          >
            <span
              css={css`
                margin-right: ${theme.gridUnit}px;
              `}
            >
              {colName}
            </span>
            <strong data-test="filter-val">{val}</strong>
          </Tag>
        ))}
      </div>
      <div
        css={css`
          display: flex;
          align-items: center;
          height: min-content;
        `}
      >
        <RowCountLabel loading={loading && !totalCount} rowcount={totalCount} />
        <Icons.ReloadOutlined
          iconColor={theme.colors.grayscale.light1}
          iconSize="l"
          aria-label={t('Reload')}
          role="button"
          onClick={onReload}
        />
      </div>
    </div>
  );
}
