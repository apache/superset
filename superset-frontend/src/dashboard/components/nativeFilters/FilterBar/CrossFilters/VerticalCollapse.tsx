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

import { useMemo } from 'react';
import { Collapse, Divider } from '@superset-ui/core/components';
import { t } from '@superset-ui/core';
import { FilterBarOrientation } from 'src/dashboard/types';
import CrossFilter from './CrossFilter';
import { CrossFilterIndicator } from '../../selectors';

const CrossFiltersVerticalCollapse = (props: {
  crossFilters: CrossFilterIndicator[];
}) => {
  const { crossFilters } = props;
  const crossFiltersIndicators = useMemo(
    () =>
      crossFilters.map(filter => (
        <CrossFilter
          key={filter.emitterId}
          filter={filter}
          orientation={FilterBarOrientation.Vertical}
        />
      )),
    [crossFilters],
  );

  if (!crossFilters.length) {
    return null;
  }

  return (
    <Collapse
      ghost
      defaultActiveKey="crossFilters"
      expandIconPosition="end"
      items={[
        {
          key: 'crossFilters',
          label: t('Cross-filters'),
          children: (
            <>
              {crossFiltersIndicators}
              <Divider data-test="cross-filters-divider" />
            </>
          ),
        },
      ]}
    />
  );
};

export default CrossFiltersVerticalCollapse;
