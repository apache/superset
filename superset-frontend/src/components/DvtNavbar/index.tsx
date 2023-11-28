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
import React, { useState } from 'react';
import {
  StyledDvtNavbar,
  NavbarTop,
  NavbarBottom,
  NavbarBottomRight,
} from './dvt-navbar.module';
import DvtTabs from '../DvtTabs';
import DvtButton from '../DvtButton';

const dashboardTabs = [
  { label: 'All', icon: 'full' },
  { label: 'Mine', icon: 'minus' },
];

export interface DvtNavbarProps {
  user?: any;
}

const DvtNavbar: React.FC<DvtNavbarProps> = ({ user }) => {
  const [active, setActive] = useState<string>('All');

  return (
    <StyledDvtNavbar>
      <NavbarTop>Navbar Top Component coming soon...</NavbarTop>
      <NavbarBottom>
        <DvtTabs active={active} setActive={setActive} data={dashboardTabs} />
        <NavbarBottomRight>
          <DvtButton
            colour="grayscale"
            typeColour="outline"
            label="Filter"
            icon="filter"
            onClick={() => {}}
          />
          <DvtButton
            typeColour="powder"
            label="Sort: Date Created"
            icon="dvt-sort"
            onClick={() => {}}
          />
        </NavbarBottomRight>
      </NavbarBottom>
    </StyledDvtNavbar>
  );
};

export default DvtNavbar;
