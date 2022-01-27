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
import React, { CSSProperties } from 'react';
export interface PaginationProps {
    pageCount: number;
    currentPage?: number;
    maxPageItemCount?: number;
    ellipsis?: string;
    onPageChange: (page: number) => void;
    style?: CSSProperties;
}
/**
 * Generate numeric page items around current page.
 *   - Always include first and last page
 *   - Add ellipsis if needed
 */
export declare function generatePageItems(total: number, current: number, width: number): (string | number)[];
declare const _default: React.MemoExoticComponent<React.ForwardRefExoticComponent<PaginationProps & React.RefAttributes<HTMLDivElement>>>;
export default _default;
//# sourceMappingURL=Pagination.d.ts.map