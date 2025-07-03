/* eslint-disable camelcase */
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

import { isProbablyHTML, sanitizeHtml, t } from '@superset-ui/core';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from '@superset-ui/core/components';
import { CellRendererProps } from '../types';
import { SummaryContainer, SummaryText } from '../styles';

const SUMMARY_TOOLTIP_TEXT = t(
  'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
);

export const TextCellRenderer = (params: CellRendererProps) => {
  const { node, api, colDef, columns, allowRenderHtml, value, valueFormatted } =
    params;

  if (node?.rowPinned === 'bottom') {
    const cols = api.getAllGridColumns().filter(col => col.isVisible());
    const colAggCheck = !cols[0].getAggFunc();
    if (cols.length > 1 && colAggCheck && columns[0].key === colDef?.field) {
      return (
        <SummaryContainer>
          <SummaryText>{t('Summary')}</SummaryText>
          <Tooltip overlay={SUMMARY_TOOLTIP_TEXT}>
            <InfoCircleOutlined />
          </Tooltip>
        </SummaryContainer>
      );
    }
    if (!value) {
      return null;
    }
  }

  if (!(typeof value === 'string' || value instanceof Date)) {
    return valueFormatted ?? value;
  }

  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      );
    }
    if (allowRenderHtml && isProbablyHTML(value)) {
      return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />;
    }
  }

  return <div>{valueFormatted ?? value}</div>;
};
