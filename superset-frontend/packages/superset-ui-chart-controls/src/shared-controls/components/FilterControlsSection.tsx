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
import { Switch, Select, Input, InputNumber } from 'antd';
import { Row, Col } from '@superset-ui/core/components';

export interface FilterControlsSectionProps {
  filterType: 'select' | 'range' | 'time' | 'time_column' | 'time_grain';
  showMultiple?: boolean;
  showSearch?: boolean;
  showParentFilter?: boolean;
  showDefaultValue?: boolean;
  showInverseSelection?: boolean;
  showDateFilter?: boolean;
  values?: Record<string, any>;
  onChange?: (name: string, value: any) => void;
}

const FilterControlsSection: FC<FilterControlsSectionProps> = ({
  filterType,
  showMultiple = true,
  showSearch = true,
  showParentFilter = true,
  showDefaultValue = true,
  showInverseSelection = false,
  showDateFilter = false,
  values = {},
  onChange = () => {},
}) => {
  const isSelect = filterType === 'select';
  const isRange = filterType === 'range';
  const isTime = filterType === 'time';
  const isTimeColumn = filterType === 'time_column';
  const isTimeGrain = filterType === 'time_grain';

  return (
    <div className="filter-controls-section">
      {/* Multiple Selection */}
      {showMultiple && isSelect && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.multiSelect || false}
                onChange={checked => onChange('multiSelect', checked)}
              />
              {t('Multiple Select')}
            </label>
            <small className="text-muted">
              {t('Allow selecting multiple values')}
            </small>
          </Col>
        </Row>
      )}

      {/* Search */}
      {showSearch && isSelect && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.enableEmptyFilter || false}
                onChange={checked => onChange('enableEmptyFilter', checked)}
              />
              {t('Enable Empty Filter')}
            </label>
            <small className="text-muted">
              {t('Allow empty filter values')}
            </small>
          </Col>
        </Row>
      )}

      {/* Inverse Selection */}
      {showInverseSelection && isSelect && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.inverseSelection || false}
                onChange={checked => onChange('inverseSelection', checked)}
              />
              {t('Inverse Selection')}
            </label>
            <small className="text-muted">
              {t('Exclude selected values instead of including them')}
            </small>
          </Col>
        </Row>
      )}

      {/* Parent Filter */}
      {showParentFilter && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.parentFilter || false}
                onChange={checked => onChange('parentFilter', checked)}
              />
              {t('Parent Filter')}
            </label>
            <small className="text-muted">
              {t('Filter is dependent on another filter')}
            </small>
          </Col>
        </Row>
      )}

      {/* Default Value */}
      {showDefaultValue && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Default Value')}</label>
            {isSelect ? (
              <Input
                value={values.defaultValue || ''}
                onChange={e => onChange('defaultValue', e.target.value)}
                placeholder={t('Enter default value')}
              />
            ) : isRange ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <InputNumber
                  value={values.defaultValueMin}
                  onChange={value => onChange('defaultValueMin', value)}
                  placeholder={t('Min')}
                  style={{ flex: 1 }}
                />
                <InputNumber
                  value={values.defaultValueMax}
                  onChange={value => onChange('defaultValueMax', value)}
                  placeholder={t('Max')}
                  style={{ flex: 1 }}
                />
              </div>
            ) : (
              <Input
                value={values.defaultValue || ''}
                onChange={e => onChange('defaultValue', e.target.value)}
                placeholder={t('Enter default value')}
              />
            )}
            <small className="text-muted">
              {t('Default value to use when filter is first loaded')}
            </small>
          </Col>
        </Row>
      )}

      {/* Sort Options for Select */}
      {isSelect && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Sort Filter Values')}</label>
            <Select
              value={values.sortFilter || false}
              onChange={value => onChange('sortFilter', value)}
              style={{ width: '100%' }}
              options={[
                { value: false, label: t('No Sort') },
                { value: true, label: t('Sort Ascending') },
                { value: 'desc', label: t('Sort Descending') },
              ]}
            />
            <small className="text-muted">
              {t('Sort filter values alphabetically')}
            </small>
          </Col>
        </Row>
      )}

      {/* Search for Select Filter */}
      {isSelect && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.searchAllOptions || false}
                onChange={checked => onChange('searchAllOptions', checked)}
              />
              {t('Search All Options')}
            </label>
            <small className="text-muted">
              {t('Search all filter options, not just displayed ones')}
            </small>
          </Col>
        </Row>
      )}

      {/* Range Options */}
      {isRange && (
        <>
          <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <label>{t('Min Value')}</label>
              <InputNumber
                value={values.rangeMin}
                onChange={value => onChange('rangeMin', value)}
                style={{ width: '100%' }}
              />
              <small className="text-muted">
                {t('Minimum value for the range')}
              </small>
            </Col>
          </Row>
          <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <label>{t('Max Value')}</label>
              <InputNumber
                value={values.rangeMax}
                onChange={value => onChange('rangeMax', value)}
                style={{ width: '100%' }}
              />
              <small className="text-muted">
                {t('Maximum value for the range')}
              </small>
            </Col>
          </Row>
        </>
      )}

      {/* Time Options */}
      {(isTime || isTimeColumn) && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.defaultToFirstValue || false}
                onChange={checked => onChange('defaultToFirstValue', checked)}
              />
              {t('Default to First Value')}
            </label>
            <small className="text-muted">
              {t('Default to the first available time value')}
            </small>
          </Col>
        </Row>
      )}

      {/* Time Grain Options */}
      {isTimeGrain && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Default Time Grain')}</label>
            <Select
              value={values.defaultTimeGrain || 'day'}
              onChange={value => onChange('defaultTimeGrain', value)}
              style={{ width: '100%' }}
              options={[
                { value: 'minute', label: t('Minute') },
                { value: 'hour', label: t('Hour') },
                { value: 'day', label: t('Day') },
                { value: 'week', label: t('Week') },
                { value: 'month', label: t('Month') },
                { value: 'quarter', label: t('Quarter') },
                { value: 'year', label: t('Year') },
              ]}
            />
            <small className="text-muted">
              {t('Default time granularity')}
            </small>
          </Col>
        </Row>
      )}

      {/* UI Configuration */}
      <h4 style={{ marginTop: 24, marginBottom: 16 }}>
        {t('UI Configuration')}
      </h4>

      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={values.instant_filtering || true}
              onChange={checked => onChange('instant_filtering', checked)}
            />
            {t('Instant Filtering')}
          </label>
          <small className="text-muted">
            {t('Apply filters instantly as they change')}
          </small>
        </Col>
      </Row>

      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={values.show_apply || false}
              onChange={checked => onChange('show_apply', checked)}
            />
            {t('Show Apply Button')}
          </label>
          <small className="text-muted">
            {t('Show an apply button for the filter')}
          </small>
        </Col>
      </Row>

      <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={values.show_clear || true}
              onChange={checked => onChange('show_clear', checked)}
            />
            {t('Show Clear Button')}
          </label>
          <small className="text-muted">
            {t('Show a clear button for the filter')}
          </small>
        </Col>
      </Row>
    </div>
  );
};

export default FilterControlsSection;
