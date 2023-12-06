import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import DvtLogo from '../DvtLogo';
import DvtDarkMode from '../DvtDarkMode';
import DvtTitlePlus from '../DvtTitlePlus';
import DvtNavigation from '../DvtNavigation';
import DvtFolderNavigation from '../DvtFolderNavigation';
import DvtSelect from '../DvtSelect';
import DvtNavigationBar from '../DvtNavigationBar';
import DvtSidebarData from './dvtSidebarData';
import {
  StyledDvtSidebar,
  StyledDvtSidebarHeader,
  StyledDvtSidebarBody,
  StyledDvtSidebarBodyItem,
  StyledDvtSidebarFooter,
  StyledDvtSidebarSelect,
  StyledDvtSidebarNavbarLogout,
} from './dvt-sidebar.module';

const DvtSidebar: React.FC = () => {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const history = useHistory();
  const pathName = history.location.pathname;
  const [active, setActive] = useState<string>('test');

  const pathTitles = (pathname: string) => {
    switch (pathname) {
      case '/superset/welcome/':
        return 'Welcome Page';
      case '/superset/profile/admin/':
        return 'Profile';
      case '/dataset/add/':
        return 'Datasets';
      default:
        return '';
    }
  };

  const sidebarDataFindPathname = DvtSidebarData.filter(
    (item: { pathname: string }) => item.pathname === pathName,
  );

  return (
    <StyledDvtSidebar pathName={pathName}>
      <StyledDvtSidebarHeader>
        <DvtLogo title="AppName" />
      </StyledDvtSidebarHeader>
      {pathTitles(pathName) === 'Welcome Page' && (
        <StyledDvtSidebarBody pathName={pathName}>
          <StyledDvtSidebarBodyItem>
            <DvtTitlePlus
              title={
                sidebarDataFindPathname[0]?.data[0]?.navigationData[0]?.title
              }
            />
            <DvtNavigation
              data={
                sidebarDataFindPathname[0]?.data[0]?.navigationData[0]?.data
              }
            />
          </StyledDvtSidebarBodyItem>
          <StyledDvtSidebarBodyItem>
            <DvtTitlePlus
              title={
                sidebarDataFindPathname[0]?.data[0]?.folderNavigationData[0]
                  ?.title
              }
              onClick={
                sidebarDataFindPathname[0]?.data[0]?.folderNavigationData[0]
                  ?.onClick
              }
            />
            <DvtFolderNavigation
              data={
                sidebarDataFindPathname[0]?.data[0]?.folderNavigationData[0]
                  ?.data
              }
            />
          </StyledDvtSidebarBodyItem>
          <StyledDvtSidebarBodyItem>
            <DvtTitlePlus
              title={sidebarDataFindPathname[0]?.data[0]?.items[0]?.title}
              onClick={sidebarDataFindPathname[0]?.data[0]?.items[0]?.onClick}
            />
          </StyledDvtSidebarBodyItem>
        </StyledDvtSidebarBody>
      )}

      {pathTitles(pathName) === 'Datasets' && (
        <StyledDvtSidebarBody pathName={pathName}>
          {sidebarDataFindPathname[0].data[0].selectData.map(
            (
              selectDataItem: {
                label: string;
                values: { label: string; value: string }[];
                placeholder: string;
              },
              index: number,
            ) => (
              <StyledDvtSidebarSelect key={index}>
                <DvtSelect
                  data={selectDataItem.values}
                  label={selectDataItem.label}
                  placeholder={selectDataItem.placeholder}
                  selectedValue=""
                  setSelectedValue={() => {}}
                />
              </StyledDvtSidebarSelect>
            ),
          )}
        </StyledDvtSidebarBody>
      )}

      {pathTitles(pathName) === 'Profile' && (
        <StyledDvtSidebarBody pathName={pathName}>
          <StyledDvtSidebarBodyItem>
            <DvtNavigationBar
              active={active}
              data={sidebarDataFindPathname[0]?.data[0]?.items}
              setActive={setActive}
            />
            <StyledDvtSidebarNavbarLogout>
              <DvtNavigationBar
                data={sidebarDataFindPathname[0]?.data[0]?.itemsLogout}
              />
            </StyledDvtSidebarNavbarLogout>
          </StyledDvtSidebarBodyItem>
        </StyledDvtSidebarBody>
      )}
      {pathTitles(pathName) === 'Welcome Page' && (
        <StyledDvtSidebarFooter>
          <DvtDarkMode darkMode={darkMode} setDarkMode={setDarkMode} />
        </StyledDvtSidebarFooter>
      )}
    </StyledDvtSidebar>
  );
};

export default DvtSidebar;
