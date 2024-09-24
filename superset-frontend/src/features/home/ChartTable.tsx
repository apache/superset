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
import { useEffect, useMemo, useState } from 'react';
import { t } from '@superset-ui/core';
import { filter } from 'lodash';
import {
  useChartEditModal,
  useFavoriteStatus,
  useListViewResource,
} from 'src/views/CRUD/hooks';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useHistory } from 'react-router-dom';
import { Filter, TableTab } from 'src/views/CRUD/types';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { User } from 'src/types/bootstrapTypes';
import {
  CardContainer,
  getFilterValues,
  PAGE_SIZE,
} from 'src/views/CRUD/utils';
import { LoadingCards } from 'src/pages/Home';
import ChartCard from 'src/features/charts/ChartCard';
import Chart from 'src/types/Chart';
import handleResourceExport from 'src/utils/export';
import Loading from 'src/components/Loading';
import ErrorBoundary from 'src/components/ErrorBoundary';
import EmptyState from './EmptyState';
import { WelcomeTable } from './types';
import SubMenu from './SubMenu';

interface ChartTableProps {
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  user?: User;
  mine: Array<any>;
  showThumbnails: boolean;
  otherTabData?: Array<object>;
  otherTabFilters: Filter[];
  otherTabTitle: string;
}

function ChartTable({
  user,
  addDangerToast,
  addSuccessToast,
  mine,
  showThumbnails,
  otherTabData,
  otherTabFilters,
  otherTabTitle,
}: ChartTableProps) {
  const history = useHistory();
  const initialTab = getItem(
    LocalStorageKeys.HomepageChartFilter,
    TableTab.Other,
  );

  const filteredOtherTabData = filter(otherTabData, obj => 'viz_type' in obj);

  const {
    state: { loading, resourceCollection: charts, bulkSelectEnabled },
    setResourceCollection: setCharts,
    hasPerm,
    refreshData,
    fetchData,
  } = useListViewResource<Chart>(
    'chart',
    t('chart'),
    addDangerToast,
    true,
    initialTab === TableTab.Mine ? mine : filteredOtherTabData,
    [],
    false,
  );

  const chartIds = useMemo(() => charts.map(c => c.id), [charts]);
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'chart',
    chartIds,
    addDangerToast,
  );
  const {
    sliceCurrentlyEditing,
    openChartEditModal,
    handleChartUpdated,
    closeChartEditModal,
  } = useChartEditModal(setCharts, charts);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  const getData = (tab: TableTab) =>
    fetchData({
      pageIndex: 0,
      pageSize: PAGE_SIZE,
      sortBy: [
        {
          id: 'changed_on_delta_humanized',
          desc: true,
        },
      ],
      filters: getFilterValues(tab, WelcomeTable.Charts, user, otherTabFilters),
    });

  useEffect(() => {
    if (loaded || activeTab === TableTab.Favorite) {
      getData(activeTab);
    }
    setLoaded(true);
  }, [activeTab]);

  const handleBulkChartExport = (chartsToExport: Chart[]) => {
    const ids = chartsToExport.map(({ id }) => id);
    handleResourceExport('chart', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

  const menuTabs = [
    {
      name: TableTab.Favorite,
      label: t('Favorite'),
      onClick: () => {
        setActiveTab(TableTab.Favorite);
        setItem(LocalStorageKeys.HomepageChartFilter, TableTab.Favorite);
      },
    },
    {
      name: TableTab.Mine,
      label: t('Mine'),
      onClick: () => {
        setActiveTab(TableTab.Mine);
        setItem(LocalStorageKeys.HomepageChartFilter, TableTab.Mine);
      },
    },
  ];
  if (otherTabData) {
    menuTabs.push({
      name: TableTab.Other,
      label: otherTabTitle,
      onClick: () => {
        setActiveTab(TableTab.Other);
        setItem(LocalStorageKeys.HomepageChartFilter, TableTab.Other);
      },
    });
  }

  if (loading) return <LoadingCards cover={showThumbnails} />;
  return (
    <ErrorBoundary>
      {sliceCurrentlyEditing && (
        <PropertiesModal
          onHide={closeChartEditModal}
          onSave={handleChartUpdated}
          show
          slice={sliceCurrentlyEditing}
        />
      )}

      <SubMenu
        activeChild={activeTab}
        tabs={menuTabs}
        buttons={[
          {
            name: (
              <>
                <i className="fa fa-plus" />
                {t('Chart')}
              </>
            ),
            buttonStyle: 'tertiary',
            onClick: () => {
              window.location.assign('/chart/add');
            },
          },
          {
            name: t('View All »'),
            buttonStyle: 'link',
            onClick: () => {
              const target =
                activeTab === TableTab.Favorite
                  ? `/chart/list/?filters=(favorite:(label:${t(
                      'Yes',
                    )},value:!t))`
                  : '/chart/list/';
              history.push(target);
            },
          },
        ]}
      />
      {charts?.length ? (
        <CardContainer showThumbnails={showThumbnails}>
          {charts.map(e => (
            <ChartCard
              key={`${e.id}`}
              openChartEditModal={openChartEditModal}
              chartFilter={activeTab}
              chart={e}
              userId={user?.userId}
              hasPerm={hasPerm}
              showThumbnails={showThumbnails}
              bulkSelectEnabled={bulkSelectEnabled}
              refreshData={refreshData}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              favoriteStatus={favoriteStatus[e.id]}
              saveFavoriteStatus={saveFavoriteStatus}
              handleBulkChartExport={handleBulkChartExport}
            />
          ))}
        </CardContainer>
      ) : (
        <EmptyState
          tableName={WelcomeTable.Charts}
          tab={activeTab}
          otherTabTitle={otherTabTitle}
        />
      )}
      {preparingExport && <Loading />}
    </ErrorBoundary>
  );
}

export default withToasts(ChartTable);
