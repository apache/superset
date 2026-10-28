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
import {
  ComponentType,
  lazy,
  LazyExoticComponent,
  Suspense,
} from 'react';
import { StringParam, useQueryParam } from 'use-query-params';
import { Loading } from '@superset-ui/core/components';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import DashboardWorkspace from './index';

type DashboardListRouteProps = {
  user?: UserWithPermissionsAndRoles;
  addDangerToast?: (msg: string) => void;
  addSuccessToast?: (msg: string) => void;
};

const DashboardList: LazyExoticComponent<
  ComponentType<DashboardListRouteProps>
> = lazy(
  () => import(/* webpackChunkName: "DashboardList" */ 'src/pages/DashboardList'),
);

/**
 * `/dashboard/list/` is the Flask-backed entry. Default = split-view workspace;
 * `?view=table` keeps the classic list for rollback (lazy-loaded chunk).
 */
export default function DashboardListRoute(props: DashboardListRouteProps) {
  const [view] = useQueryParam('view', StringParam);
  if (view === 'table') {
    return (
      <Suspense fallback={<Loading />}>
        <DashboardList {...props} />
      </Suspense>
    );
  }
  return <DashboardWorkspace {...props} />;
}
