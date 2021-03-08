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
import SupersetAsyncSelect from 'src/components/AsyncSelect';
import { t } from '@superset-ui/core';
import { SelectRow } from './SelectRow';
import { DatabaseOption } from './DatabaseOption';
import { getQueryParams } from './getQueryParams';
import { DbMutator } from './dbMutator';

interface Props {
  disableFilters?: boolean;
  isDisabled?: boolean;
  currentDbId: number | null;
  mutator: React.MutableRefObject<DbMutator>;
  onChange: (db: any) => void;
  handleError: (msg: string) => void;
}

export function DatabaseSelect({
  disableFilters,
  isDisabled,
  currentDbId,
  mutator,
  onChange,
  handleError,
}: Props) {
  const queryParams = getQueryParams({ disableFilters });

  const select = (
    <SupersetAsyncSelect
      data-test="select-database"
      dataEndpoint={`/api/v1/database/?q=${queryParams}`}
      onChange={onChange}
      onAsyncError={() => handleError(t('Error while fetching database list'))}
      clearable={false}
      value={currentDbId}
      valueKey="id"
      valueRenderer={(db: any) => (
        <div>
          <span className="text-muted m-r-5">{t('Database:')}</span>
          <DatabaseOption
            backend={db.backend}
            database_name={db.database_name}
          />
        </div>
      )}
      optionRenderer={(db: any) => (
        <DatabaseOption backend={db.backend} database_name={db.database_name} />
      )}
      mutator={mutator.current}
      placeholder={t('Select a database')}
      autoSelect
      isDisabled={!!isDisabled}
    />
  );
  return <SelectRow select={select} />;
}
