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
import { t, css, SupersetTheme } from '@superset-ui/core';
import { RawAntdSelect as Select } from '@superset-ui/core/components';
import { SelectPageSizeRendererProps } from '../../../DataTable';
import VisuallyHidden from '../VisuallyHidden';

export default function SelectPageSize({
  options,
  current,
  onChange,
}: SelectPageSizeRendererProps) {
  const { Option } = Select;

  return (
    <span className="dt-select-page-size">
      <VisuallyHidden htmlFor="pageSizeSelect">
        {t('Select page size')}
      </VisuallyHidden>
      {t('Show')}{' '}
      <Select<number>
        id="pageSizeSelect"
        value={current}
        onChange={value => onChange(value)}
        size="small"
        css={(theme: SupersetTheme) => css`
          width: ${theme.sizeUnit * 18}px;
        `}
        aria-label={t('Show entries per page')}
      >
        {options.map(option => {
          const [size, text] = Array.isArray(option)
            ? option
            : [option, option];
          return (
            <Option key={size} value={Number(size)}>
              {text}
            </Option>
          );
        })}
      </Select>{' '}
      {t('entries per page')}
    </span>
  );
}
