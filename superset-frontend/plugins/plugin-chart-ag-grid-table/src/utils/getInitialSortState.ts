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
import { SortModelItem } from 'ag-grid-community';
import { SortByItem } from '../types';

const getInitialSortState = (sortBy?: SortByItem[]): SortModelItem[] => {
  if (Array.isArray(sortBy) && sortBy.length > 0) {
    return [
      {
        colId: sortBy[0]?.id,
        sort: sortBy[0]?.desc ? 'desc' : 'asc',
      },
    ];
  }
  return [];
};

export default getInitialSortState;
