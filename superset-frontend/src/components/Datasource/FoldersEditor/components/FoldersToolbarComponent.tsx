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

import { memo, useMemo } from 'react';
import { t, tn } from '@apache-superset/core';
import { Button, Input, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  FoldersToolbar,
  FoldersSearch,
  FoldersActions,
  FoldersActionsRow,
  SelectionCount,
} from '../styles';

interface FoldersToolbarComponentProps {
  onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddFolder: () => void;
  onSelectAll: () => void;
  onResetToDefault: () => void;
  allVisibleSelected: boolean;
  selectedColumnsCount: number;
  selectedMetricsCount: number;
  totalColumnsCount: number;
  totalMetricsCount: number;
}

function FoldersToolbarComponentInner({
  onSearch,
  onAddFolder,
  onSelectAll,
  onResetToDefault,
  allVisibleSelected,
  selectedColumnsCount,
  selectedMetricsCount,
  totalColumnsCount,
  totalMetricsCount,
}: FoldersToolbarComponentProps) {
  const selectedCount = selectedColumnsCount + selectedMetricsCount;
  const totalCount = totalColumnsCount + totalMetricsCount;

  const tooltipTitle = useMemo(() => {
    if (selectedCount > 0) {
      return (
        <>
          {tn(
            '%s out of %s column',
            '%s out of %s columns',
            totalColumnsCount,
            selectedColumnsCount,
            totalColumnsCount,
          )}
          <br />
          {tn(
            '%s out of %s metric',
            '%s out of %s metrics',
            totalMetricsCount,
            selectedMetricsCount,
            totalMetricsCount,
          )}
        </>
      );
    }
    return (
      <>
        {tn('%s column', '%s columns', totalColumnsCount, totalColumnsCount)}
        <br />
        {tn('%s metric', '%s metrics', totalMetricsCount, totalMetricsCount)}
      </>
    );
  }, [
    selectedCount,
    selectedColumnsCount,
    selectedMetricsCount,
    totalColumnsCount,
    totalMetricsCount,
  ]);

  const counterText =
    selectedCount > 0
      ? t('%s out of %s selected', selectedCount, totalCount)
      : tn('%s item', '%s items', totalCount, totalCount);

  return (
    <FoldersToolbar>
      <FoldersSearch>
        <Input
          placeholder={t('Search all metrics & columns')}
          onChange={onSearch}
          allowClear
          prefix={<Icons.SearchOutlined />}
        />
      </FoldersSearch>
      <FoldersActionsRow>
        <FoldersActions>
          <Button
            buttonStyle="link"
            onClick={onAddFolder}
            icon={<Icons.PlusOutlined />}
          >
            {t('Add folder')}
          </Button>
          <Button
            buttonStyle="link"
            onClick={onSelectAll}
            icon={<Icons.CheckOutlined />}
          >
            {allVisibleSelected ? t('Deselect all') : t('Select all')}
          </Button>
          <Button
            buttonStyle="link"
            onClick={onResetToDefault}
            icon={<Icons.HistoryOutlined />}
          >
            {t('Reset all folders to default')}
          </Button>
        </FoldersActions>
        <Tooltip title={tooltipTitle}>
          <SelectionCount>{counterText}</SelectionCount>
        </Tooltip>
      </FoldersActionsRow>
    </FoldersToolbar>
  );
}

export const FoldersToolbarComponent = memo(FoldersToolbarComponentInner);
