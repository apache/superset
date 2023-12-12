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
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useAppSelector } from 'src/hooks/useAppSelector';
import { dvtAppSetSort } from 'src/dvt-redux/dvt-appReducer';
import { BellOutlined } from '@ant-design/icons';
import {
  DvtNavbarTabsData,
  UserData,
  TabsDataProps,
} from './dvt-navbar-tabs-data';
import DvtButtonTabs from '../DvtButtonTabs';
import DvtButton from '../DvtButton';
import DvtDotTitle from '../DvtDotTitle';
import DvtInput from '../DvtInput';
import DvtSelect from '../DvtSelect';
import DvtProfileMenu from '../DvtProfileMenu';
import {
  StyledDvtNavbar,
  NavbarTop,
  NavbarBottom,
  NavbarBottomRight,
  NavbarSearchInput,
  NavbarProfileMenu,
  NavbarSearchGroup,
  NavbarProfileIcon,
  NavbarProfileIconDot,
} from './dvt-navbar.module';

export interface DvtNavbarProps {
  user?: any;
}

const DvtNavbar: React.FC<DvtNavbarProps> = ({ user }) => {
  const history = useHistory();
  const dispatch = useDispatch();
  const sort = useAppSelector(state => state.dvtApp.sort);

  const [active, setActive] = useState<string>('All');
  const [activeData, setActiveData] = useState<TabsDataProps[]>([]);

  const pathName = history.location.pathname;

  const pathTitles = (pathname: string) => {
    switch (pathname) {
      case '/superset/welcome/':
        return 'Welcome Page';
      case '/dashboard/list/':
        return 'Dashboards';
      case '/alert/list/':
        return 'Alerts';
      case '/report/list/':
        return 'Reports';
      case '/dataset/add/':
        return 'Connection';
      case '/superset/sqllab/':
        return 'SQL';
      case '/tablemodelview/list/':
        return 'Datasets';
      case '/superset/sqllab/history/':
        return 'SQL';
      case '/superset/profile/admin/':
        return 'Profile';
      case '/chart/add':
        return 'Create a New Graph/Chart';
      default:
        return '';
    }
  };

  const withNavbarBottom = [
    '/superset/welcome/',
    '/alert/list/',
    '/superset/sqllab/history/',
    '/superset/sqllab/',
  ];

  const tabsDataFindPathname = DvtNavbarTabsData.find(
    (item: { pathname: string }) => item.pathname === pathName,
  );

  useEffect(() => {
    if (tabsDataFindPathname?.pathname) {
      setActive(tabsDataFindPathname.data[0].label);
      setActiveData(tabsDataFindPathname.data);
    }
  }, [pathName]);

  const [searchText, setSearchText] = useState<string>('');

  return (
    <StyledDvtNavbar>
      <NavbarTop>
        {pathName !== '/superset/profile/admin/' ? (
          <>
            <DvtDotTitle label={pathTitles(pathName)} />
            <NavbarSearchGroup>
              Search
              <DvtSelect
                data={[]}
                placeholder="All"
                selectedValue=""
                setSelectedValue={() => {}}
                typeDesign="navbar"
              />
              <NavbarSearchInput>
                <DvtInput
                  onChange={setSearchText}
                  type="search"
                  value={searchText}
                />
              </NavbarSearchInput>
            </NavbarSearchGroup>
          </>
        ) : (
          <NavbarProfileIcon>
            <BellOutlined style={{ fontSize: '24px' }} />
            <NavbarProfileIconDot />
          </NavbarProfileIcon>
        )}
        <NavbarProfileMenu>
          <DvtProfileMenu img={UserData.image} />
        </NavbarProfileMenu>
      </NavbarTop>
      {withNavbarBottom.includes(pathName) && (
        <NavbarBottom>
          <DvtButtonTabs
            active={active}
            setActive={setActive}
            data={activeData}
          />

          {pathName === '/superset/welcome/' && (
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
          )}
        </NavbarBottom>
      )}
    </StyledDvtNavbar>
  );
};

export default DvtNavbar;
