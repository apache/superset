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
import { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { QueryFormData } from '@superset-ui/core';
import { ExplorePageState } from '../types';
import { setControlValue } from '../actions/exploreActions';

/**
 * Hook to access and update form data from Redux store
 * Provides a simple interface for control components
 */
export function useFormData() {
  const dispatch = useDispatch();

  // Get form data from Redux
  const formData = useSelector<ExplorePageState, QueryFormData>(state => {
    console.log('useFormData - state.explore:', state.explore);
    return state.explore.form_data;
  });

  // Update a single control value
  const updateControl = useCallback(
    (controlName: string, value: any) => {
      dispatch(setControlValue(controlName, value));
    },
    [dispatch],
  );

  // Update multiple controls at once
  const updateControls = useCallback(
    (updates: Partial<QueryFormData>) => {
      Object.entries(updates).forEach(([key, value]) => {
        dispatch(setControlValue(key, value));
      });
    },
    [dispatch],
  );

  return {
    formData,
    updateControl,
    updateControls,
  };
}
