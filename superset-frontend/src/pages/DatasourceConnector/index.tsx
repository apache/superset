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
import { useHistory } from 'react-router-dom';
import { t } from '@superset-ui/core';
import { Flex, Typography } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { DatabaseObject } from 'src/components/DatabaseSelector/types';
import DatabaseModal from 'src/features/databases/DatabaseModal';
import ConnectorLayout from './components/ConnectorLayout';
import DataSourcePanel from './components/DataSourcePanel';
import ReviewSchemaPanel from './components/ReviewSchemaPanel';
import useDatabaseListRefresh from './hooks/useDatabaseListRefresh';
import { ConnectorStep, DatasourceConnectorState } from './types';

const INITIAL_STATE: DatasourceConnectorState = {
  databaseId: null,
  databaseName: null,
  catalogName: null,
  schemaName: null,
  isSubmitting: false,
};

export default function DatasourceConnector() {
  const history = useHistory();
  const { addDangerToast, addSuccessToast } = useToasts();
  const { refreshKey, triggerRefresh } = useDatabaseListRefresh();

  const [state, setState] = useState<DatasourceConnectorState>(INITIAL_STATE);
  const [database, setDatabase] = useState<DatabaseObject | null>(null);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [currentStep, setCurrentStep] = useState<ConnectorStep>(
    ConnectorStep.CONNECT_DATA_SOURCE,
  );

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
    history.push('/');
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

  const handleBackToConnect = useCallback(() => {
    setCurrentStep(ConnectorStep.CONNECT_DATA_SOURCE);
  }, []);

  const handleContinueToGenerate = useCallback(() => {
    addSuccessToast(t('Moving to Generate Dashboard step'));
    setCurrentStep(ConnectorStep.GENERATE_DASHBOARD);
  }, [addSuccessToast]);

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
            onAnalysisComplete={handleContinueToGenerate}
          />
        );
      case ConnectorStep.GENERATE_DASHBOARD:
        return (
          <Flex vertical align="center" style={{ padding: '40px' }}>
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
      <ConnectorLayout currentStep={currentStep}>
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
