/**
 * AlertDataTable Component
 * Displays alert data in a table format
 */
import React from 'react';
import { styled, css } from '@apache-superset/core/ui';
import { Table } from 'antd';

const TableStyles = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 2}px;
    background-color: ${theme.colorBgContainer};
    border-radius: ${theme.borderRadius}px;
    
    .alert-table {
      width: 100%;
      
      .ant-table {
        background: ${theme.colorBgContainer};
      }
      
      .ant-table-thead > tr > th {
        background-color: ${theme.colorBgElevated};
        color: ${theme.colorText};
        border-color: ${theme.colorBorder};
      }
      
      .ant-table-tbody > tr > td {
        border-color: ${theme.colorBorder};
        color: ${theme.colorText};
      }
      
      .ant-table-tbody > tr:hover > td {
        background-color: ${theme.colorBgElevated};
      }
    }
  `}
`;

// Dummy alert data
const ALERT_DATA = [
  {
    key: '1',
    id: 'ALT-001',
    timestamp: '2025-12-04 10:30:15',
    device: 'TEMP-001',
    eventType: 'Temperature',
    severity: 'Error',
    message: 'Temperature exceeded 45°C',
    status: 'Active',
  },
  {
    key: '2',
    id: 'ALT-002',
    timestamp: '2025-12-04 10:25:42',
    device: 'DEVICE-005',
    eventType: 'Connection',
    severity: 'Warning',
    message: 'Device offline',
    status: 'Resolved',
  },
  {
    key: '3',
    id: 'ALT-003',
    timestamp: '2025-12-04 10:20:18',
    device: 'PRESS-012',
    eventType: 'Pressure',
    severity: 'Warning',
    message: 'Pressure at 98% threshold',
    status: 'Active',
  },
  {
    key: '4',
    id: 'ALT-004',
    timestamp: '2025-12-04 09:45:33',
    device: 'DEVICE-003',
    eventType: 'Connection',
    severity: 'Success',
    message: 'Connection restored',
    status: 'Resolved',
  },
  {
    key: '5',
    id: 'ALT-005',
    timestamp: '2025-12-04 09:30:21',
    device: 'SENSOR-002',
    eventType: 'Battery',
    severity: 'Error',
    message: 'Battery level at 15%',
    status: 'Active',
  },
  {
    key: '6',
    id: 'ALT-006',
    timestamp: '2025-12-04 09:15:47',
    device: 'HUM-008',
    eventType: 'Humidity',
    severity: 'Info',
    message: 'Humidity reading normal',
    status: 'Active',
  },
  {
    key: '7',
    id: 'ALT-007',
    timestamp: '2025-12-04 09:00:12',
    device: 'DEVICE-011',
    eventType: 'Status',
    severity: 'Success',
    message: 'Device health check passed',
    status: 'Resolved',
  },
  {
    key: '8',
    id: 'ALT-008',
    timestamp: '2025-12-04 08:45:55',
    device: 'TEMP-003',
    eventType: 'Temperature',
    severity: 'Warning',
    message: 'Temperature approaching limit',
    status: 'Active',
  },
];

const columns = [
  {
    title: 'Alert ID',
    dataIndex: 'id',
    key: 'id',
    width: 80,
  },
  {
    title: 'Timestamp',
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 150,
  },
  {
    title: 'Device',
    dataIndex: 'device',
    key: 'device',
    width: 100,
  },
  {
    title: 'Event Type',
    dataIndex: 'eventType',
    key: 'eventType',
    width: 100,
  },
  {
    title: 'Severity',
    dataIndex: 'severity',
    key: 'severity',
    width: 80,
    render: (text: string) => {
      const colors: Record<string, string> = {
        Error: 'red',
        Warning: 'orange',
        Success: 'green',
        Info: 'blue',
      };
      return <span style={{ color: colors[text] || 'black', fontWeight: 'bold' }}>{text}</span>;
    },
  },
  {
    title: 'Message',
    dataIndex: 'message',
    key: 'message',
    width: 200,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    render: (text: string) => {
      const colors: Record<string, string> = {
        Active: '#1890ff',
        Resolved: '#52c41a',
      };
      return <span style={{ color: colors[text] || 'black' }}>{text}</span>;
    },
  },
];

const AlertDataTable: React.FC = () => {
  const activeCount = ALERT_DATA.filter(a => a.status === 'Active').length;
  const resolvedCount = ALERT_DATA.filter(a => a.status === 'Resolved').length;

  return (
    <TableStyles>
      <div style={{ marginBottom: '16px' }}>
        <h3>Alert Summary</h3>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
          <div>
            <strong>Total Alerts:</strong> {ALERT_DATA.length}
          </div>
          <div>
            <strong style={{ color: '#1890ff' }}>Active:</strong> {activeCount}
          </div>
          <div>
            <strong style={{ color: '#52c41a' }}>Resolved:</strong> {resolvedCount}
          </div>
        </div>
      </div>
      <div className="alert-table">
        <Table
          columns={columns}
          dataSource={ALERT_DATA}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `Total ${total} alerts`,
          }}
          scroll={{ x: 1200 }}
          size="small"
        />
      </div>
    </TableStyles>
  );
};

export default AlertDataTable;
