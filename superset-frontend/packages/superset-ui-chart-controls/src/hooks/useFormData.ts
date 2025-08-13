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

// Define minimal types to avoid circular dependencies
interface ExploreState {
  form_data: QueryFormData;
  [key: string]: any;
}

interface RootState {
  explore: ExploreState;
  [key: string]: any;
}

/**
 * Hook to access and update form data from Redux store
 * Provides a simple interface for control components
 *
 * NOTE: This hook assumes the Redux store structure used by Superset's explore view.
 * The actual setControlValue action should be provided by the app via context or props.
 */
export function useFormData() {
  const dispatch = useDispatch();

  // Get form data from Redux
  const formData = useSelector<RootState, QueryFormData>(state => {
    console.log('useFormData - state.explore:', state.explore);
    return state.explore?.form_data || {};
  });

  // Update a single control value
  // This is a placeholder - the actual action should be injected
  const updateControl = useCallback(
    (controlName: string, value: any) => {
      console.log('updateControl:', controlName, value);
      // In production, this would dispatch the actual setControlValue action
      // For now, we'll dispatch a generic action
      dispatch({
        type: 'SET_CONTROL_VALUE',
        controlName,
        value,
      });
    },
    [dispatch],
  );

  // Update multiple controls at once
  const updateControls = useCallback(
    (updates: Partial<QueryFormData>) => {
      Object.entries(updates).forEach(([key, value]) => {
        updateControl(key, value);
      });
    },
    [updateControl],
  );

  return {
    formData,
    updateControl,
    updateControls,
  };
}
