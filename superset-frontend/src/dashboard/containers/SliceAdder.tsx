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
import { useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  useDashboardStateStore,
  useDashboardInfoStore,
} from 'src/dashboard/stores';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { LocalStorageKeys, getItem } from 'src/utils/localStorageHelpers';
import { useSlicesQuery, type SlicesListParams } from '../queries';
import SliceAdder, { DEFAULT_SORT_KEY } from '../components/SliceAdder';

export default function SliceAdderContainer() {
  const editMode = useDashboardStateStore(s => s.editMode);
  const sliceIds = useDashboardStateStore(s => s.sliceIds);
  const dashboardInfo = useDashboardInfoStore(s => s.dashboardInfo);
  const { addDangerToast } = useToasts();
  const userId = +dashboardInfo.userId;

  const [queryParams, setQueryParams] = useState<SlicesListParams>(() => ({
    userId: getItem(LocalStorageKeys.DashboardEditorShowOnlyMyCharts, true)
      ? userId
      : undefined,
    filterValue: '',
    sortColumn: DEFAULT_SORT_KEY,
  }));

  const {
    data: slices,
    isFetching,
    dataUpdatedAt,
    error,
  } = useSlicesQuery(queryParams);

  useEffect(() => {
    if (error) {
      addDangerToast(t('Could not fetch all saved charts'));
    }
  }, [error, addDangerToast]);

  return (
    <SliceAdder
      setQueryParams={setQueryParams}
      userId={userId}
      dashboardId={dashboardInfo.id}
      selectedSliceIds={sliceIds}
      slices={slices ?? {}}
      isLoading={isFetching}
      errorMessage={error ? t('Could not fetch all saved charts') : ''}
      lastUpdated={dataUpdatedAt}
      editMode={editMode}
    />
  );
}
