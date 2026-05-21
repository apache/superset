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
import { ReactNode } from 'react';
import VersionHistoryPanel from '../components/VersionHistoryPanel';
import PreviewBanner from '../components/PreviewBanner';
import { VersionHistoryProvider } from '../context/VersionHistoryContext';

interface Props {
  dashboardUuid: string | null | undefined;
  children: ReactNode;
}

/**
 * Mounts the cross-entity VersionHistoryProvider + side panel for the
 * dashboard view. Dashboard-level preview rendering (swapping
 * sliceEntities / dashboardLayout from a snapshot) is deferred to a
 * follow-up; today the panel still lists versions and restore works via
 * the backend endpoint (which the panel calls directly).
 */
export function DashboardVersionHistoryRoot({
  dashboardUuid,
  children,
}: Props) {
  return (
    <VersionHistoryProvider>
      {children}
      <VersionHistoryPanel entityType="dashboard" uuid={dashboardUuid} />
    </VersionHistoryProvider>
  );
}

export { PreviewBanner };
