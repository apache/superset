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
import { useCallback } from 'react';
import { t } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import { Flex, Icons, Tag, Typography } from '@superset-ui/core/components';
import type { SchemaSelection } from '../types';
import EditableDescription from './EditableDescription';

interface SchemaDetailPanelProps {
  selection: SchemaSelection;
  onUpdateTableDescription: (
    tableId: number,
    description: string | null,
  ) => Promise<boolean>;
  onUpdateColumnDescription: (
    columnId: number,
    description: string | null,
  ) => Promise<boolean>;
  isUpdating: boolean;
}

const PanelContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    background-color: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    overflow: hidden;
  `}
`;

const HeaderContainer = styled(Flex)`
  ${({ theme }) => `
    padding: ${theme.paddingSM}px ${theme.paddingMD}px;
    border-bottom: 1px solid ${theme.colorBorder};
    background-color: ${theme.colorBgLayout};
  `}
`;

const ContentSection = styled.div`
  ${({ theme }) => `
    padding: ${theme.paddingMD}px;
  `}
`;

const ItemHeader = styled(Flex)`
  ${({ theme }) => `
    padding: ${theme.paddingMD}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};
  `}
`;

const ConfidenceIndicator = styled(Flex)`
  ${({ theme }) => `
    margin-top: ${theme.marginMD}px;
    padding: ${theme.paddingSM}px;
    background-color: ${theme.colorSuccessBg};
    border-radius: ${theme.borderRadiusSM}px;
  `}
`;

const EmptyState = styled(Flex)`
  ${({ theme }) => `
    padding: ${theme.paddingXL}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const TypeLabel = styled(Typography.Text)`
  ${({ theme }) => `
    color: ${theme.colorPrimary};
    font-weight: ${theme.fontWeightStrong};
  `}
`;

export default function SchemaDetailPanel({
  selection,
  onUpdateTableDescription,
  onUpdateColumnDescription,
  isUpdating,
}: SchemaDetailPanelProps) {
  const theme = useTheme();

  const handleSaveTableDescription = useCallback(
    async (description: string | null): Promise<boolean> => {
      if (selection?.type !== 'table') return false;
      return onUpdateTableDescription(selection.table.id, description);
    },
    [selection, onUpdateTableDescription],
  );

  const handleSaveColumnDescription = useCallback(
    async (description: string | null): Promise<boolean> => {
      if (selection?.type !== 'column') return false;
      return onUpdateColumnDescription(selection.column.id, description);
    },
    [selection, onUpdateColumnDescription],
  );

  // Empty state
  if (!selection) {
    return (
      <PanelContainer>
        <HeaderContainer align="center" gap={8}>
          <Icons.InfoCircleOutlined
            iconSize="s"
            iconColor={theme.colorPrimary}
          />
          <Typography.Text strong>
            {t('AI Schema Understanding')}
          </Typography.Text>
        </HeaderContainer>
        <EmptyState vertical align="center" justify="center">
          <Icons.TableOutlined
            iconSize="xl"
            iconColor={theme.colorTextSecondary}
          />
          <Typography.Text type="secondary" css={{ marginTop: theme.marginMD }}>
            {t('Select a table or column from the schema tree to view details')}
          </Typography.Text>
        </EmptyState>
      </PanelContainer>
    );
  }

  // Column detail view
  if (selection.type === 'column') {
    const { column } = selection;

    return (
      <PanelContainer>
        <HeaderContainer align="center" gap={8}>
          <Icons.InfoCircleOutlined
            iconSize="s"
            iconColor={theme.colorPrimary}
          />
          <Typography.Text strong>
            {t('AI Schema Understanding')}
          </Typography.Text>
        </HeaderContainer>

        <ItemHeader vertical gap={8}>
          <Flex align="center" gap={8}>
            <Typography.Title level={5} css={{ margin: 0 }}>
              {column.name}
            </Typography.Title>
            {column.is_primary_key && (
              <Tag color="warning">{t('PRIMARY KEY')}</Tag>
            )}
            {column.is_foreign_key && (
              <Tag color="processing">{t('FOREIGN KEY')}</Tag>
            )}
          </Flex>
          <Flex align="center" gap={4}>
            <Typography.Text type="secondary">{t('Type:')}</Typography.Text>
            <TypeLabel>{column.type}</TypeLabel>
          </Flex>
        </ItemHeader>

        <ContentSection>
          <EditableDescription
            key={`column-${column.id}`}
            description={column.description}
            placeholder={t('Enter a description for this column...')}
            onSave={handleSaveColumnDescription}
            isUpdating={isUpdating}
          />

          <ConfidenceIndicator align="center" gap={8}>
            <Icons.CheckCircleOutlined
              iconSize="s"
              iconColor={theme.colorSuccess}
            />
            <Typography.Text css={{ color: theme.colorSuccess }}>
              {t('AI Confidence: High')}
            </Typography.Text>
          </ConfidenceIndicator>
        </ContentSection>
      </PanelContainer>
    );
  }

  // Table detail view
  const { table } = selection;

  return (
    <PanelContainer>
      <HeaderContainer align="center" gap={8}>
        <Icons.InfoCircleOutlined iconSize="s" iconColor={theme.colorPrimary} />
        <Typography.Text strong>{t('AI Schema Understanding')}</Typography.Text>
      </HeaderContainer>

      <ItemHeader align="center" gap={12}>
        <Icons.CheckSquareOutlined
          iconSize="m"
          iconColor={theme.colorSuccess}
        />
        <Flex vertical gap={2}>
          <Typography.Title level={5} css={{ margin: 0 }}>
            {table.name}
          </Typography.Title>
          <Tag color="default">{table.type}</Tag>
        </Flex>
      </ItemHeader>

      <ContentSection>
        <EditableDescription
          key={`table-${table.id}`}
          description={table.description}
          placeholder={t('Enter a description for this table...')}
          onSave={handleSaveTableDescription}
          isUpdating={isUpdating}
        />

        <ConfidenceIndicator align="center" gap={8}>
          <Icons.CheckCircleOutlined
            iconSize="s"
            iconColor={theme.colorSuccess}
          />
          <Typography.Text css={{ color: theme.colorSuccess }}>
            {t('AI Confidence: High')}
          </Typography.Text>
        </ConfidenceIndicator>
      </ContentSection>
    </PanelContainer>
  );
}
