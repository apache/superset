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
import { t } from '@superset-ui/core';
import { Button, Input } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { FoldersToolbar, FoldersSearch, FoldersActions } from '../styles';

interface FoldersToolbarComponentProps {
  onSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddFolder: () => void;
  onSelectAll: () => void;
  onResetToDefault: () => void;
  allVisibleSelected: boolean;
}

function FoldersToolbarComponentInner({
  onSearch,
  onAddFolder,
  onSelectAll,
  onResetToDefault,
  allVisibleSelected,
}: FoldersToolbarComponentProps) {
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
    </FoldersToolbar>
  );
}

export const FoldersToolbarComponent = memo(FoldersToolbarComponentInner);
