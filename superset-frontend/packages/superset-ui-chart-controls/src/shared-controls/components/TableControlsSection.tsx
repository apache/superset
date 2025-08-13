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
import { Switch, Select, Input } from 'antd';
import { Row, Col } from '@superset-ui/core/components';
import FormatControlGroup from './FormatControlGroup';

export interface TableControlsSectionProps {
  variant?: 'table' | 'pivot' | 'ag-grid';
  showPagination?: boolean;
  showCellBars?: boolean;
  showTotals?: boolean;
  showConditionalFormatting?: boolean;
  showTimestampFormat?: boolean;
  showAllowHtml?: boolean;
  values?: Record<string, any>;
  onChange?: (name: string, value: any) => void;
}

const TableControlsSection: FC<TableControlsSectionProps> = ({
  variant = 'table',
  showPagination = false,
  showCellBars = false,
  showTotals = false,
  showConditionalFormatting = true,
  showTimestampFormat = false,
  showAllowHtml = true,
  values = {},
  onChange = () => {},
}) => {
  const isPivot = variant === 'pivot';

  return (
    <div className="table-controls-section">
      {/* Pagination Controls */}
      {showPagination && !isPivot && (
        <>
          <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch
                  checked={values.server_pagination || false}
                  onChange={checked => onChange('server_pagination', checked)}
                />
                {t('Server Pagination')}
              </label>
              <small className="text-muted">
                {t('Enable server-side pagination for large datasets')}
              </small>
            </Col>
          </Row>
          {values.server_pagination && (
            <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
              <Col span={24}>
                <label>{t('Page Length')}</label>
                <Select
                  value={values.server_page_length || 10}
                  onChange={value => onChange('server_page_length', value)}
                  style={{ width: '100%' }}
                  options={[
                    { value: 10, label: '10' },
                    { value: 25, label: '25' },
                    { value: 50, label: '50' },
                    { value: 100, label: '100' },
                    { value: 200, label: '200' },
                  ]}
                />
                <small className="text-muted">
                  {t('Number of rows per page')}
                </small>
              </Col>
            </Row>
          )}
        </>
      )}

      {/* Cell Bars */}
      {showCellBars && !isPivot && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.show_cell_bars || false}
                onChange={checked => onChange('show_cell_bars', checked)}
              />
              {t('Show Cell Bars')}
            </label>
            <small className="text-muted">
              {t('Display mini bar charts in numeric columns')}
            </small>
          </Col>
        </Row>
      )}

      {/* Totals */}
      {showTotals && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.show_totals || values.rowTotals || false}
                onChange={checked => {
                  if (isPivot) {
                    onChange('rowTotals', checked);
                    onChange('colTotals', checked);
                  } else {
                    onChange('show_totals', checked);
                  }
                }}
              />
              {t('Show Totals')}
            </label>
            <small className="text-muted">
              {isPivot
                ? t('Show row and column totals')
                : t('Show total row at bottom')}
            </small>
          </Col>
        </Row>
      )}

      {/* Subtotals for Pivot */}
      {isPivot && (
        <>
          <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch
                  checked={values.rowSubTotals || false}
                  onChange={checked => onChange('rowSubTotals', checked)}
                />
                {t('Show Row Subtotals')}
              </label>
              <small className="text-muted">
                {t('Show subtotals for row groups')}
              </small>
            </Col>
          </Row>
          {values.rowSubTotals && (
            <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
              <Col span={24}>
                <label>{t('Subtotal Position')}</label>
                <Select
                  value={values.rowSubtotalPosition || 'bottom'}
                  onChange={value => onChange('rowSubtotalPosition', value)}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'top', label: t('Top') },
                    { value: 'bottom', label: t('Bottom') },
                  ]}
                />
              </Col>
            </Row>
          )}
          <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch
                  checked={values.colSubTotals || false}
                  onChange={checked => onChange('colSubTotals', checked)}
                />
                {t('Show Column Subtotals')}
              </label>
              <small className="text-muted">
                {t('Show subtotals for column groups')}
              </small>
            </Col>
          </Row>
          <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
            <Col span={24}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch
                  checked={values.transposePivot || false}
                  onChange={checked => onChange('transposePivot', checked)}
                />
                {t('Transpose Pivot')}
              </label>
              <small className="text-muted">{t('Swap rows and columns')}</small>
            </Col>
          </Row>
        </>
      )}

      {/* Conditional Formatting */}
      {showConditionalFormatting && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Conditional Formatting')}</label>
            <Input.TextArea
              value={values.conditional_formatting || ''}
              onChange={e => onChange('conditional_formatting', e.target.value)}
              placeholder={t('Enter conditional formatting rules as JSON')}
              rows={4}
            />
            <small className="text-muted">
              {t('Apply conditional color formatting to cells')}
            </small>
          </Col>
        </Row>
      )}

      {/* Timestamp Format */}
      {showTimestampFormat && !isPivot && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label>{t('Timestamp Format')}</label>
            <Input
              value={values.table_timestamp_format || ''}
              onChange={e => onChange('table_timestamp_format', e.target.value)}
              placeholder="%Y-%m-%d %H:%M:%S"
            />
            <small className="text-muted">
              {t('D3 time format for timestamp columns')}
            </small>
          </Col>
        </Row>
      )}

      {/* Allow HTML */}
      {showAllowHtml && (
        <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={values.allow_render_html || false}
                onChange={checked => onChange('allow_render_html', checked)}
              />
              {t('Allow HTML')}
            </label>
            <small className="text-muted">
              {t(
                'Render HTML content in cells (security warning: only enable for trusted data)',
              )}
            </small>
          </Col>
        </Row>
      )}

      {/* Format Controls */}
      <div style={{ marginTop: 24 }}>
        <h4>{t('Value Formats')}</h4>
        <FormatControlGroup
          showNumber
          showCurrency
          showPercentage={isPivot}
          showDate={!isPivot}
          values={values}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default TableControlsSection;
