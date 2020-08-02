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
import styled from '@superset-ui/style';
import { t } from '@superset-ui/translation';
import Button, { DropdownItemProps } from '../Button';

const StyledButton = styled(Button)`
  margin-top: 12px;
  margin-right: 30px;
`;

const dropdownItems: DropdownItemProps[] = [
  {
    label: t('SQL Query'),
    url: '/superset/sqllab',
    icon: 'fa-fw fa-search',
  },
  {
    label: t('Chart'),
    url: '/chart/add',
    icon: 'fa-fw fa-bar-chart',
  },
  {
    label: t('Dashboard'),
    url: '/dashboard/new',
    icon: 'fa-fw fa-dashboard',
  },
];

export default function NewMenu() {
  return (
    <li className="dropdown">
      <StyledButton
        className="dropdown-toggle btn btn-sm btn-primary"
        dropdownItems={dropdownItems}
      >
        <i className="fa fa-plus" /> New
      </StyledButton>
    </li>
  );
}
