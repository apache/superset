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
import React from 'react';
import Pagination from 'src/components/Pagination';
import {
  createUltimatePagination,
  ITEM_TYPES,
} from 'react-ultimate-pagination';

const ListViewPagination = createUltimatePagination({
  WrapperComponent: Pagination,
  itemTypeToComponent: {
    [ITEM_TYPES.PAGE]: ({ value, isActive, onClick }) => (
      <Pagination.Item active={isActive} onClick={onClick}>
        {value}
      </Pagination.Item>
    ),
    [ITEM_TYPES.ELLIPSIS]: ({ isActive, onClick }) => (
      <Pagination.Ellipsis disabled={isActive} onClick={onClick} />
    ),
    [ITEM_TYPES.PREVIOUS_PAGE_LINK]: ({ isActive, onClick }) => (
      <Pagination.Prev disabled={isActive} onClick={onClick} />
    ),
    [ITEM_TYPES.NEXT_PAGE_LINK]: ({ isActive, onClick }) => (
      <Pagination.Next disabled={isActive} onClick={onClick} />
    ),
    [ITEM_TYPES.FIRST_PAGE_LINK]: () => null,
    [ITEM_TYPES.LAST_PAGE_LINK]: () => null,
  },
});

export default ListViewPagination;
