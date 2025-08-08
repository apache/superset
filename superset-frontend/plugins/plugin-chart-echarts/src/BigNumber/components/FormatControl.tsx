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
import { FC, useState } from 'react';
import { t, SMART_DATE_ID } from '@superset-ui/core';
import { Select, Switch, Input } from '@superset-ui/core/components';
import {
  ControlHeader,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
} from '@superset-ui/chart-controls';

export interface FormatControlProps {
  name: string;
  label?: string;
  description?: string;
  value?: string;
  onChange?: (value: string) => void;
  formatType?: 'number' | 'time' | 'currency';
  freeForm?: boolean;
  renderTrigger?: boolean;
  validationErrors?: string[];
}

const FormatControl: FC<FormatControlProps> = ({
  name,
  label,
  description,
  value,
  onChange,
  formatType = 'number',
  freeForm = true,
  renderTrigger,
  validationErrors,
}) => {
  const [customFormat, setCustomFormat] = useState(false);

  const getOptions = () => {
    switch (formatType) {
      case 'time':
        return D3_TIME_FORMAT_OPTIONS;
      case 'currency':
        return [
          ['$,.2f', '$1,234.56'],
          ['$,.0f', '$1,235'],
          ['€,.2f', '€1,234.56'],
          ['£,.2f', '£1,234.56'],
          ['¥,.0f', '¥1,235'],
        ];
      case 'number':
      default:
        return D3_FORMAT_OPTIONS;
    }
  };

  const getLabel = () => {
    switch (formatType) {
      case 'time':
        return label || t('Date Format');
      case 'currency':
        return label || t('Currency Format');
      case 'number':
      default:
        return label || t('Number Format');
    }
  };

  const getDescription = () => {
    if (description) return description;
    if (formatType === 'time') {
      return t('D3 time format string');
    }
    return D3_FORMAT_DOCS;
  };

  const options = getOptions().map(opt => ({
    value: Array.isArray(opt) ? opt[0] : opt,
    label: Array.isArray(opt) ? `${opt[0]} (${opt[1]})` : opt,
  }));

  return (
    <div>
      <ControlHeader
        name={name}
        label={getLabel()}
        description={getDescription()}
        validationErrors={validationErrors}
        renderTrigger={renderTrigger}
      />
      {freeForm && (
        <div style={{ marginBottom: '8px' }}>
          <Switch
            checked={customFormat}
            onChange={setCustomFormat}
            size="small"
          />
          <span style={{ marginLeft: '8px' }}>{t('Custom format')}</span>
        </div>
      )}
      {customFormat ? (
        <Input
          value={value}
          onChange={(e: any) => onChange?.(e.target.value)}
          placeholder={t('Enter custom format string')}
        />
      ) : (
        <Select
          value={value || (formatType === 'time' ? SMART_DATE_ID : '.3s')}
          onChange={(val: any) => onChange?.(val)}
          options={options}
          showSearch
          css={{ width: '100%' }}
        />
      )}
    </div>
  );
};

export default FormatControl;
