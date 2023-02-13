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

import React, { ReactNode } from 'react';
import { css, Divider, Filter, SupersetTheme } from '@superset-ui/core';
import { FiltersOutOfScopeCollapsible } from '../FiltersOutOfScopeCollapsible';

export interface FiltersDropdownContentProps {
  filtersInScope: (Filter | Divider)[];
  filtersOutOfScope: (Filter | Divider)[];
  renderer: (filter: Filter | Divider, index: number) => ReactNode;
  showCollapsePanel?: boolean;
}

export const FiltersDropdownContent = ({
  filtersInScope,
  filtersOutOfScope,
  renderer,
  showCollapsePanel,
}: FiltersDropdownContentProps) => (
  <div
    css={(theme: SupersetTheme) =>
      css`
        width: ${theme.gridUnit * 56}px;
        padding: ${theme.gridUnit}px 0;
      `
    }
  >
    {filtersInScope.map(renderer)}
    {showCollapsePanel && (
      <FiltersOutOfScopeCollapsible
        filtersOutOfScope={filtersOutOfScope}
        renderer={renderer}
        horizontalOverflow
      />
    )}
  </div>
);
