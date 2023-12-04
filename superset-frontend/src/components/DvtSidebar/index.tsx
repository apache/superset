import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
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

interface WelcomeProps {
  navigationData: {
    title: string;
    data: {
      title: string;
      url: string;
      fileName: string;
    }[];
  }[];
  folderNavigationDate: {
    name: string;
    url: string;
    data: {
      name: string;
      url: string;
      data: {
        name: string;
        url: string;
      }[];
    }[];
  }[];
  items: {
    title: string;
    data: {
      title: string;
      url: string;
      fileName: string;
    }[];
  }[];
}

export interface DvtSidebarProps {
  url: string;
  sidebar: string;
  welcomeData?: WelcomeProps[];
}

const DvtSidebar: React.FC<DvtSidebarProps> = ({
  url,
  sidebar,
  welcomeData,
}) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);

  switch (url) {
    case '/superset/welcome':
      sidebar = 'welcome';
      break;
    case '/superset/reports':
    case '/superset/dashboards':
    case '/superset/datasets':
    case '/superset/sql_query_history':
    case '/superset/sql_query_history_time_range':
    case '/superset/sql_query_history_state':
    case '/superset/sql_saved_queries':
    case '/superset/sql_lab':
    case '/superset/alerts':
    case '/superset/graph_chart':
      sidebar = 'selectSidebar';
      break;
    case '/superset/profile':
      sidebar = 'profile';
      break;
  }

  return (
    <Router>
      <StyledDvtSidebar>
        <StyledDvtSidebarHeader>
          <DvtLogo title="AppName" />
        </StyledDvtSidebarHeader>
        {sidebar === 'welcome' && welcomeData && welcomeData.length > 0 && (
          <StyledDvtSidebarBody>
            <StyledDvtSidebarBodyItem>
              <DvtTitlePlus title={welcomeData[0].items[0].title || ''} />
              <DvtNavigation data={welcomeData[0].items[0].data || []} />
            </StyledDvtSidebarBodyItem>
            <StyledDvtSidebarBodyItem>
              <DvtTitlePlus title="my folder" onClick={() => {}} />
              <DvtFolderNavigation
                data={welcomeData[0].folderNavigationDate || []}
              />
            </StyledDvtSidebarBodyItem>
            <StyledDvtSidebarBodyItem>
              <DvtTitlePlus title="shared folder" onClick={() => {}} />
            </StyledDvtSidebarBodyItem>
          </StyledDvtSidebarBody>
        )}

        {sidebar === 'welcome' && (
          <StyledDvtSidebarFooter>
            <DvtDarkMode darkMode={darkMode} setDarkMode={setDarkMode} />
          </StyledDvtSidebarFooter>
        )}
      </StyledDvtSidebar>
    </Router>
  );
};

export default DvtSidebar;
