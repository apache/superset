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
import { useState } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import {
  Table,
  Button,
  Space,
  Typography,
  Popconfirm,
  Tag,
} from '@superset-ui/core/components';
import { useToasts } from '../MessageToasts/withToasts';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import JoinEditorModal, {
  Join,
  JoinType,
  Cardinality,
  Table as TableType,
} from './JoinEditorModal';

interface JoinsListProps {
  databaseReportId: number;
  joins: Join[];
  tables: TableType[];
  onJoinsUpdate?: (joins: Join[]) => void;
  editable?: boolean;
}

const StyledTableContainer = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 4}px;
    background-color: ${theme.colorBgContainer};
    border-radius: ${theme.borderRadiusSM}px;
  `}
`;

const HeaderContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
`;

const JoinTypeTag = styled(Tag)<{ joinType: JoinType }>`
  ${({ theme, joinType }) => {
    const colorMap = {
      [JoinType.INNER]: theme.colorSuccess,
      [JoinType.LEFT]: theme.colorInfo,
      [JoinType.RIGHT]: theme.colorWarning,
      [JoinType.FULL]: theme.colorError,
      [JoinType.CROSS]: theme.colorTextSecondary,
    };
    return `
      background-color: ${colorMap[joinType]}20;
      color: ${colorMap[joinType]};
      border-color: ${colorMap[joinType]};
    `;
  }}
`;

const CardinalityTag = styled(Tag)`
  ${({ theme }) => `
    background-color: ${theme.colorPrimaryBg};
    color: ${theme.colorPrimary};
    border-color: ${theme.colorPrimary};
  `}
`;

const JoinsList = ({
  databaseReportId,
  joins: initialJoins,
  tables,
  onJoinsUpdate,
  editable = true,
}: JoinsListProps) => {
  const [joins, setJoins] = useState<Join[]>(initialJoins);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJoin, setEditingJoin] = useState<Join | null>(null);
  const [loading, setLoading] = useState(false);
  const { addSuccessToast, addDangerToast } = useToasts();

  const handleAddJoin = () => {
    setEditingJoin(null);
    setModalVisible(true);
  };

  const handleEditJoin = (join: Join) => {
    setEditingJoin(join);
    setModalVisible(true);
  };

  const handleDeleteJoin = async (joinId: number) => {
      setLoading(true);
    try {
      const response = await SupersetClient.delete({
        endpoint: `/api/v1/datasource/analysis/report/${databaseReportId}/join/${joinId}`,
      });

      if (response.ok) {
        const updatedJoins = joins.filter(j => j.id !== joinId);
        setJoins(updatedJoins);
        onJoinsUpdate?.(updatedJoins);
        addSuccessToast(t('Join deleted successfully'));
      } else {
        throw new Error('Failed to delete join');
      }
    } catch (error) {
      console.error('Delete join error:', error);
      addDangerToast(
        t('Failed to delete join: %s', error?.message || String(error)),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJoin = async (join: Join) => {
    setLoading(true);
    try {
      const endpoint = join.id
        ? `/api/v1/datasource/analysis/report/${databaseReportId}/join/${join.id}`
        : `/api/v1/datasource/analysis/report/${databaseReportId}/join`;
      
      const method = join.id ? 'PUT' : 'POST';
      
      const response = await SupersetClient.request({
        endpoint,
        method,
        jsonPayload: join,
      });

      if (response.ok) {
        const savedJoin = response.json;
        let updatedJoins: Join[];
        
        if (join.id) {
          updatedJoins = joins.map(j => (j.id === join.id ? savedJoin : j));
        } else {
          updatedJoins = [...joins, savedJoin];
        }
        
        setJoins(updatedJoins);
        onJoinsUpdate?.(updatedJoins);
        setModalVisible(false);
        addSuccessToast(
          join.id
            ? t('Join updated successfully')
            : t('Join created successfully'),
        );
      } else {
        throw new Error('Failed to save join');
      }
    } catch (error) {
      console.error('Save join error:', error);
      addDangerToast(
        t('Failed to save join: %s', error?.message || String(error)),
      );
    } finally {
      setLoading(false);
    }
  };

  const getJoinTypeLabel = (type: JoinType) => {
    const labels = {
      [JoinType.INNER]: t('INNER'),
      [JoinType.LEFT]: t('LEFT'),
      [JoinType.RIGHT]: t('RIGHT'),
      [JoinType.FULL]: t('FULL'),
      [JoinType.CROSS]: t('CROSS'),
    };
    return labels[type] || type;
  };

  const columns = [
    {
      title: t('Source Table'),
      dataIndex: 'source_table',
      key: 'source_table',
      render: (text: string) => (
        <Typography.Text strong>{text}</Typography.Text>
      ),
    },
    {
      title: t('Source Columns'),
      dataIndex: 'source_columns',
      key: 'source_columns',
      render: (cols: string[] | string) => {
        const columns = Array.isArray(cols)
          ? cols
          : typeof cols === 'string'
            ? cols.split(',').map(c => c.trim()).filter(Boolean)
            : [];
        return <Typography.Text code>{columns.join(', ')}</Typography.Text>;
      },
    },
    {
      title: t('Join Type'),
      dataIndex: 'join_type',
      key: 'join_type',
      render: (type: JoinType) => (
        <JoinTypeTag joinType={type}>{getJoinTypeLabel(type)}</JoinTypeTag>
      ),
    },
    {
      title: t('Target Table'),
      dataIndex: 'target_table',
      key: 'target_table',
      render: (text: string) => (
        <Typography.Text strong>{text}</Typography.Text>
      ),
    },
    {
      title: t('Target Columns'),
      dataIndex: 'target_columns',
      key: 'target_columns',
      render: (cols: string[] | string) => {
        const columns = Array.isArray(cols)
          ? cols
          : typeof cols === 'string'
            ? cols.split(',').map(c => c.trim()).filter(Boolean)
            : [];
        return <Typography.Text code>{columns.join(', ')}</Typography.Text>;
      },
    },
    {
      title: t('Cardinality'),
      dataIndex: 'cardinality',
      key: 'cardinality',
      render: (cardinality: Cardinality) => (
        <CardinalityTag>{cardinality}</CardinalityTag>
      ),
    },
    {
      title: t('Description'),
      dataIndex: 'semantic_context',
      key: 'semantic_context',
      ellipsis: true,
      render: (text: string) => (
        <Typography.Text
          ellipsis={{ tooltip: text }}
          style={{ maxWidth: 200 }}
        >
          {text || '-'}
        </Typography.Text>
      ),
    },
  ];

  if (editable) {
    columns.push({
      title: t('Actions'),
      key: 'actions',
      fixed: 'right',
      width: 100,
      render: (_: unknown, record: Join) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditJoin(record)}
            size="small"
          />
          <Popconfirm
            title={t('Delete Join')}
            description={t(
              'Are you sure you want to delete this join relationship?',
            )}
            onConfirm={() => record.id && handleDeleteJoin(record.id)}
            okText={t('Yes')}
            cancelText={t('No')}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    });
  }

  return (
    <StyledTableContainer>
      <HeaderContainer>
        <div>
          <Typography.Title level={4}>{t('Table Joins')}</Typography.Title>
          <Typography.Text type="secondary">
            {t('AI-detected and user-defined relationships between tables')}
          </Typography.Text>
        </div>
        {editable && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddJoin}
          >
            {t('Add Join')}
          </Button>
        )}
      </HeaderContainer>

      <Table
        columns={columns}
        dataSource={joins}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) =>
            t('%s-%s of %s joins', range[0], range[1], total),
        }}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: t('No joins defined yet'),
        }}
      />

      <JoinEditorModal
        visible={modalVisible}
        join={editingJoin}
        tables={tables}
        onSave={handleSaveJoin}
        onCancel={() => setModalVisible(false)}
      />
    </StyledTableContainer>
  );
};

export default JoinsList;
