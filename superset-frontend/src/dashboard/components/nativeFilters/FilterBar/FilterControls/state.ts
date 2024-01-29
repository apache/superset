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
import { useSelector } from 'react-redux';
import {
  DataMaskStateWithId,
  ensureIsArray,
  ExtraFormData,
} from '@superset-ui/core';
import { mergeExtraFormData } from '../../utils';

// eslint-disable-next-line import/prefer-default-export
export function useFilterDependencies(
  id: string,
  dataMaskSelected?: DataMaskStateWithId,
): ExtraFormData {
  const dependencyIds = useSelector<any, string[] | undefined>(
    state => state.nativeFilters.filters[id]?.cascadeParentIds,
  );
  return useMemo(() => {
    let dependencies = {};
    ensureIsArray(dependencyIds).forEach(parentId => {
      const parentState = dataMaskSelected?.[parentId];
      dependencies = mergeExtraFormData(
        dependencies,
        parentState?.extraFormData,
      );
    });
    return dependencies;
  }, [dataMaskSelected, dependencyIds]);
}
