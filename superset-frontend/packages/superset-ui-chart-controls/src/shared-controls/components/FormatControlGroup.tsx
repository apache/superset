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
import { FC } from 'react';
import { t } from '@superset-ui/core';
import { Select } from 'antd';
import { Row, Col } from '@superset-ui/core/components';

export interface FormatControlGroupProps {
  showNumber?: boolean;
  showCurrency?: boolean;
  showDate?: boolean;
  showPercentage?: boolean;
  numberFormatLabel?: string;
  currencyFormatLabel?: string;
  dateFormatLabel?: string;
  percentageFormatLabel?: string;
  customFormatOptions?: Array<[string, string]>;
  values?: Record<string, any>;
  onChange?: (name: string, value: any) => void;
}

export const D3_FORMAT_OPTIONS = [
  ['SMART_NUMBER', t('Adaptive formatting')],
  ['~g', t('Original value')],
  ['d', t('Signed integer')],
  ['.0f', t('Integer')],
  ['.1f', t('1 decimal place')],
  ['.2f', t('2 decimal places')],
  ['.3f', t('3 decimal places')],
  ['.4f', t('4 decimal places')],
  ['.5f', t('5 decimal places')],
  ['+,', t('Positive integer')],
  ['+,.0f', t('Positive number')],
  ['+,.1f', t('Positive (1 decimal)')],
  ['+,.2f', t('Positive (2 decimals)')],
  [',.0f', t('Number (no decimals)')],
  [',.1f', t('Number (1 decimal)')],
  [',.2f', t('Number (2 decimals)')],
  [',.3f', t('Number (3 decimals)')],
  ['.0%', t('Percentage')],
  ['.1%', t('Percentage (1 decimal)')],
  ['.2%', t('Percentage (2 decimals)')],
  ['.3%', t('Percentage (3 decimals)')],
  [',.0%', t('Percentage with thousands')],
  ['.1s', t('SI notation')],
  ['.2s', t('SI notation (2 decimals)')],
  ['.3s', t('SI notation (3 decimals)')],
  ['$,.0f', t('Currency (no decimals)')],
  ['$,.1f', t('Currency (1 decimal)')],
  ['$,.2f', t('Currency (2 decimals)')],
  ['$,.3f', t('Currency (3 decimals)')],
];

export const D3_TIME_FORMAT_OPTIONS = [
  ['smart_date', t('Adaptive formatting')],
  ['%Y-%m-%d', t('YYYY-MM-DD')],
  ['%Y-%m-%d %H:%M', t('YYYY-MM-DD HH:MM')],
  ['%Y-%m-%d %H:%M:%S', t('YYYY-MM-DD HH:MM:SS')],
  ['%Y/%m/%d', t('YYYY/MM/DD')],
  ['%m/%d/%Y', t('MM/DD/YYYY')],
  ['%d/%m/%Y', t('DD/MM/YYYY')],
  ['%d.%m.%Y', t('DD.MM.YYYY')],
  ['%Y', t('Year (YYYY)')],
  ['%B %Y', t('Month Year (January 2023)')],
  ['%b %Y', t('Month Year (Jan 2023)')],
  ['%B', t('Month (January)')],
  ['%b', t('Month (Jan)')],
  ['%B %-d, %Y', t('Month Day, Year')],
  ['%b %-d, %Y', t('Mon Day, Year')],
  ['%a', t('Day of week (short)')],
  ['%A', t('Day of week (full)')],
  ['%H:%M', t('Time (24-hour)')],
  ['%I:%M %p', t('Time (12-hour)')],
  ['%H:%M:%S', t('Time with seconds')],
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'CNY', label: 'CNY (¥)' },
  { value: 'INR', label: 'INR (₹)' },
  { value: 'CAD', label: 'CAD ($)' },
  { value: 'AUD', label: 'AUD ($)' },
  { value: 'CHF', label: 'CHF (Fr)' },
  { value: 'SEK', label: 'SEK (kr)' },
  { value: 'NOK', label: 'NOK (kr)' },
  { value: 'DKK', label: 'DKK (kr)' },
  { value: 'KRW', label: 'KRW (₩)' },
  { value: 'BRL', label: 'BRL (R$)' },
  { value: 'MXN', label: 'MXN ($)' },
  { value: 'RUB', label: 'RUB (₽)' },
];

const FormatControlGroup: FC<FormatControlGroupProps> = ({
  showNumber = true,
  showCurrency = false,
  showDate = false,
  showPercentage = false,
  numberFormatLabel = t('Number format'),
  currencyFormatLabel = t('Currency'),
  dateFormatLabel = t('Date format'),
  percentageFormatLabel = t('Percentage format'),
  customFormatOptions = [],
  values = {},
  onChange = () => {},
}) => {
  const formatOptions =
    customFormatOptions.length > 0 ? customFormatOptions : D3_FORMAT_OPTIONS;

  return (
    <div className="format-control-group">
      {showNumber && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{numberFormatLabel}</label>
            <Select
              value={values.number_format || 'SMART_NUMBER'}
              onChange={value => onChange('number_format', value)}
              style={{ width: '100%' }}
              showSearch
              placeholder={t('Select or type a custom format')}
              options={formatOptions.map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <small className="text-muted">
              {t('D3 format string for numbers. See ')}
              <a
                href="https://github.com/d3/d3-format/blob/main/README.md#format"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('D3 format docs')}
              </a>
              {t(' for details.')}
            </small>
          </Col>
        </Row>
      )}

      {showCurrency && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{currencyFormatLabel}</label>
            <Select
              value={values.currency_format || 'USD'}
              onChange={value => onChange('currency_format', value)}
              style={{ width: '100%' }}
              showSearch
              placeholder={t('Select currency')}
              options={CURRENCY_OPTIONS}
            />
            <small className="text-muted">
              {t('Currency to use for formatting')}
            </small>
          </Col>
        </Row>
      )}

      {showDate && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{dateFormatLabel}</label>
            <Select
              value={values.date_format || 'smart_date'}
              onChange={value => onChange('date_format', value)}
              style={{ width: '100%' }}
              showSearch
              placeholder={t('Select or type a custom format')}
              options={D3_TIME_FORMAT_OPTIONS.map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <small className="text-muted">
              {t('D3 time format string. See ')}
              <a
                href="https://github.com/d3/d3-time-format/blob/main/README.md#locale_format"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('D3 time format docs')}
              </a>
              {t(' for details.')}
            </small>
          </Col>
        </Row>
      )}

      {showPercentage && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{percentageFormatLabel}</label>
            <Select
              value={values.percentage_format || '.0%'}
              onChange={value => onChange('percentage_format', value)}
              style={{ width: '100%' }}
              showSearch
              placeholder={t('Select or type a custom format')}
              options={[
                ['.0%', t('0%')],
                ['.1%', t('0.1%')],
                ['.2%', t('0.12%')],
                ['.3%', t('0.123%')],
                [',.0%', t('1,234%')],
                [',.1%', t('1,234.5%')],
              ].map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <small className="text-muted">
              {t('D3 format for percentages')}
            </small>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default FormatControlGroup;
