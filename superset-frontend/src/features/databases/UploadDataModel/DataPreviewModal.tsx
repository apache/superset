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
import { FunctionComponent, useEffect, useState } from 'react';
import { t } from '@apache-superset/core';
import { Modal, Table, TableSize } from '@superset-ui/core/components';
import type { ColumnsType } from 'antd/es/table';
import type { UploadType } from './uploadDataModalTour';

const PREVIEW_ROW_LIMIT = 100;

interface DataPreviewModalProps {
  show: boolean;
  onHide: () => void;
  file: File | null;
  type: UploadType;
  delimiter?: string;
  sheetName?: string;
}

async function parseCSV(
  file: File,
  delimiter: string,
): Promise<{ columns: string[]; data: Record<string, string>[] }> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { columns: [], data: [] };
  }
  const headerLine = lines[0];
  const columns = headerLine
    .split(delimiter)
    .map((c, i) => c.trim() || `col_${i}`);
  const dataRows = lines.slice(1, PREVIEW_ROW_LIMIT + 1);
  const data = dataRows.map(row => {
    const values = row.split(delimiter);
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => {
      obj[col] = values[i]?.trim() ?? '';
    });
    return obj;
  });
  return { columns, data };
}

async function parseExcel(
  file: File,
  sheetName?: string,
): Promise<{ columns: string[]; data: Record<string, string>[] }> {
  const XLSX = (await import(/* webpackChunkName: "xlsx" */ 'xlsx')).default;
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = sheetName
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return { columns: [], data: [] };
  }
  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
  }) as unknown[][];
  if (jsonData.length === 0) {
    return { columns: [], data: [] };
  }
  const headerRow = jsonData[0] as (string | number)[];
  const columns = headerRow.map((c, i) => String(c ?? '').trim() || `col_${i}`);
  const dataRows = jsonData.slice(1, PREVIEW_ROW_LIMIT + 1) as (
    | string
    | number
  )[][];
  const data = dataRows.map(row => {
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => {
      obj[col] = String(row[i] ?? '');
    });
    return obj;
  });
  return { columns, data };
}

export const DataPreviewModal: FunctionComponent<DataPreviewModalProps> = ({
  show,
  onHide,
  file,
  type,
  delimiter = ',',
  sheetName,
}) => {
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show || !file) {
      setColumns([]);
      setData([]);
      setError(null);
      return;
    }
    if (type === 'columnar') {
      setError(t('Data preview is not available for Parquet files.'));
      setColumns([]);
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    const parse =
      type === 'csv' ? parseCSV(file, delimiter) : parseExcel(file, sheetName);
    parse
      .then(({ columns: cols, data: parsedData }) => {
        setColumns(cols);
        setData(parsedData);
      })
      .catch(err => {
        setError(err?.message || t('Failed to parse file'));
        setColumns([]);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [show, file, type, delimiter, sheetName]);

  const tableColumns: ColumnsType<Record<string, string>> = columns.map(
    (col, idx) => ({
      title: col,
      dataIndex: col,
      key: `col_${idx}_${col}`,
      ellipsis: true,
      width: 150,
    }),
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      title={t('Data preview')}
      hideFooter
      width="90vw"
      responsive
      centered
    >
      {loading && (
        <div style={{ padding: 24, textAlign: 'center' }}>
          {t('Loading...')}
        </div>
      )}
      {error && !loading && (
        <div style={{ padding: 24, color: 'var(--ant-color-error)' }}>
          {error}
        </div>
      )}
      {!loading && !error && columns.length > 0 && (
        <Table
          columns={tableColumns}
          data={data}
          rowKey={(_, idx) => `row_${idx}`}
          size={TableSize.Small}
          defaultPageSize={20}
        />
      )}
      {!loading && !error && columns.length === 0 && (
        <div style={{ padding: 24, color: 'var(--ant-color-text-secondary)' }}>
          {t('No data to preview')}
        </div>
      )}
    </Modal>
  );
};
