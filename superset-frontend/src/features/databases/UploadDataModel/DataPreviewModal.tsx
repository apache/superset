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
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import {
  Empty,
  Loading,
  Modal,
  Table,
  TableSize,
  type ColumnsType,
} from '@superset-ui/core/components';
import type { UploadType } from './uploadDataModalTour';
import {
  buildPreview,
  decodeText,
  parseDelimitedText,
  recordsNeeded,
  type PreviewCell,
  type PreviewData,
  type PreviewOptions,
} from './filePreviewParsing';

interface DataPreviewModalProps {
  show: boolean;
  onHide: () => void;
  file: File | null;
  type: UploadType;
  delimiter?: string;
  sheetName?: string;
  headerRow?: number;
  skipRows?: number;
}

async function parseCSV(
  file: File,
  delimiter: string,
  options: PreviewOptions,
): Promise<PreviewData> {
  const text = decodeText(await file.arrayBuffer());
  const rows = parseDelimitedText(text, delimiter, recordsNeeded(options));
  return buildPreview(rows, options);
}

async function parseExcel(
  file: File,
  sheetName: string | undefined,
  options: PreviewOptions,
): Promise<PreviewData> {
  const XLSX = (await import(/* webpackChunkName: "xlsx" */ 'xlsx')).default;
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    sheetRows: recordsNeeded(options),
  });
  const sheet = sheetName
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    return { columns: [], data: [] };
  }
  const rows = XLSX.utils.sheet_to_json<PreviewCell[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: true,
  });
  return buildPreview(rows, options);
}

export const DataPreviewModal: FunctionComponent<DataPreviewModalProps> = ({
  show,
  onHide,
  file,
  type,
  delimiter = ',',
  sheetName,
  headerRow = 0,
  skipRows = 0,
}) => {
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setColumns([]);
    setData([]);
    setError(null);
    setLoading(false);
    if (!show || !file) {
      return undefined;
    }
    if (type === 'columnar') {
      setError(t('Data preview is not available for Parquet files.'));
      return undefined;
    }
    // Ignore results from a parse that was superseded by a newer file,
    // option change or the modal closing.
    let cancelled = false;
    setLoading(true);
    const options = { headerRow, skipRows };
    const parse =
      type === 'csv'
        ? parseCSV(file, delimiter, options)
        : parseExcel(file, sheetName, options);
    parse
      .then(({ columns: cols, data: parsedData }) => {
        if (!cancelled) {
          setColumns(cols);
          setData(parsedData);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err?.message || t('Failed to parse file'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [show, file, type, delimiter, sheetName, headerRow, skipRows]);

  const tableColumns: ColumnsType<Record<string, string>> = columns.map(
    (col, idx) => ({
      title: col,
      dataIndex: String(idx),
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
      {loading && <Loading position="normal" />}
      {error && !loading && (
        <Alert type="error" closable={false}>
          {error}
        </Alert>
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
        <Empty description={t('No data to preview')} />
      )}
    </Modal>
  );
};
