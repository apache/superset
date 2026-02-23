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
import { styled, t } from '@apache-superset/core';
import { Modal, Button } from '@superset-ui/core/components';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { ChartSelector, ChartInfo } from './ChartSelector';
import { ExportProgress } from './ExportProgress';
import { useBulkExport } from './useBulkExport';

const ModalContent = styled.div`
  min-height: 400px;
`;

const Description = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.sizeUnit * 4}px;
    color: ${theme.colorTextSecondary};
    font-size: ${theme.sizeUnit * 3.5}px;
  `}
`;

const WarningMessage = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    background-color: ${theme.colorWarningBg};
    border: 1px solid ${theme.colorWarningBorder};
    border-radius: ${theme.sizeUnit}px;
    color: ${theme.colorWarningText};
    font-size: ${theme.sizeUnit * 3.5}px;
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
`;

const SummaryMessage = styled.div<{ success?: boolean }>`
  ${({ theme, success }) => `
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    background-color: ${success ? theme.colorSuccessBg : theme.colorErrorBg};
    border: 1px solid ${success ? theme.colorSuccessBorder : theme.colorErrorBorder};
    border-radius: ${theme.sizeUnit}px;
    color: ${success ? theme.colorSuccessText : theme.colorErrorText};
    font-size: ${theme.sizeUnit * 3.5}px;
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
`;

export interface ExportDashboardDataModalProps {
  show: boolean;
  onHide: () => void;
  dashboardTitle: string;
  charts: ChartInfo[];
  slices: Record<number, any>; // Slice entities from Redux
}

export const ExportDashboardDataModal = ({
  show,
  onHide,
  dashboardTitle,
  charts,
  slices,
}: ExportDashboardDataModalProps) => {
  const { addSuccessToast, addDangerToast, addWarningToast } = useToasts();
  const [selectedChartIds, setSelectedChartIds] = useState<Set<number>>(
    new Set(),
  );
  const [exportComplete, setExportComplete] = useState(false);

  const { isExporting, progress, exportCharts, generateExcelFile, reset } =
    useBulkExport({
      onComplete: async results => {
        const successCount = results.filter(r => r.status === 'success').length;
        const failureCount = results.length - successCount;

        if (successCount > 0) {
          try {
            const filename = await generateExcelFile(results, dashboardTitle);
            addSuccessToast(
              failureCount > 0
                ? t(
                    '%s of %s charts exported successfully to %s',
                    successCount,
                    results.length,
                    filename,
                  )
                : t(
                    'All %s charts exported successfully to %s',
                    successCount,
                    filename,
                  ),
            );
            setExportComplete(true);
          } catch (error: any) {
            addDangerToast(
              t(
                'Failed to generate Excel file: %s',
                error.message || 'Unknown error',
              ),
            );
          }
        }
      },
      onError: error => {
        addDangerToast(error);
      },
    });

  // Initialize with all charts selected
  useEffect(() => {
    if (show && charts.length > 0) {
      const allIds = new Set(charts.map(c => c.id));
      setSelectedChartIds(allIds);
      setExportComplete(false);
      reset();
    }
  }, [show, charts, reset]);

  const handleExport = async () => {
    if (selectedChartIds.size === 0) {
      addWarningToast(t('Please select at least one chart to export'));
      return;
    }

    if (selectedChartIds.size > 20) {
      addWarningToast(
        t(
          'Exporting more than 20 charts may take a while and could impact browser performance',
        ),
      );
    }

    // Prepare chart data for export
    const chartsToExport = Array.from(selectedChartIds)
      .map(id => {
        const slice = slices[id];
        if (!slice) return null;

        return {
          id,
          name: slice.slice_name || `Chart ${id}`,
          formData: slice.form_data || {},
        };
      })
      .filter(Boolean) as { id: number; name: string; formData: any }[];

    await exportCharts(chartsToExport);
  };

  const handleClose = () => {
    if (!isExporting) {
      reset();
      setExportComplete(false);
      onHide();
    }
  };

  const successCount = useMemo(
    () => progress.charts.filter(c => c.status === 'success').length,
    [progress.charts],
  );

  const failureCount = useMemo(
    () => progress.charts.filter(c => c.status === 'error').length,
    [progress.charts],
  );

  const renderContent = () => {
    if (isExporting || exportComplete) {
      return (
        <>
          <ExportProgress progress={progress} />
          {exportComplete && (
            <>
              {successCount > 0 && (
                <SummaryMessage success>
                  {failureCount > 0
                    ? t(
                        '%s of %s charts exported successfully. %s charts failed.',
                        successCount,
                        progress.total,
                        failureCount,
                      )
                    : t('All %s charts exported successfully!', successCount)}
                </SummaryMessage>
              )}
              {failureCount > 0 && successCount === 0 && (
                <SummaryMessage>
                  {t(
                    'All chart exports failed. Please check chart permissions and try again.',
                  )}
                </SummaryMessage>
              )}
            </>
          )}
        </>
      );
    }

    return (
      <>
        <Description>
          {t(
            'Select the charts you want to export. Each chart will be exported as a separate sheet in an Excel workbook.',
          )}
        </Description>
        {selectedChartIds.size > 20 && (
          <WarningMessage>
            {t(
              'You have selected %s charts. Exporting many charts may take a while and could impact browser performance.',
              selectedChartIds.size,
            )}
          </WarningMessage>
        )}
        <ChartSelector
          charts={charts}
          selectedChartIds={selectedChartIds}
          onSelectionChange={setSelectedChartIds}
          disabled={isExporting}
        />
      </>
    );
  };

  const renderFooter = () => {
    if (exportComplete) {
      return (
        <Button onClick={handleClose} buttonStyle="primary">
          {t('Close')}
        </Button>
      );
    }

    if (isExporting) {
      return (
        <Button onClick={handleClose} buttonStyle="secondary" disabled>
          {t('Exporting...')}
        </Button>
      );
    }

    return (
      <>
        <Button onClick={handleClose} buttonStyle="secondary">
          {t('Cancel')}
        </Button>
        <Button
          onClick={handleExport}
          buttonStyle="primary"
          disabled={selectedChartIds.size === 0}
        >
          {t('Export %s charts', selectedChartIds.size)}
        </Button>
      </>
    );
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      title={t('Export Dashboard Data')}
      footer={renderFooter()}
      width="600px"
      centered
    >
      <ModalContent>{renderContent()}</ModalContent>
    </Modal>
  );
};

export default ExportDashboardDataModal;
