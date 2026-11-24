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
import React from 'react';
import { ensureIsArray } from '@superset-ui/core';
import { resolveView, useViews } from 'src/core/views';

export interface ViewListExtensionProps {
  viewId: string;
  /**
   * Forwarded to every component registered at this location.
   *
   * Only the locations that render the same component once per row or per
   * chart pass anything here, because those are the only ones whose component
   * cannot work out which asset it is beside: the host renders many instances
   * at once, so there is no "current" one for a namespace to report. Their
   * shape is published as `views.ListViewItemProps`.
   *
   * A location that renders a single instance supplies nothing here. The
   * state such a surface needs is read from the namespace for that surface --
   * `dashboard.hasUnsavedChanges()`, for one -- so what the location supplies
   * is not part of the published view contract.
   */
  viewProps?: Record<string, unknown>;
}

const ViewListExtension = ({ viewId, viewProps }: ViewListExtensionProps) => {
  const viewItems = ensureIsArray(useViews(viewId));

  return (
    <>
      {viewItems
        .filter(view => view && typeof view.id !== 'undefined')
        .map(view => (
          <React.Fragment key={view.id}>
            {resolveView(view.id, viewProps)}
          </React.Fragment>
        ))}
    </>
  );
};

export default ViewListExtension;
