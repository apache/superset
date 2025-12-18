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
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { SupersetClient, t, logging } from '@superset-ui/core';
import { Flex, Typography } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { DatabaseObject } from 'src/components/DatabaseSelector/types';
import DatabaseModal from 'src/features/databases/DatabaseModal';
import ConnectorLayout from './components/ConnectorLayout';
import DataSourcePanel from './components/DataSourcePanel';
import DatasourceEditorPanel from './components/DatasourceEditorPanel';
import ReviewSchemaPanel from './components/ReviewSchemaPanel';
import useDatabaseListRefresh from './hooks/useDatabaseListRefresh';
import { ConnectorStep, DatasourceConnectorState } from './types';

interface TemplateDashboardInfo {
  id: number;
  dashboard_title: string;
  is_template: boolean;
}

const INITIAL_STATE: DatasourceConnectorState = {
  databaseId: null,
  databaseName: null,
  catalogName: null,
  schemaName: null,
  isSubmitting: false,
};

export default function DatasourceConnector() {
  const history = useHistory();
  const location = useLocation();
  const { addDangerToast, addSuccessToast } = useToasts();
  const { refreshKey, triggerRefresh } = useDatabaseListRefresh();

  const [state, setState] = useState<DatasourceConnectorState>(INITIAL_STATE);
  const [database, setDatabase] = useState<DatabaseObject | null>(null);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<ConnectorStep>(
    ConnectorStep.CONNECT_DATA_SOURCE,
  );
  const [templateInfo, setTemplateInfo] =
    useState<TemplateDashboardInfo | null>(null);
  const [databaseReportId, setDatabaseReportId] = useState<number | null>(null);

  // Get dashboard_id from query params
  const dashboardId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('dashboard_id');
    return id ? parseInt(id, 10) : null;
  }, [location.search]);

  // Fetch dashboard info when dashboard_id is present
  useEffect(() => {
    if (!dashboardId) return;

    SupersetClient.get({
      endpoint: `/api/v1/dashboard/${dashboardId}`,
    })
      .then(({ json }) => {
        const dashboard = json.result;
        // json_metadata is returned as a string from the API
        let metadata: Record<string, unknown> = {};
        if (dashboard?.json_metadata) {
          try {
            metadata =
              typeof dashboard.json_metadata === 'string'
                ? JSON.parse(dashboard.json_metadata)
                : dashboard.json_metadata;
          } catch {
            logging.error('Error parsing dashboard metadata');
          }
        }
        const isTemplate = !!metadata?.is_template;
        if (isTemplate) {
          setTemplateInfo({
            id: dashboard.id,
            dashboard_title: dashboard.dashboard_title,
            is_template: true,
          });
        }
      })
      .catch(error => {
        logging.error('Error fetching dashboard info:', error);
      });
  }, [dashboardId]);

  const handleDatabaseChange = useCallback((db: DatabaseObject | null) => {
    setDatabase(db);
    setState(prev => ({
      ...prev,
      databaseId: db?.id ?? null,
      databaseName: db?.database_name ?? null,
      catalogName: null,
      schemaName: null,
    }));
  }, []);

  const handleCatalogChange = useCallback((catalogName: string | null) => {
    setState(prev => ({
      ...prev,
      catalogName,
      schemaName: null,
    }));
  }, []);

  const handleSchemaChange = useCallback((schemaName: string | null) => {
    setState(prev => ({
      ...prev,
      schemaName,
    }));
  }, []);

  const handleError = useCallback(
    (msg: string) => {
      addDangerToast(msg);
    },
    [addDangerToast],
  );

  const handleAddNewDatabase = useCallback(() => {
    setShowDatabaseModal(true);
  }, []);

  const handleDatabaseModalHide = useCallback(() => {
    setShowDatabaseModal(false);
  }, []);

  const handleDatabaseAdd = useCallback(
    (newDb?: DatabaseObject) => {
      setShowDatabaseModal(false);
      triggerRefresh();
      if (newDb) {
        handleDatabaseChange(newDb);
        addSuccessToast(t('Database connection added successfully'));
      }
    },
    [triggerRefresh, handleDatabaseChange, addSuccessToast],
  );

  const handleCancel = useCallback(() => {
    history.goBack();
  }, [history]);

  const handleContinueToReview = useCallback(async () => {
    if (!state.databaseId || !state.schemaName) {
      addDangerToast(t('Please select a database and schema'));
      return;
    }

    setState(prev => ({ ...prev, isSubmitting: true }));

    // Simulate API call with a small delay
    await new Promise(resolve => setTimeout(resolve, 500));

    addSuccessToast(t('Analysis job initiated'));
    setState(prev => ({ ...prev, isSubmitting: false }));

    // Move to the next step
    setCurrentStep(ConnectorStep.REVIEW_SCHEMA);
  }, [state, addDangerToast, addSuccessToast]);

  //const handleBackToConnect = useCallback(() => {
  //  setCurrentStep(ConnectorStep.CONNECT_DATA_SOURCE);
  //}, []);

  const handleAnalysisComplete = useCallback(
    (reportId: number) => {
      setDatabaseReportId(reportId);
      addSuccessToast(t('Analysis complete! Review and edit your schema.'));
      setCurrentStep(ConnectorStep.EDIT_SCHEMA);
    },
    [addSuccessToast],
  );

  const handleBackToReview = useCallback(() => {
    setCurrentStep(ConnectorStep.REVIEW_SCHEMA);
  }, []);

  const handleConfirmAndGenerate = useCallback(
    (runId: string) => {
      addSuccessToast(t('Dashboard generation started'));
      // Navigate to the loading screen with the run_id
      history.push(`/datasource-connector/loading/${runId}`);
    },
    [addSuccessToast, history],
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case ConnectorStep.CONNECT_DATA_SOURCE:
        return (
          <DataSourcePanel
            key={refreshKey}
            database={database}
            catalog={state.catalogName}
            schema={state.schemaName}
            isSubmitting={state.isSubmitting}
            onDatabaseChange={handleDatabaseChange}
            onCatalogChange={handleCatalogChange}
            onSchemaChange={handleSchemaChange}
            onError={handleError}
            onAddNewDatabase={handleAddNewDatabase}
            onCancel={handleCancel}
            onContinue={handleContinueToReview}
          />
        );
      case ConnectorStep.REVIEW_SCHEMA:
        return (
          <ReviewSchemaPanel
            databaseName={state.databaseName}
            schemaName={state.schemaName}
            onAnalysisComplete={handleAnalysisComplete}
          />
        );
      case ConnectorStep.EDIT_SCHEMA:
        return databaseReportId ? (
          <DatasourceEditorPanel
            reportId={databaseReportId}
            dashboardId={dashboardId}
            onBack={handleBackToReview}
            onConfirm={handleConfirmAndGenerate}
          />
        ) : (
          <Flex vertical align="center" css={{ padding: 40 }}>
            <Typography.Text type="danger">
              {t('No report ID available. Please restart the process.')}
            </Typography.Text>
          </Flex>
        );
      case ConnectorStep.GENERATE_DASHBOARD:
        return (
          <Flex vertical align="center" css={{ padding: 40 }}>
            <Typography.Title level={3}>
              {t('Generate Dashboard')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('This step is coming soon...')}
            </Typography.Text>
          </Flex>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <ConnectorLayout
        currentStep={currentStep}
        templateName={templateInfo?.dashboard_title}
      >
        {renderCurrentStep()}
      </ConnectorLayout>

      <DatabaseModal
        show={showDatabaseModal}
        onHide={handleDatabaseModalHide}
        onDatabaseAdd={handleDatabaseAdd}
        databaseId={undefined}
        dbEngine={undefined}
      />
    </>
  );
}
