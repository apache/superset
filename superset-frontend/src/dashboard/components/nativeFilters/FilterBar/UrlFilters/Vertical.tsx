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

import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';
import { QueryObjectFilterClause } from '@superset-ui/core';
import { removeDataMask, updateDataMask } from 'src/dataMask/actions';
import {
  getRisonFilterParam,
  parseRisonFilters,
  RISON_UNMATCHED_DATAMASK_ID,
  risonFiltersToExtraFormDataFilters,
  updateUrlWithUnmatchedFilters,
} from 'src/dashboard/util/risonFilters';
import {
  getUrlFilterIdentity,
  getUrlFilterIndicators,
  UrlFilterIndicator,
} from './urlFilterUtils';
import UrlFiltersVerticalCollapse from './VerticalCollapse';

const UrlFiltersVertical = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();
  const [urlFilters, setUrlFilters] = useState<UrlFilterIndicator[]>(() =>
    getUrlFilterIndicators(),
  );

  // Re-read chips whenever the URL changes (back/forward navigation, or a
  // programmatic history.replace).
  useEffect(() => {
    setUrlFilters(getUrlFilterIndicators());
  }, [location.search]);

  const handleRemoveFilter = useCallback(
    (filterToRemove: UrlFilterIndicator) => {
      const risonParam = getRisonFilterParam();
      if (!risonParam) return;

      const removeId = getUrlFilterIdentity(filterToRemove.filter);
      const currentFilters = parseRisonFilters(risonParam);
      const remaining = currentFilters.filter(
        f => getUrlFilterIdentity(f) !== removeId,
      );

      updateUrlWithUnmatchedFilters(remaining, history);
      setUrlFilters(prev =>
        prev.filter(f => getUrlFilterIdentity(f.filter) !== removeId),
      );

      if (remaining.length === 0) {
        dispatch(removeDataMask(RISON_UNMATCHED_DATAMASK_ID));
      } else {
        const extraFormDataFilters: QueryObjectFilterClause[] =
          risonFiltersToExtraFormDataFilters(remaining);
        dispatch(
          updateDataMask(RISON_UNMATCHED_DATAMASK_ID, {
            extraFormData: { filters: extraFormDataFilters },
          }),
        );
      }
    },
    [dispatch, history],
  );

  if (!urlFilters.length) {
    return null;
  }

  return (
    <UrlFiltersVerticalCollapse
      urlFilters={urlFilters}
      onRemoveFilter={handleRemoveFilter}
    />
  );
};

export default UrlFiltersVertical;
