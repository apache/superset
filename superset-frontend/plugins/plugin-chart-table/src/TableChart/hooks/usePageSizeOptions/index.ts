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
import { SizeOption } from '../../../DataTable';
import { PAGE_SIZE_OPTIONS, SERVER_PAGE_SIZE_OPTIONS } from '../../../consts';

export interface UsePageSizeOptionsProps {
  serverPagination: boolean;
  dataLength: number;
  rowCount: number;
}

/**
 * Calculates available page size options based on whether server-side
 * pagination is enabled and the current data size.
 */
export function usePageSizeOptions({
  serverPagination,
  dataLength,
  rowCount,
}: UsePageSizeOptionsProps): SizeOption[] {
  return useMemo(() => {
    const getServerPagination = (n: number) => n <= rowCount;
    return (
      serverPagination ? SERVER_PAGE_SIZE_OPTIONS : PAGE_SIZE_OPTIONS
    ).filter(([n]) =>
      serverPagination ? getServerPagination(n) : n <= 2 * dataLength,
    ) as SizeOption[];
  }, [dataLength, rowCount, serverPagination]);
}
