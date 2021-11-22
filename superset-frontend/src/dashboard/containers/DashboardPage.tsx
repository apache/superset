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
import React, { FC, useRef, useEffect, useState } from 'react';
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import Loading from 'src/components/Loading';
import FilterBoxMigrationModal from 'src/dashboard/components/FilterBoxMigrationModal';
import {
  useDashboard,
  useDashboardCharts,
  useDashboardDatasets,
} from 'src/common/hooks/apiResources';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import { setDatasources } from 'src/dashboard/actions/datasources';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import setupPlugins from 'src/setup/setupPlugins';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { addWarningToast } from 'src/components/MessageToasts/actions';

import {
  getFromLocalStorage,
  setInLocalStorage,
} from 'src/utils/localStorageHelpers';
import {
  FILTER_BOX_MIGRATION_STATES,
  FILTER_BOX_TRANSITION_SNOOZE_DURATION,
  FILTER_BOX_TRANSITION_SNOOZED_AT,
} from 'src/explore/constants';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { canUserEditDashboard } from 'src/dashboard/util/findPermission';
import { getFilterSets } from '../actions/nativeFilters';

export const MigrationContext = React.createContext(
  FILTER_BOX_MIGRATION_STATES.NOOP,
);

setupPlugins();
const DashboardContainer = React.lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardContainer" */
      /* webpackPreload: true */
      'src/dashboard/containers/Dashboard'
    ),
);

const originalDocumentTitle = document.title;

const DashboardPage: FC = () => {
  const dispatch = useDispatch();
  const user = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const { addDangerToast } = useToasts();
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const { result: dashboard, error: dashboardApiError } =
    useDashboard(idOrSlug);
  const { result: charts, error: chartsApiError } =
    useDashboardCharts(idOrSlug);
  const { result: datasets, error: datasetsApiError } =
    useDashboardDatasets(idOrSlug);
  const isDashboardHydrated = useRef(false);

  const error = dashboardApiError || chartsApiError;
  const readyToRender = Boolean(dashboard && charts);
  const migrationStateParam = getUrlParam(
    URL_PARAMS.migrationState,
  ) as FILTER_BOX_MIGRATION_STATES;
  const isMigrationEnabled = isFeatureEnabled(
    FeatureFlag.ENABLE_FILTER_BOX_MIGRATION,
  );
  const { dashboard_title, css, metadata, id = 0 } = dashboard || {};
  const [filterboxMigrationState, setFilterboxMigrationState] = useState(
    migrationStateParam || FILTER_BOX_MIGRATION_STATES.NOOP,
  );

  useEffect(() => {
    // should convert filter_box to filter component?
    const hasFilterBox =
      charts &&
      charts.some(chart => chart.form_data?.viz_type === 'filter_box');
    const canEdit = dashboard && canUserEditDashboard(dashboard, user);

    if (canEdit) {
      // can user edit dashboard?
      if (metadata?.native_filter_configuration) {
        setFilterboxMigrationState(
          isMigrationEnabled
            ? FILTER_BOX_MIGRATION_STATES.CONVERTED
            : FILTER_BOX_MIGRATION_STATES.NOOP,
        );
        return;
      }

      // set filterbox migration state if has filter_box in the dash:
      if (hasFilterBox) {
        if (isMigrationEnabled) {
          // has url param?
          if (
            migrationStateParam &&
            Object.values(FILTER_BOX_MIGRATION_STATES).includes(
              migrationStateParam,
            )
          ) {
            setFilterboxMigrationState(migrationStateParam);
            return;
          }

          // has cookie?
          const snoozeDash =
            getFromLocalStorage(FILTER_BOX_TRANSITION_SNOOZED_AT, 0) || {};
          if (
            Date.now() - (snoozeDash[id] || 0) <
            FILTER_BOX_TRANSITION_SNOOZE_DURATION
          ) {
            setFilterboxMigrationState(FILTER_BOX_MIGRATION_STATES.SNOOZED);
            return;
          }

          setFilterboxMigrationState(FILTER_BOX_MIGRATION_STATES.UNDECIDED);
        } else if (isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS)) {
          dispatch(
            addWarningToast(
              t(
                'filter_box will be deprecated ' +
                  'in a future version of Superset. ' +
                  'Please replace filter_box by dashboard filter components.',
              ),
            ),
          );
        }
      }
    }
  }, [readyToRender]);

  useEffect(() => {
    if (readyToRender) {
      if (!isDashboardHydrated.current) {
        isDashboardHydrated.current = true;
        if (isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET)) {
          // only initialize filterset once
          dispatch(getFilterSets());
        }
      }
      dispatch(hydrateDashboard(dashboard, charts, filterboxMigrationState));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToRender, filterboxMigrationState]);

  useEffect(() => {
    if (dashboard_title) {
      document.title = dashboard_title;
    }
    return () => {
      document.title = originalDocumentTitle;
    };
  }, [dashboard_title]);

  useEffect(() => {
    if (css) {
      // returning will clean up custom css
      // when dashboard unmounts or changes
      return injectCustomCss(css);
    }
    return () => {};
  }, [css]);

  useEffect(() => {
    if (datasetsApiError) {
      addDangerToast(
        t('Error loading chart datasources. Filters may not work correctly.'),
      );
    } else {
      dispatch(setDatasources(datasets));
    }
  }, [addDangerToast, datasets, datasetsApiError, dispatch]);

  if (error) throw error; // caught in error boundary
  if (!readyToRender) return <Loading />;

  return (
    <>
      <FilterBoxMigrationModal
        show={filterboxMigrationState === FILTER_BOX_MIGRATION_STATES.UNDECIDED}
        hideFooter={!isMigrationEnabled}
        onHide={() => {
          // cancel button: only snooze this visit
          setFilterboxMigrationState(FILTER_BOX_MIGRATION_STATES.SNOOZED);
        }}
        onClickReview={() => {
          setFilterboxMigrationState(FILTER_BOX_MIGRATION_STATES.REVIEWING);
        }}
        onClickSnooze={() => {
          const snoozedDash =
            getFromLocalStorage(FILTER_BOX_TRANSITION_SNOOZED_AT, 0) || {};
          setInLocalStorage(FILTER_BOX_TRANSITION_SNOOZED_AT, {
            ...snoozedDash,
            [id]: Date.now(),
          });
          setFilterboxMigrationState(FILTER_BOX_MIGRATION_STATES.SNOOZED);
        }}
      />

      <MigrationContext.Provider value={filterboxMigrationState}>
        <DashboardContainer />
      </MigrationContext.Provider>
    </>
  );
};

export default DashboardPage;
