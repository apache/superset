/*
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
import { CSSProperties, ReactNode } from 'react';
import { Table, type TableColumnsType } from 'antd';

interface TooltipRowData {
  key: string | number;
  keyColumn?: ReactNode;
  keyStyle?: CSSProperties;
  valueColumn: ReactNode;
  valueStyle?: CSSProperties;
}

interface TooltipTableProps {
  className?: string;
  data: TooltipRowData[];
}

const VALUE_CELL_STYLE: CSSProperties = { paddingLeft: 8, textAlign: 'right' };

const TooltipTable = ({ className = '', data }: TooltipTableProps) => {
  const columns: TableColumnsType<TooltipRowData> = [
    {
      title: '',
      dataIndex: 'keyColumn',
      key: 'keyColumn',
      render: (text, record) => (
        <div style={record.keyStyle}>{record.keyColumn ?? record.key}</div>
      ),
    },
    {
      title: '',
      dataIndex: 'valueColumn',
      key: 'valueColumn',
      align: 'right',
      render: (text, record) => (
        <div
          style={
            record.valueStyle
              ? { ...VALUE_CELL_STYLE, ...record.valueStyle }
              : VALUE_CELL_STYLE
          }
        >
          {record.valueColumn}
        </div>
      ),
    },
  ];

  return (
    <Table
      className={className}
      columns={columns}
      dataSource={data}
      pagination={false}
      showHeader={false}
      bordered={false}
    />
  );
};

export default TooltipTable;
