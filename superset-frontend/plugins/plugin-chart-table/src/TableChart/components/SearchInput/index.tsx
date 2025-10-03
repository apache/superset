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
import { t, tn } from '@superset-ui/core';
import { Input, Space } from '@superset-ui/core/components';
import { SearchInputProps } from '../../../DataTable';

export default function SearchInput({
  count,
  value,
  onChange,
  onBlur,
  inputRef,
}: SearchInputProps) {
  return (
    <Space direction="horizontal" size="small" className="dt-global-filter">
      {t('Search')}
      <Input
        aria-label={t('Search %s records', count)}
        placeholder={tn('%s record', '%s records...', count, count)}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        ref={inputRef}
      />
    </Space>
  );
}
