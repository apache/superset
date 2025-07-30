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
import { CSSProperties, forwardRef, memo, Ref } from 'react';
import { ListViewPagination } from '@superset-ui/core/components';

export interface PaginationProps {
  pageCount: number; // number of pages
  currentPage?: number; // index of current page, zero-based
  maxPageItemCount?: number;
  ellipsis?: string; // content for ellipsis item
  onPageChange: (page: number) => void; // `page` is zero-based
  style?: CSSProperties;
}

export default memo(
  forwardRef(function Pagination(
    {
      style,
      pageCount,
      currentPage = 0,
      maxPageItemCount = 9,
      onPageChange,
    }: PaginationProps,
    ref: Ref<HTMLDivElement>,
  ) {
    return (
      <div ref={ref} className="dt-pagination" style={style}>
        <ListViewPagination
          currentPage={currentPage + 1} 
          totalPages={pageCount}
          onChange={ (page: number) => onPageChange(page - 1) }
        />
      </div>
    );
  }),
);
