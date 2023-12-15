import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
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
  StyledDvtSidebarBodySelect,
  StyledDvtSidebarFooter,
  StyledDvtSidebarNavbarLogout,
} from './dvt-sidebar.module';
import DvtList from '../DvtList';
import DvtDatePicker from '../DvtDatepicker';
import { dvtSidebarSetOwner } from 'src/dvt-redux/dvt-sidebarReducer';

interface DvtSidebarProps {
  pathName: string;
}

const DvtSidebar: React.FC<DvtSidebarProps> = ({ pathName }) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [active, setActive] = useState<string>('test');
  const dispatch = useDispatch();

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
        return 'SQL Lab';
      case '/tablemodelview/list/':
        return 'Datasets';
      case '/superset/sqllab/history/':
        return 'SQL History';
      case '/superset/profile/admin/':
        return 'Profile';
      default:
        return '';
    }
  };

  const sidebarDataFindPathname = DvtSidebarData.find(
    (item: { pathname: string }) => item.pathname === pathName,
  );

  return (
    <StyledDvtSidebar pathName={pathName}>
      <StyledDvtSidebarHeader>
        <DvtLogo title="AppName" />
      </StyledDvtSidebarHeader>
      {pathTitles(pathName) === 'Welcome Page' && (
        <StyledDvtSidebarBody pathName={pathName}>
          {sidebarDataFindPathname?.data.map((data: any, index: number) => (
            <StyledDvtSidebarBodyItem key={index}>
              {data.titleMenu === 'folder navigation' && (
                <>
                  <DvtTitlePlus title={data.title} />
                  <DvtNavigation data={data.data} />
                </>
              )}
              {data.titleMenu === 'folder' && (
                <>
                  <DvtTitlePlus title={data.title} onClick={() => {}} />
                  <DvtFolderNavigation data={data.data} />
                </>
              )}
              {data.titleMenu === 'shared folder' && (
                <DvtTitlePlus title={data.title} onClick={() => {}} />
              )}
            </StyledDvtSidebarBodyItem>
          ))}
        </StyledDvtSidebarBody>
      )}

      {(pathTitles(pathName) === 'Datasets' ||
        pathTitles(pathName) === 'Dashboards' ||
        pathTitles(pathName) === 'Alerts' ||
        pathTitles(pathName) === 'Reports' ||
        pathTitles(pathName) === 'Connection' ||
        pathTitles(pathName) === 'SQL Lab' ||
        pathTitles(pathName) === 'SQL History') && (
        <StyledDvtSidebarBody pathName={pathName}>
          {sidebarDataFindPathname?.data.map(
            (
              data: {
                label: string;
                values: { label: string; value: string }[];
                placeholder: string;
                valuesList: { id: number; title: string; subtitle: string }[];
                title: string;
                datePicker?: boolean;
              },
              index: number,
            ) => (
              <StyledDvtSidebarBodySelect key={index}>
                {!data.datePicker && !data.valuesList && (
                  <DvtSelect
                    data={data.values}
                    label={data.label}
                    placeholder={data.placeholder}
                    selectedValue=""
                    setSelectedValue={value => {
                      dispatch(dvtSidebarSetOwner(value));
                    }}
                    maxWidth
                  />
                )}
                {data.valuesList && (
                  <>
                    <DvtSelect
                      data={data.values}
                      label={data.label}
                      placeholder={data.placeholder}
                      selectedValue=""
                      setSelectedValue={() => {}}
                      maxWidth
                    />
                    <DvtList data={data.valuesList} title={data.title} />
                  </>
                )}
                {data.datePicker && (
                  <DvtDatePicker
                    isOpen
                    label={data.label}
                    placeholder={data.placeholder}
                    selectedDate={null}
                    setIsOpen={() => {}}
                    setSelectedDate={() => {}}
                    maxWidth
                  />
                )}
              </StyledDvtSidebarBodySelect>
            ),
          )}
        </StyledDvtSidebarBody>
      )}

      {pathTitles(pathName) === 'Profile' && (
        <StyledDvtSidebarBody pathName={pathName}>
          {sidebarDataFindPathname?.data.map((data: any, index: number) => (
            <StyledDvtSidebarBodyItem key={index}>
              <DvtNavigationBar
                active={active}
                data={data.items}
                setActive={setActive}
              />
              <StyledDvtSidebarNavbarLogout>
                <DvtNavigationBar data={data.itemsLogout} />
              </StyledDvtSidebarNavbarLogout>
            </StyledDvtSidebarBodyItem>
          ))}
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
