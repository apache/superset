import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import DvtLogo from '../DvtLogo';
import DvtDarkMode from '../DvtDarkMode';
import {
  StyledDvtSidebar,
  StyledDvtSidebarHeader,
  StyledDvtSidebarBody,
  StyledDvtSidebarBodyItem,
  StyledDvtSidebarFooter,
} from './dvt-sidebar.module';
import DvtTitlePlus from '../DvtTitlePlus';
import DvtNavigation from '../DvtNavigation';
import DvtFolderNavigation from '../DvtFolderNavigation';
import DvtSelect from '../DvtSelect';
import DvtNavigationBar from '../DvtNavigationBar';

const DvtSidebar: React.FC = ({}) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  let data = require('./dvtSidebarData.json');

  return (
    <Router>
      <StyledDvtSidebar>
        <StyledDvtSidebarHeader>
          <DvtLogo title="AppName" />
        </StyledDvtSidebarHeader>
        <Switch>
          <Route
            path="/superset/welcome"
            render={() => (
              <StyledDvtSidebarBody>
                <StyledDvtSidebarBodyItem>
                  <DvtTitlePlus
                    title={data.welcomeData?.navigationData?.title || ''}
                  />
                  <DvtNavigation
                    data={data.welcomeData?.navigationData?.data || []}
                  />
                </StyledDvtSidebarBodyItem>
                <StyledDvtSidebarBodyItem>
                  <DvtTitlePlus
                    title={data.welcomeData?.folderNavigationDate?.title || ''}
                    onClick={() => {}}
                  />
                  <DvtFolderNavigation
                    data={data.welcomeData?.folderNavigationDate?.data || []}
                  />
                </StyledDvtSidebarBodyItem>
                <StyledDvtSidebarBodyItem>
                  <DvtTitlePlus title="shared folder" onClick={() => {}} />
                </StyledDvtSidebarBodyItem>
              </StyledDvtSidebarBody>
            )}
          />
        </Switch>

        <Switch>
          <Route
            path="/superset/welcome"
            render={() => (
              <StyledDvtSidebarBody>
                <StyledDvtSidebarBodyItem>
                  <DvtSelect
                    data={[
                      {
                        label: 'Failed',
                        value: 'failed',
                      },
                      {
                        label: 'Success',
                        value: 'success',
                      },
                    ]}
                    label="State"
                    placeholder="Select or type a value"
                    selectedValue=""
                    setSelectedValue={() => {}}
                  />
                </StyledDvtSidebarBodyItem>{' '}
                <StyledDvtSidebarBodyItem>
                  <DvtSelect
                    data={[
                      {
                        label: 'Failed',
                        value: 'failed',
                      },
                      {
                        label: 'Success',
                        value: 'success',
                      },
                    ]}
                    label="State"
                    placeholder="Select or type a value"
                    selectedValue=""
                    setSelectedValue={() => {}}
                  />
                </StyledDvtSidebarBodyItem>{' '}
                <StyledDvtSidebarBodyItem>
                  <DvtSelect
                    data={[
                      {
                        label: 'Failed',
                        value: 'failed',
                      },
                      {
                        label: 'Success',
                        value: 'success',
                      },
                    ]}
                    label="State"
                    placeholder="Select or type a value"
                    selectedValue=""
                    setSelectedValue={() => {}}
                  />
                </StyledDvtSidebarBodyItem>{' '}
                <StyledDvtSidebarBodyItem>
                  <DvtSelect
                    data={[
                      {
                        label: 'Failed',
                        value: 'failed',
                      },
                      {
                        label: 'Success',
                        value: 'success',
                      },
                    ]}
                    label="State"
                    placeholder="Select or type a value"
                    selectedValue=""
                    setSelectedValue={() => {}}
                  />
                </StyledDvtSidebarBodyItem>{' '}
                <StyledDvtSidebarBodyItem>
                  <DvtSelect
                    data={[
                      {
                        label: 'Failed',
                        value: 'failed',
                      },
                      {
                        label: 'Success',
                        value: 'success',
                      },
                    ]}
                    label="State"
                    placeholder="Select or type a value"
                    selectedValue=""
                    setSelectedValue={() => {}}
                  />
                </StyledDvtSidebarBodyItem>
              </StyledDvtSidebarBody>
            )}
          />
        </Switch>

        <Switch>
          <Route
            path="/superset/welcome"
            render={() => (
              <StyledDvtSidebarBody>
                <StyledDvtSidebarBodyItem>
                  <DvtNavigationBar
                    active="test"
                    data={[
                      {
                        icon: 'dvt-briefcase',
                        label: 'Created Content',
                        url: 'test',
                      },
                      {
                        icon: 'dvt-calendar',
                        label: 'Schedule',
                        url: 'test1',
                      },
                      {
                        icon: 'dvt-history',
                        label: 'Recent Activity',
                        url: 'test2',
                      },
                      {
                        icon: 'dvt-star',
                        label: 'Favorites',
                        url: 'test3',
                      },
                      {
                        icon: 'dvt-users',
                        label: 'Groups and Roles',
                        url: 'test4',
                      },
                      {
                        icon: 'dvt-arrow_forwardup',
                        label: 'Query History',
                        url: 'test5',
                      },
                    ]}
                    setActive={() => {}}
                  />
                  <DvtNavigationBar
                    data={[
                      {
                        icon: 'dvt-logout',
                        label: 'Log Out',
                      },
                    ]}
                  />
                </StyledDvtSidebarBodyItem>
              </StyledDvtSidebarBody>
            )}
          />
        </Switch>
        <Switch>
          <Route
            path="/superset/welcome"
            render={() => (
              <StyledDvtSidebarFooter>
                <DvtDarkMode darkMode={darkMode} setDarkMode={setDarkMode} />
              </StyledDvtSidebarFooter>
            )}
          />
        </Switch>
      </StyledDvtSidebar>
    </Router>
  );
};

export default DvtSidebar;
