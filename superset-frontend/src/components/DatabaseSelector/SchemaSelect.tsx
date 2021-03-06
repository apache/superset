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
import RefreshLabel from 'src/components/RefreshLabel';
import { Select } from 'src/components/Select';
import { t } from '@superset-ui/core';
import { SelectRow } from './SelectRow';

interface Props {
  hasRefresh?: boolean;
  schemaOptions: any[];
  currentSchema: any;
  loading: boolean;
  readOnly?: boolean;
  onChange: (schema: { value: string; label: string; title: string }) => void;
  refresh?: () => void;
}

export function SchemaSelect({
  hasRefresh,
  readOnly,
  loading,
  schemaOptions,
  currentSchema,
  onChange,
  refresh,
}: Props) {
  const value = schemaOptions.filter(({ value }) => currentSchema === value);
  const refreshBtn =
    hasRefresh && refresh ? (
      <RefreshLabel
        onClick={() => refresh()}
        tooltipContent={t('Force refresh schema list')}
      />
    ) : undefined;

  const select = (
    <Select
      name="select-schema"
      placeholder={t('Select a schema (%s)', schemaOptions.length)}
      options={schemaOptions}
      value={value}
      valueRenderer={o => (
        <div>
          <span className="text-muted">{t('Schema:')}</span> {o.label}
        </div>
      )}
      isLoading={loading}
      autosize={false}
      onChange={onChange}
      isDisabled={readOnly}
    />
  );

  return <SelectRow select={select} refreshBtn={refreshBtn} />;
}
