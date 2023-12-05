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
import { useDispatch } from 'react-redux';
import { useAppSelector } from 'src/hooks/useAppSelector';
import { dvtAppSetSort } from 'src/dvt-redux/dvt-appReducer';
import {
  StyledDvtNavbar,
  NavbarTop,
  NavbarBottom,
  NavbarBottomRight,
} from './dvt-navbar.module';
import DvtButtonTabs from '../DvtButtonTabs';
import DvtButton from '../DvtButton';
import DvtDotTitle from '../DvtDotTitle';

const dashboardTabs = [
  { label: 'All', icon: 'full' },
  { label: 'Mine', icon: 'minus' },
];

export interface DvtNavbarProps {
  user?: any;
}

const DvtNavbar: React.FC<DvtNavbarProps> = ({ user }) => {
  const dispatch = useDispatch();
  const sort = useAppSelector(state => state.dvtApp.sort);
  const [active, setActive] = useState<string>('All');

  return (
    <StyledDvtNavbar>
      <NavbarTop>
        <DvtDotTitle label="Welcome Page" />
      </NavbarTop>
      <NavbarBottom>
        <DvtButtonTabs
          active={active}
          setActive={setActive}
          data={dashboardTabs}
        />
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
            label={`${sort ? 'Sorted' : 'Sort'}: Date Created`}
            icon="dvt-sort"
            onClick={() => dispatch(dvtAppSetSort(!sort))}
          />
        </NavbarBottomRight>
      </NavbarBottom>
    </StyledDvtNavbar>
  );
};

export default DvtNavbar;
