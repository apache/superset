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
import { useState, useEffect, useMemo } from 'react';
import { t } from '@superset-ui/core';
import { styled, Alert } from '@apache-superset/core/ui';
import {
  Modal,
  Select,
  Input,
  Form,
  Space,
  Typography,
} from '@superset-ui/core/components';

export enum JoinType {
  INNER = 'inner',
  LEFT = 'left',
  RIGHT = 'right',
  FULL = 'full',
  CROSS = 'cross',
}

export enum Cardinality {
  ONE_TO_ONE = '1:1',
  ONE_TO_MANY = '1:N',
  MANY_TO_ONE = 'N:1',
  MANY_TO_MANY = 'N:M',
}

export interface Table {
  id: number;
  name: string;
  columns?: Column[];
}

export interface Column {
  id: number;
  name: string;
  type: string;
}

export interface Join {
  id?: number;
  source_table: string;
  source_table_id?: number;
  source_columns: string[];
  target_table: string;
  target_table_id?: number;
  target_columns: string[];
  join_type: JoinType;
  cardinality: Cardinality;
  semantic_context?: string;
}

interface JoinEditorModalProps {
  visible: boolean;
  join?: Join | null;
  tables: Table[];
  onSave: (join: Join) => void;
  onCancel: () => void;
}

const StyledForm = styled(Form)`
  .ant-form-item {
    margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
  }
`;

const ColumnSelectionGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  align-items: center;
`;

const JoinEditorModal = ({
  visible,
  join,
  tables,
  onSave,
  onCancel,
}: JoinEditorModalProps) => {
  const [form] = Form.useForm();
  const [sourceTable, setSourceTable] = useState<string | undefined>(
    join?.source_table,
  );
  const [targetTable, setTargetTable] = useState<string | undefined>(
    join?.target_table,
  );

  useEffect(() => {
    if (visible) {
      if (join) {
        form.setFieldsValue({
          source_table: join.source_table,
          source_columns: join.source_columns,
          target_table: join.target_table,
          target_columns: join.target_columns,
          join_type: join.join_type,
          cardinality: join.cardinality,
          semantic_context: join.semantic_context,
        });
        setSourceTable(join.source_table);
        setTargetTable(join.target_table);
      } else {
        form.resetFields();
        setSourceTable(undefined);
        setTargetTable(undefined);
      }
    }
  }, [visible, join, form]);

  const sourceTableColumns = useMemo(
    () =>
      tables.find(table => table.name === sourceTable)?.columns || [],
    [tables, sourceTable],
  );

  const targetTableColumns = useMemo(
    () =>
      tables.find(table => table.name === targetTable)?.columns || [],
    [tables, targetTable],
  );

  const joinTypeOptions = [
    { value: JoinType.INNER, label: t('Inner Join') },
    { value: JoinType.LEFT, label: t('Left Join') },
    { value: JoinType.RIGHT, label: t('Right Join') },
    { value: JoinType.FULL, label: t('Full Outer Join') },
    { value: JoinType.CROSS, label: t('Cross Join') },
  ];

  const cardinalityOptions = [
    { value: Cardinality.ONE_TO_ONE, label: t('One to One (1:1)') },
    { value: Cardinality.ONE_TO_MANY, label: t('One to Many (1:N)') },
    { value: Cardinality.MANY_TO_ONE, label: t('Many to One (N:1)') },
    { value: Cardinality.MANY_TO_MANY, label: t('Many to Many (N:M)') },
  ];

  const handleSourceTableChange = (value: string) => {
    setSourceTable(value);
    form.setFieldValue('source_columns', []);
  };

  const handleTargetTableChange = (value: string) => {
    setTargetTable(value);
    form.setFieldValue('target_columns', []);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const sourceTableId = tables.find(
        t => t.name === values.source_table,
      )?.id;
      const targetTableId = tables.find(
        t => t.name === values.target_table,
      )?.id;

      onSave({
        ...join,
        ...values,
        source_table_id: sourceTableId,
        target_table_id: targetTableId,
      });
      form.resetFields();
    } catch (error) {
      // Form validation failed
    }
  };

  return (
    <Modal
      title={join ? t('Edit Join Relationship') : t('Add Join Relationship')}
      visible={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      width={800}
      okText={join ? t('Update') : t('Add')}
      cancelText={t('Cancel')}
    >
      <StyledForm form={form} layout="vertical">
        <Alert
          message={t('Join Configuration')}
          description={t(
            'Define the relationship between tables. This join will be used when generating dashboards and visualizations.',
          )}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Typography.Title level={5}>{t('Tables')}</Typography.Title>

        <ColumnSelectionGroup>
          <Form.Item
            name="source_table"
            label={t('Source Table')}
            rules={[{ required: true, message: t('Please select a source table') }]}
            style={{ flex: 1, marginBottom: 0 }}
          >
            <Select
              placeholder={t('Select source table')}
              onChange={handleSourceTableChange}
              showSearch
              optionFilterProp="label"
              options={tables.map(table => ({
                value: table.name,
                label: table.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="join_type"
            label={t('Join Type')}
            rules={[{ required: true, message: t('Please select a join type') }]}
            style={{ minWidth: 150, marginBottom: 0 }}
          >
            <Select
              placeholder={t('Select join type')}
              options={joinTypeOptions}
            />
          </Form.Item>

          <Form.Item
            name="target_table"
            label={t('Target Table')}
            rules={[{ required: true, message: t('Please select a target table') }]}
            style={{ flex: 1, marginBottom: 0 }}
          >
            <Select
              placeholder={t('Select target table')}
              onChange={handleTargetTableChange}
              showSearch
              optionFilterProp="label"
              options={tables.map(table => ({
                value: table.name,
                label: table.name,
              }))}
            />
          </Form.Item>
        </ColumnSelectionGroup>

        <Typography.Title level={5} style={{ marginTop: 24 }}>
          {t('Join Columns')}
        </Typography.Title>

        <ColumnSelectionGroup>
          <Form.Item
            name="source_columns"
            label={t('Source Columns')}
            rules={[
              { required: true, message: t('Please select source columns') },
            ]}
            style={{ flex: 1 }}
          >
            <Select
              mode="multiple"
              placeholder={t('Select columns from source table')}
              disabled={!sourceTable}
              options={sourceTableColumns.map(col => ({
                value: col.name,
                label: `${col.name} (${col.type})`,
              }))}
            />
          </Form.Item>

          <Typography.Text>=</Typography.Text>

          <Form.Item
            name="target_columns"
            label={t('Target Columns')}
            rules={[
              { required: true, message: t('Please select target columns') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const sourceColumns = getFieldValue('source_columns') || [];
                  if (value && value.length !== sourceColumns.length) {
                    return Promise.reject(
                      new Error(
                        t(
                          'Number of target columns must match source columns',
                        ),
                      ),
                    );
                  }
                  return Promise.resolve();
                },
              }),
            ]}
            style={{ flex: 1 }}
          >
            <Select
              mode="multiple"
              placeholder={t('Select columns from target table')}
              disabled={!targetTable}
              options={targetTableColumns.map(col => ({
                value: col.name,
                label: `${col.name} (${col.type})`,
              }))}
            />
          </Form.Item>
        </ColumnSelectionGroup>

        <Typography.Title level={5} style={{ marginTop: 24 }}>
          {t('Relationship Details')}
        </Typography.Title>

        <Form.Item
          name="cardinality"
          label={t('Cardinality')}
          rules={[{ required: true, message: t('Please select cardinality') }]}
        >
          <Select
            placeholder={t('Select relationship cardinality')}
            options={cardinalityOptions}
          />
        </Form.Item>

        <Form.Item
          name="semantic_context"
          label={t('Description (AI Generated)')}
          help={t(
            'This description was generated by AI and can be edited for clarity',
          )}
        >
          <Input.TextArea
            rows={3}
            placeholder={t(
              'e.g., "Orders are linked to customers through the customer_id field"',
            )}
          />
        </Form.Item>
      </StyledForm>
    </Modal>
  );
};

export default JoinEditorModal;