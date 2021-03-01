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
import { t } from '@superset-ui/core';
import { ServerPage } from '../../types';

export interface ServerPaginationProps {
  showNext: boolean;
  showPrevious: boolean;
  onPageChange: (direction: ServerPage) => void; // `page` next/previous
  style?: CSSProperties;
}

export default React.memo(
  React.forwardRef(function ServerPagination(
    { style, onPageChange, showNext, showPrevious }: ServerPaginationProps,
    ref: React.Ref<HTMLDivElement>,
  ) {
    const getButton = (name: ServerPage, label: string) => (
      <li key={name}>
        <a
          href={undefined}
          role="button"
          onClick={e => {
            e.preventDefault();
            onPageChange(name);
          }}
        >
          {label}
        </a>
      </li>
    );
    return (
      <div ref={ref} className="dt-pagination" style={style}>
        <ul className="pagination pagination-sm">
          {showPrevious && getButton(ServerPage.PREVIOUS, t('table.previous_page'))}
          {showNext && getButton(ServerPage.NEXT, t('table.next_page'))}
        </ul>
      </div>
    );
  }),
);
