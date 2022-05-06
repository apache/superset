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
import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import pick from 'lodash/pick';
import { t } from '@superset-ui/core';
import ReportModal from 'src/components/ReportModal';
import { ExplorePageState } from 'src/explore/reducers/getInitialState';
import DeleteModal from 'src/components/DeleteModal';
import { deleteActiveReport } from 'src/reports/actions/reports';

type ReportMenuItemsProps = {
  report: Record<string, any>;
  isVisible: boolean;
  onHide: () => void;
  isDeleting: boolean;
  setIsDeleting: (isDeleting: boolean) => void;
};
export const ExploreReport = ({
  report,
  isVisible,
  onHide,
  isDeleting,
  setIsDeleting,
}: ReportMenuItemsProps) => {
  const dispatch = useDispatch();
  const { chart, chartName } = useSelector((state: ExplorePageState) => ({
    chart: Object.values(state.charts || {})[0],
    chartName: state.explore.sliceName,
  }));

  const { userId, email } = useSelector<
    ExplorePageState,
    { userId?: number; email?: string }
  >(state => pick(state.explore.user, ['userId', 'email']));

  const handleReportDelete = useCallback(() => {
    dispatch(deleteActiveReport(report));
    setIsDeleting(false);
  }, [dispatch, report, setIsDeleting]);

  return (
    <>
      <ReportModal
        show={isVisible}
        onHide={onHide}
        userId={userId}
        userEmail={email}
        chart={chart}
        chartName={chartName}
        creationMethod="charts"
      />
      {isDeleting && (
        <DeleteModal
          description={t(
            'This action will permanently delete %s.',
            report.name,
          )}
          onConfirm={() => {
            if (report) {
              handleReportDelete();
            }
          }}
          onHide={() => setIsDeleting(false)}
          open
          title={t('Delete Report?')}
        />
      )}
    </>
  );
};
