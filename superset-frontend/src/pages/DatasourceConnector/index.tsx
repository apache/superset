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
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { DatabaseObject } from 'src/components/DatabaseSelector/types';
import DatabaseModal from 'src/features/databases/DatabaseModal';
import ConnectorLayout from './components/ConnectorLayout';
import DataSourcePanel from './components/DataSourcePanel';
import DatasourceEditorPanel from './components/DatasourceEditorPanel';
import DatasourceAnalyzerPanel from './components/DatasourceAnalyzerPanel';
import DashboardGeneratorPanel from './components/DashboardGeneratorPanel';
import MappingReviewPanel from './components/MappingReviewPanel';
import useDatabaseListRefresh from './hooks/useDatabaseListRefresh';
import {
  ConnectorStep,
  DatasourceConnectorState,
  MappingProposal,
  MappingProposalResponse,
  AdjustedMappings,
  ExistingReportResponse,
  ConfidenceLevel,
} from './types';
import PendingReviewPanel from './components/PendingReviewPanel';

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
  forceReanalyze: false,
};

interface AnalysisApiResponse {
  run_id: string;
  status: string;
}

interface GenerationApiResponse {
  run_id: string;
  status: string;
}

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
  const [analysisRunId, setAnalysisRunId] = useState<string | null>(null);
  const [generationRunId, setGenerationRunId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);
  const [mappingProposal, setMappingProposal] = useState<MappingProposal | null>(
    null,
  );
  const [pendingReviewData, setPendingReviewData] = useState<{
    dashboardId: number;
    datasetId: number | null;
    failedMappings: Array<{
      type: string;
      id: string;
      name: string;
      error: string;
      alternatives?: string[];
    }>;
    reviewReasons: string[];
  } | null>(null);
  const [isProposing, setIsProposing] = useState(false);
  const [existingReportInfo, setExistingReportInfo] = useState<{
    exists: boolean;
    reportId?: number;
    tablesCount?: number;
    createdAt?: string;
  }>({ exists: false });

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
        const templateInfoMeta =
          (metadata?.template_info as Record<string, unknown>) || {};
        const isTemplate =
          (templateInfoMeta?.is_template as boolean | undefined) ??
          (metadata?.is_template as boolean | undefined) ??
          true;

        setTemplateInfo({
          id: dashboard.id,
          dashboard_title:
            (templateInfoMeta?.dashboard_title as string | undefined) ||
            dashboard.dashboard_title,
          is_template: isTemplate,
        });
      })
      .catch(error => {
        logging.error('Error fetching dashboard info:', error);
      });
  }, [dashboardId]);

  // Check for existing schema analysis report when database/schema are selected
  useEffect(() => {
    if (!state.databaseId || !state.schemaName) {
      setExistingReportInfo({ exists: false });
      return;
    }

    SupersetClient.get({
      endpoint: `/api/v1/datasource/analysis/?database_id=${state.databaseId}&schema_name=${encodeURIComponent(state.schemaName)}`,
    })
      .then(({ json }) => {
        const result = json as ExistingReportResponse;
        if (result?.exists && result.report_id) {
          setExistingReportInfo({
            exists: true,
            reportId: result.report_id,
            tablesCount: result.tables_count,
            createdAt: result.created_at ?? undefined,
          });
        } else {
          setExistingReportInfo({ exists: false });
        }
      })
      .catch(error => {
        logging.error('Error checking for existing report:', error);
        setExistingReportInfo({ exists: false });
      });
  }, [state.databaseId, state.schemaName]);

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

  const handleForceReanalyzeChange = useCallback((checked: boolean) => {
    setState(prev => ({
      ...prev,
      forceReanalyze: checked,
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

  const handleAnalysisComplete = useCallback(
    async (newReportId: number) => {
      setReportId(newReportId);

      // If we have a template, first attempt mapping proposal (may auto-start generation)
      if (dashboardId && newReportId) {
        setIsProposing(true);
        setState(prev => ({ ...prev, isSubmitting: true }));
        try {
          // First get mapping proposal; backend will auto-start if high confidence
          const response = await SupersetClient.post({
            endpoint: '/api/v1/dashboard/generation/proposals',
            jsonPayload: {
              database_report_id: newReportId,
              dashboard_id: dashboardId,
            },
          });

          const result = response.json?.result as MappingProposalResponse;

          if (result?.requires_review) {
            // Show review step to the user
            setMappingProposal({
              proposal_id: result.proposal_id || '',
              column_mappings: result.column_mappings || [],
              metric_mappings: result.metric_mappings || [],
              unmapped_columns: result.unmapped_columns || [],
              unmapped_metrics: result.unmapped_metrics || [],
              review_reasons: result.review_reasons || [],
              overall_confidence: result.overall_confidence || 0,
            });
            setCurrentStep(ConnectorStep.REVIEW_MAPPINGS);
            addSuccessToast(t('Mappings need review before generation'));
          } else if (result?.run_id) {
            setGenerationRunId(result.run_id);
            addSuccessToast(
              result.message || t('Dashboard generation started'),
            );
            setCurrentStep(ConnectorStep.GENERATE_DASHBOARD);
          } else {
            throw new Error('Invalid response from proposal/generation API');
          }
        } catch (error) {
          logging.error('Error starting dashboard generation:', error);
          addDangerToast(t('Failed to start dashboard generation'));
        } finally {
          setIsProposing(false);
          setState(prev => ({ ...prev, isSubmitting: false }));
        }
      } else {
        // No template selected - analysis complete but can't generate dashboard
        addSuccessToast(t('Schema analysis complete'));
        // Stay on the current step or redirect to a sensible place
        history.push('/dashboard/templates/');
      }
    },
    [dashboardId, addSuccessToast, addDangerToast, history],
  );

  const handleContinueToReview = useCallback(async () => {
    if (!state.databaseId || !state.schemaName) {
      addDangerToast(t('Please select a database and schema'));
      return;
    }

    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      // Use existing report if available and force reanalyze is not enabled
      if (
        !state.forceReanalyze &&
        existingReportInfo.exists &&
        existingReportInfo.reportId
      ) {
        logging.info(
          `Using existing report ${existingReportInfo.reportId} with ${existingReportInfo.tablesCount} tables`,
        );
        addSuccessToast(
          t(
            'Using existing schema analysis (created %s)',
            existingReportInfo.createdAt || 'previously',
          ),
        );

        // Directly proceed to analysis complete handler with existing report
        setState(prev => ({ ...prev, isSubmitting: false }));
        await handleAnalysisComplete(existingReportInfo.reportId);
        return;
      }

      // No existing report or force reanalyze - start new analysis
      const response = await SupersetClient.post({
        endpoint: '/api/v1/datasource/analysis/',
        jsonPayload: {
          database_id: state.databaseId,
          schema_name: state.schemaName,
          catalog_name: state.catalogName,
          force_reanalyze: state.forceReanalyze,
        },
      });

      const result = response.json?.result as AnalysisApiResponse;
      if (result?.run_id) {
        setAnalysisRunId(result.run_id);
        addSuccessToast(t('Analysis job initiated'));
        setCurrentStep(ConnectorStep.REVIEW_SCHEMA);
      } else {
        throw new Error('No run_id returned from analysis API');
      }
    } catch (error) {
      logging.error('Error starting analysis:', error);
      addDangerToast(t('Failed to start analysis'));
    } finally {
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [
    state,
    existingReportInfo,
    addDangerToast,
    addSuccessToast,
    handleAnalysisComplete,
  ]);

  // Handler when analysis completes - transition to schema editor
  const handleAnalysisCompleteToEditor = useCallback(
    (newReportId: number) => {
      setDatabaseReportId(newReportId);
      setReportId(newReportId);
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
      setGenerationRunId(runId);
      addSuccessToast(t('Dashboard generation started'));
      setCurrentStep(ConnectorStep.GENERATE_DASHBOARD);
    },
    [addSuccessToast],
  );

  const handleMappingApprove = useCallback(
    async (adjustments: AdjustedMappings) => {
      if (!mappingProposal || !reportId || !dashboardId) {
        addDangerToast(t('Missing proposal or report information'));
        return;
      }

      setIsProposing(true);
      try {
        const response = await SupersetClient.post({
          endpoint: '/api/v1/dashboard/generation/',
          jsonPayload: {
            proposal_id: mappingProposal.proposal_id,
            database_report_id: reportId,
            dashboard_id: dashboardId,
            adjusted_mappings: adjustments,
          },
        });

        const result = response.json?.result as GenerationApiResponse;
        if (result?.run_id) {
          setGenerationRunId(result.run_id);
          addSuccessToast(t('Dashboard generation started'));
          setCurrentStep(ConnectorStep.GENERATE_DASHBOARD);
        } else {
          throw new Error('No run_id returned from confirm API');
        }
      } catch (error) {
        logging.error('Error confirming mappings:', error);
        addDangerToast(t('Failed to start dashboard generation'));
      } finally {
        setIsProposing(false);
      }
    },
    [mappingProposal, reportId, dashboardId, addSuccessToast, addDangerToast],
  );

  const handleMappingCancel = useCallback(() => {
    setMappingProposal(null);
    setCurrentStep(ConnectorStep.CONNECT_DATA_SOURCE);
  }, []);

  const handleAnalysisError = useCallback(
    (error: string) => {
      addDangerToast(error);
      setCurrentStep(ConnectorStep.CONNECT_DATA_SOURCE);
    },
    [addDangerToast],
  );

  const handleGenerationComplete = useCallback(
    (generatedDashboardId: number) => {
      addSuccessToast(t('Dashboard generated successfully!'));
      history.push(`/superset/dashboard/${generatedDashboardId}/`);
    },
    [addSuccessToast, history],
  );

  const handleGenerationError = useCallback(
    (error: string) => {
      addDangerToast(error);
    },
    [addDangerToast],
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
            forceReanalyze={state.forceReanalyze}
            hasExistingReport={existingReportInfo.exists}
            existingReportInfo={
              existingReportInfo.exists
                ? t(
                    'Existing analysis found (%s tables, created %s)',
                    existingReportInfo.tablesCount ?? 0,
                    existingReportInfo.createdAt
                      ? new Date(existingReportInfo.createdAt).toLocaleDateString(
                          undefined,
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )
                      : 'previously',
                  )
                : undefined
            }
            onDatabaseChange={handleDatabaseChange}
            onCatalogChange={handleCatalogChange}
            onSchemaChange={handleSchemaChange}
            onForceReanalyzeChange={handleForceReanalyzeChange}
            onError={handleError}
            onAddNewDatabase={handleAddNewDatabase}
            onCancel={handleCancel}
            onContinue={handleContinueToReview}
          />
        );
      case ConnectorStep.REVIEW_SCHEMA:
        return analysisRunId ? (
          <DatasourceAnalyzerPanel
            runId={analysisRunId}
            databaseName={state.databaseName}
            onComplete={handleAnalysisCompleteToEditor}
            onError={handleAnalysisError}
          />
        ) : null;
      case ConnectorStep.EDIT_SCHEMA:
        return databaseReportId ? (
          <DatasourceEditorPanel
            reportId={databaseReportId}
            dashboardId={dashboardId}
            onBack={handleBackToReview}
            onConfirm={handleConfirmAndGenerate}
          />
        ) : null;
      case ConnectorStep.REVIEW_MAPPINGS:
        return mappingProposal ? (
          <MappingReviewPanel
            proposal={mappingProposal}
            onApprove={handleMappingApprove}
            onCancel={handleMappingCancel}
            isSubmitting={isProposing}
          />
        ) : null;
      case ConnectorStep.GENERATE_DASHBOARD:
        return generationRunId ? (
          <DashboardGeneratorPanel
            runId={generationRunId}
            templateName={templateInfo?.dashboard_title ?? null}
            onComplete={handleGenerationComplete}
            onError={handleGenerationError}
            onPendingReview={data => {
              setPendingReviewData({
                dashboardId: data.dashboardId,
                datasetId: (data as any).datasetId || null,
                failedMappings: data.failedMappings || [],
                reviewReasons: data.reviewReasons || [],
              });
              setCurrentStep(ConnectorStep.REVIEW_PENDING);
            }}
          />
        ) : null;
      case ConnectorStep.REVIEW_PENDING:
        return pendingReviewData ? (
          <PendingReviewPanel
            dashboardId={pendingReviewData.dashboardId}
            datasetId={pendingReviewData.datasetId}
            failedMappings={pendingReviewData.failedMappings}
            reviewReasons={pendingReviewData.reviewReasons}
            onBack={() => setCurrentStep(ConnectorStep.CONNECT_DATA_SOURCE)}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <>
      <ConnectorLayout
        currentStep={currentStep}
        templateName={templateInfo?.dashboard_title}
        databaseName={state.databaseName}
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
