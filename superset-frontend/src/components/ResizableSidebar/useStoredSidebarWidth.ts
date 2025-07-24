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

export default function useStoredSidebarWidth(
  id: string,
  initialWidth: number,
) {
  const widthsMapRef = useRef<Record<string, number>>();
  const [sidebarWidth, setSidebarWidth] = useState<number>(initialWidth);

  useEffect(() => {
    widthsMapRef.current =
      widthsMapRef.current ??
      getItem(LocalStorageKeys.CommonResizableSidebarWidths, {});
    if (widthsMapRef.current[id]) {
      setSidebarWidth(widthsMapRef.current[id]);
    }
  }, [id]);

  function setStoredSidebarWidth(updatedWidth: number) {
    setSidebarWidth(updatedWidth);
    setItem(LocalStorageKeys.CommonResizableSidebarWidths, {
      ...widthsMapRef.current,
      [id]: updatedWidth,
    });
  }

  return [sidebarWidth, setStoredSidebarWidth] as const;
}
