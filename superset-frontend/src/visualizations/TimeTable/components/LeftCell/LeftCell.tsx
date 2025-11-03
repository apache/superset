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
import { ReactElement, useMemo } from 'react';
import Mustache from 'mustache';
import { Typography } from '@superset-ui/core/components';
import { MetricOption } from '@superset-ui/chart-controls';
import type { Row, ColumnRow, MetricRow } from '../../types';

interface LeftCellProps {
  row: Row;
  rowType: 'column' | 'metric';
  url?: string;
}

/**
 * Renders the left cell containing either column labels or metric information
 */
const LeftCell = ({ row, rowType, url }: LeftCellProps): ReactElement => {
  const fullUrl = useMemo(() => {
    if (!url) return undefined;
    const context = { metric: row };
    return Mustache.render(url, context);
  }, [url, row]);

  if (rowType === 'column') {
    const column = row as ColumnRow;
    if (fullUrl)
      return (
        <Typography.Link
          href={fullUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {column.label}
        </Typography.Link>
      );

    return <span>{column.label || ''}</span>;
  }

  return (
    <MetricOption
      metric={row as MetricRow}
      url={fullUrl}
      showFormula={false}
      openInNewWindow
    />
  );
};

export default LeftCell;
