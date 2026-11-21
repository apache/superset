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
import { useDataMaskStore } from './useDataMaskStore';

/**
 * Reactive reads of the dataMask store for components. Writes go through
 * `./actions`; the raw store is for adapters (hydration, sync, embedded).
 */

/** Applied dataMask of every native filter, display control and cross-filter. */
export const useDataMask = () => useDataMaskStore(s => s.dataMask);

/** Applied value of one filter or cross-filter; undefined when it has none. */
export const useDataMaskValue = (filterId: string | number | undefined) =>
  useDataMaskStore(s =>
    filterId == null ? undefined : s.dataMask[filterId]?.filterState?.value,
  );
