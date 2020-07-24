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
import Button from '../Button';
import styled from '@superset-ui/style';
import { t } from '@superset-ui/translation';

const buttonStyle = {
  marginTop: '12px',
  marginRight: '30px',
};

const StyledButton = styled(Button)`
  margin-top: 12px;
  margin-right: 30px;
  padding: 5px 80px 5px 50px;

  i:before {
    content: ' ';
  }

  .caret {
    color: ${({ theme }) => theme.colors.grayscale.light5};
  }
`;

const dropdownItems = [
	'SQL Query',
	'Chart',
	'Dashboard',
];

export default function NewMenu() {
  return (
    <li className="dropdown">
	  <StyledButton
        type="button"
        data-toggle="dropdown"
        className="dropdown-toggle btn btn-sm btn-primary"
		dropdownItems={dropdownItems}
      >
		New
        <span className="caret-container">
	      <span className="caret" />
		</span>
      </StyledButton>
      <ul className="dropdown-menu">
        <li>
          <a href="/superset/sqllab">
            <span className="fa fa-fw fa-search" />
            {t('SQL Query')}
          </a>
        </li>
        <li>
          <a href="/chart/add">
            <span className="fa fa-fw fa-bar-chart" />
            {t('Chart')}
          </a>
        </li>
        <li>
          <a href="/dashboard/new/">
            <span className="fa fa-fw fa-dashboard" />
            {t('Dashboard')}
          </a>
        </li>
      </ul>
    </li>
  );
}
