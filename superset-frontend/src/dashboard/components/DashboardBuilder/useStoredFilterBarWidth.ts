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
import { useEffect, useRef, useState } from 'react';
import {
  LocalStorageKeys,
  setItem,
  getItem,
} from 'src/utils/localStorageHelpers';
import { OPEN_FILTER_BAR_WIDTH } from 'src/dashboard/constants';

export default function useStoredFilterBarWidth(dashboardId: string) {
  const widthsMapRef = useRef<Record<string, number>>();
  const [filterBarWidth, setFilterBarWidth] = useState<number>(
    OPEN_FILTER_BAR_WIDTH,
  );

  useEffect(() => {
    widthsMapRef.current =
      widthsMapRef.current ??
      getItem(LocalStorageKeys.dashboard__custom_filter_bar_widths, {});
    if (widthsMapRef.current[dashboardId]) {
      setFilterBarWidth(widthsMapRef.current[dashboardId]);
    }
  }, [dashboardId]);

  function setStoredFilterBarWidth(updatedWidth: number) {
    setFilterBarWidth(updatedWidth);
    setItem(LocalStorageKeys.dashboard__custom_filter_bar_widths, {
      ...widthsMapRef.current,
      [dashboardId]: updatedWidth,
    });
  }

  return [filterBarWidth, setStoredFilterBarWidth] as const;
}
