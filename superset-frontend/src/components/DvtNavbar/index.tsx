/* eslint-disable translation-vars/no-template-vars */
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
import { useDispatch } from 'react-redux';
import { useAppSelector } from 'src/hooks/useAppSelector';
// import { dvtAppSetSort } from 'src/dvt-redux/dvt-appReducer';
import { BellOutlined } from '@ant-design/icons';
import { dvtNavbarSqlSetTabs } from 'src/dvt-redux/dvt-navbarReducer';
import {
  DvtNavbarTabsData,
  UserData,
  TabsDataProps,
  WithNavbarBottom,
} from './dvt-navbar-tabs-data';
import DvtButtonTabs from '../DvtButtonTabs';
import DvtButton from '../DvtButton';
import DvtDotTitle from '../DvtDotTitle';
import { t } from '@superset-ui/core';
// import DvtInput from '../DvtInput';
// import DvtSelect from '../DvtSelect';
import DvtProfileMenu from '../DvtProfileMenu';
import {
  StyledDvtNavbar,
  NavbarTop,
  NavbarBottom,
  NavbarBottomRight,
  // NavbarSearchInput,
  NavbarProfileMenu,
  NavbarSearchGroup,
  NavbarProfileIcon,
  NavbarProfileIconDot,
} from './dvt-navbar.module';

export interface DvtNavbarProps {
  pathName: string;
  user?: any;
}

const DvtNavbar: React.FC<DvtNavbarProps> = ({ pathName, user }) => {
  const dispatch = useDispatch();
  // const sort = useAppSelector(state => state.dvtApp.sort);
  const sqlSelector = useAppSelector(state => state.dvtNavbar.sql);
  const [active, setActive] = useState<string>('All');
  const [activeData, setActiveData] = useState<TabsDataProps[]>([]);

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
      case '/databaseview/list/':
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
        return 'Create New Chart';
      case '/dataset/add/':
        return 'New Dataset';
      default:
        return '';
    }
  };

  useEffect(() => {
    const tabsDataFindPathname = DvtNavbarTabsData.find(
      (item: { pathname: string }) => item.pathname === pathName,
    );

    if (tabsDataFindPathname?.pathname) {
      setActive(tabsDataFindPathname.data[0].label);
      setActiveData(tabsDataFindPathname.data);
    }
  }, [pathName]);

  // const [searchText, setSearchText] = useState<string>('');

  return (
    <StyledDvtNavbar>
      <NavbarTop>
        {pathName !== '/superset/profile/admin/' ? (
          <>
            <DvtDotTitle label={pathTitles(pathName)} />
            <NavbarSearchGroup>
              {/* Search
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
              </NavbarSearchInput> */}
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
      {WithNavbarBottom.includes(pathName) && (
        <NavbarBottom>
          {pathName === '/alert/list/' && (
            <>
              <DvtButtonTabs
                active={active}
                setActive={setActive}
                data={activeData}
              />
              {/* <NavbarBottomRight>
                 <DvtButton
                  typeColour="powder"
                  label={`${sort ? 'Sorted' : 'Sort'}: Date Created`}
                  icon="dvt-sort"
                  onClick={() => dispatch(dvtAppSetSort(!sort))}
                />
              </NavbarBottomRight> */}
            </>
          )}
          {pathName === '/chart/add' && (
            <>
              <div />
              <NavbarBottomRight>
                <DvtButton
                  typeColour="powder"
                  label={t('Create New Chart')}
                  onClick={() => {}}
                  bold
                />
              </NavbarBottomRight>
              {console.log(t('Create New Chart'))}
            </>
          )}
          {pathName === '/superset/sqllab/history/' && (
            <DvtButtonTabs
              active={sqlSelector.tabs}
              data={activeData}
              setActive={value => dispatch(dvtNavbarSqlSetTabs(value))}
            />
          )}
        </NavbarBottom>
      )}
    </StyledDvtNavbar>
  );
};

export default DvtNavbar;
