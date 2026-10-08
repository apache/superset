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
import DashboardGrid from '../components/DashboardGrid';
import type { DashboardGridProps } from '../components/DashboardGrid';
import {
  useEditMode,
  useCanEditDashboard,
  useDashboardId,
  setEditMode,
  setDirectPathToChild,
  resizeComponent,
} from 'src/dashboard/stores';
import { useHandleComponentDrop } from 'src/dashboard/hooks/useHandleComponentDrop';

type DashboardGridContainerProps = Omit<
  DashboardGridProps,
  | 'editMode'
  | 'setEditMode'
  | 'canEdit'
  | 'dashboardId'
  | 'handleComponentDrop'
  | 'resizeComponent'
  | 'setDirectPathToChild'
  | 'theme'
>;

export default function DashboardGridContainer(
  props: DashboardGridContainerProps,
) {
  const editMode = useEditMode();
  const canEdit = useCanEditDashboard();
  const dashboardId = useDashboardId();

  const handleComponentDrop = useHandleComponentDrop();

  return (
    <DashboardGrid
      {...props}
      setDirectPathToChild={setDirectPathToChild}
      handleComponentDrop={handleComponentDrop}
      resizeComponent={resizeComponent}
      editMode={editMode}
      setEditMode={setEditMode}
      canEdit={canEdit}
      dashboardId={dashboardId}
    />
  );
}
