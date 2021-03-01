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
import cx from 'classnames';
import { HeaderGroup } from 'react-table';
import Icon, { IconName } from 'src/components/Icon';

interface Props {
  column: HeaderGroup;
}

export const TableCollectionHeadCol: React.FC<Props> = ({ column }) => {
  if (column.hidden) return null;

  let sortName: IconName = 'sort';
  if (column.isSorted) {
    sortName = column.isSortedDesc ? 'sort-desc' : 'sort-asc';
  }

  const thProps = column.getHeaderProps(
    column.canSort ? column.getSortByToggleProps() : {},
  );
  return (
    <th {...thProps} data-test="sort-header" className={cx(column.size)}>
      <span>
        {column.render('Header')}
        {column.canSort && <Icon name={sortName} />}
      </span>
    </th>
  );
};
