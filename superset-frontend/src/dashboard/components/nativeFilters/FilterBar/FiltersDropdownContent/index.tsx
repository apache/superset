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
import { FilterBarOrientation } from 'src/dashboard/types';
import { FiltersOutOfScopeCollapsible } from '../FiltersOutOfScopeCollapsible';
import { CrossFilterIndicator } from '../../selectors';

export interface FiltersDropdownContentProps {
  overflowedCrossFilters: CrossFilterIndicator[];
  filtersInScope: (Filter | Divider)[];
  filtersOutOfScope: (Filter | Divider)[];
  renderer: (filter: Filter | Divider, index: number) => ReactNode;
  rendererCrossFilter: (
    crossFilter: CrossFilterIndicator,
    orientation: FilterBarOrientation.VERTICAL,
    last: CrossFilterIndicator,
  ) => ReactNode;
  showCollapsePanel?: boolean;
  forceRenderOutOfScope?: boolean;
}

export const FiltersDropdownContent = ({
  overflowedCrossFilters,
  filtersInScope,
  filtersOutOfScope,
  renderer,
  rendererCrossFilter,
  showCollapsePanel,
  forceRenderOutOfScope,
}: FiltersDropdownContentProps) => (
  <div
    css={(theme: SupersetTheme) => css`
      width: ${theme.gridUnit * 56}px;
      padding: ${theme.gridUnit}px 0;
    `}
  >
    {overflowedCrossFilters.map(crossFilter =>
      rendererCrossFilter(
        crossFilter,
        FilterBarOrientation.VERTICAL,
        overflowedCrossFilters.at(-1) as CrossFilterIndicator,
      ),
    )}
    {filtersInScope.map(renderer)}
    {showCollapsePanel && (
      <FiltersOutOfScopeCollapsible
        filtersOutOfScope={filtersOutOfScope}
        renderer={renderer}
        forceRender={forceRenderOutOfScope}
        horizontalOverflow
      />
    )}
  </div>
);
