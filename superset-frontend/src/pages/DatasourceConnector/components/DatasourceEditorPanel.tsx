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
import { useState, useCallback } from 'react';
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import {
  AIInfoBanner,
  Button,
  Flex,
  Icons,
  Spin,
  Typography,
} from '@superset-ui/core/components';
import useSchemaReport from '../hooks/useSchemaReport';
import useSchemaEditorMutations from '../hooks/useSchemaEditorMutations';
import SchemaTreeView from './SchemaTreeView';
import SchemaDetailPanel from './SchemaDetailPanel';
import type { SchemaSelection } from '../types';
import { JoinsList } from '../../../components/DatabaseSchemaEditor';

interface DatasourceEditorPanelProps {
  reportId: number;
  dashboardId: number | null;
  onBack: () => void;
  onConfirm: (runId: string) => void;
}

const EditorContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    max-width: 1200px;
    display: flex;
    flex-direction: column;
    gap: ${theme.marginLG}px;
  `}
`;

const ContentGrid = styled.div`
  ${({ theme }) => `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${theme.marginLG}px;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `}
`;

const FooterActions = styled(Flex)`
  ${({ theme }) => `
    padding-top: ${theme.paddingMD}px;
    border-top: 1px solid ${theme.colorBorder};
  `}
`;

const LoadingContainer = styled(Flex)`
  ${({ theme }) => `
    padding: ${theme.paddingXL}px;
    min-height: 400px;
  `}
`;

const ErrorContainer = styled(Flex)`
  ${({ theme }) => `
    padding: ${theme.paddingXL}px;
    background-color: ${theme.colorErrorBg};
    border: 1px solid ${theme.colorError};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const AIBannerWrapper = styled.div`
  ${({ theme }) => `
    width: 100%;
    margin-bottom: ${theme.marginMD}px;
  `}
`;

export default function DatasourceEditorPanel({
  reportId,
  dashboardId,
  onBack,
  onConfirm,
}: DatasourceEditorPanelProps) {
  const { report, loading, error, refetch } = useSchemaReport(reportId);
  const {
    updateTableDescription,
    updateColumnDescription,
    generateDashboard,
    mutationState,
  } = useSchemaEditorMutations();

  const [selection, setSelection] = useState<SchemaSelection>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSelectionChange = useCallback((newSelection: SchemaSelection) => {
    setSelection(newSelection);
  }, []);

  const handleUpdateTableDescription = useCallback(
    async (tableId: number, description: string | null): Promise<boolean> => {
      const success = await updateTableDescription(tableId, description);
      if (success) {
        refetch();
      }
      return success;
    },
    [updateTableDescription, refetch],
  );

  const handleUpdateColumnDescription = useCallback(
    async (columnId: number, description: string | null): Promise<boolean> => {
      const success = await updateColumnDescription(columnId, description);
      if (success) {
        refetch();
      }
      return success;
    },
    [updateColumnDescription, refetch],
  );

  const handleConfirmAndGenerate = useCallback(async () => {
    if (!dashboardId) {
      return;
    }

    setIsGenerating(true);
    const runId = await generateDashboard(reportId, dashboardId);
    setIsGenerating(false);

    if (runId) {
      onConfirm(runId);
    }
  }, [reportId, dashboardId, generateDashboard, onConfirm]);

  if (loading) {
    return (
      <EditorContainer>
        <LoadingContainer vertical align="center" justify="center">
          <Spin size="large" />
          <Typography.Text type="secondary" css={{ marginTop: 16 }}>
            {t('Loading schema report...')}
          </Typography.Text>
        </LoadingContainer>
      </EditorContainer>
    );
  }

  if (error || !report) {
    return (
      <EditorContainer>
        <ErrorContainer vertical align="center" gap={16}>
          <Icons.ExclamationCircleOutlined iconSize="xl" iconColor="error" />
          <Typography.Text type="danger">
            {error || t('Failed to load schema report')}
          </Typography.Text>
          <Button onClick={refetch}>{t('Retry')}</Button>
        </ErrorContainer>
        <FooterActions justify="flex-start">
          <Button onClick={onBack}>{t('Back')}</Button>
        </FooterActions>
      </EditorContainer>
    );
  }

  return (
    <EditorContainer>
      <AIBannerWrapper>
        <AIInfoBanner
          text={t(
            'Review and edit AI-generated descriptions for your tables and columns. These descriptions help improve data understanding and dashboard generation accuracy.',
          )}
          data-test="schema-editor-ai-hint"
        />
      </AIBannerWrapper>
      <ContentGrid>
        <SchemaTreeView
          tables={report.tables}
          selection={selection}
          onSelectionChange={handleSelectionChange}
          schemaName={report.schema_name}
        />
        <SchemaDetailPanel
          selection={selection}
          onUpdateTableDescription={handleUpdateTableDescription}
          onUpdateColumnDescription={handleUpdateColumnDescription}
          isUpdating={mutationState.loading}
        />
      </ContentGrid>

      <JoinsList
        databaseReportId={reportId}
        joins={report.joins}
        tables={report.tables.map(table => ({
          id: table.id,
          name: table.name,
          columns: table.columns.map(col => ({
            id: col.id,
            name: col.name,
            type: col.type,
          })),
        }))}
        onJoinsUpdate={() => {
          // Refetch the report to get updated joins
          refetch();
        }}
      />

      <FooterActions justify="space-between" align="center">
        <Button onClick={onBack} disabled={isGenerating}>
          {t('Back')}
        </Button>
        <Button
          buttonStyle="primary"
          onClick={handleConfirmAndGenerate}
          loading={isGenerating}
          disabled={!dashboardId}
        >
          {t('Confirm Schema & Generate Dashboard')}
        </Button>
      </FooterActions>
    </EditorContainer>
  );
}
