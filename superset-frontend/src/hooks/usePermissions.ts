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
import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import { findPermission } from 'src/utils/findPermission';

export const usePermissions = () => {
  const canExplore = useSelector((state: RootState) =>
    findPermission('can_explore', 'Superset', state.user?.roles),
  );
  const canWriteExploreFormData = useSelector((state: RootState) =>
    findPermission('can_write', 'ExploreFormDataRestApi', state.user?.roles),
  );
  const canDatasourceSamples = useSelector((state: RootState) =>
    findPermission('can_samples', 'Datasource', state.user?.roles),
  );
  const canDownload = useSelector((state: RootState) =>
    findPermission('can_csv', 'Superset', state.user?.roles),
  );
  const canDrill = useSelector((state: RootState) =>
    findPermission('can_drill', 'Dashboard', state.user?.roles),
  );
  const canDrillBy = (canExplore || canDrill) && canWriteExploreFormData;
  const canDrillToDetail = (canExplore || canDrill) && canDatasourceSamples;
  const canViewQuery = useSelector((state: RootState) =>
    findPermission('can_view_query', 'Dashboard', state.user?.roles),
  );
  const canViewTable = useSelector((state: RootState) =>
    findPermission('can_view_chart_as_table', 'Dashboard', state.user?.roles),
  );

  return {
    canExplore,
    canWriteExploreFormData,
    canDatasourceSamples,
    canDownload,
    canDrill,
    canDrillBy,
    canDrillToDetail,
    canViewQuery,
    canViewTable,
  };
};
