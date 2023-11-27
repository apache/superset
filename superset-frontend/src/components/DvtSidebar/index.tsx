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

export interface DvtSidebarProps {
  data: any[];
  isFrontendRoute?: (path?: string) => boolean;
}

const DvtSidebar: React.FC<DvtSidebarProps> = ({
  data,
  isFrontendRoute = () => false,
}) => {
  const [darkMode, setDarkMode] = useState<boolean>(false);

  return (
    <StyledDvtSidebar>
      <StyledDvtSidebarHeader>
        <DvtLogo title="AppName" />
      </StyledDvtSidebarHeader>
      <StyledDvtSidebarBody>
        <StyledDvtSidebarBodyItem>
          <DvtTitlePlus title="menu" />
          <DvtNavigation
            data={[
              { title: 'Connections', url: '/', fileName: 'calendar' },
              { title: 'Dataset', url: '/', fileName: 'database' },
              { title: 'Dashboard', url: '/', fileName: 'grid' },
              { title: 'Report', url: '/', fileName: 'code' },
              { title: 'Alert', url: '/', fileName: 'alert' },
            ]}
          />
        </StyledDvtSidebarBodyItem>
        <StyledDvtSidebarBodyItem>
          <DvtTitlePlus title="my folder" onClick={() => {}} />
        </StyledDvtSidebarBodyItem>
        <StyledDvtSidebarBodyItem>
          <DvtTitlePlus title="shared folder" onClick={() => {}} />
        </StyledDvtSidebarBodyItem>
      </StyledDvtSidebarBody>
      <StyledDvtSidebarFooter>
        <DvtDarkMode darkMode={darkMode} setDarkMode={setDarkMode} />
      </StyledDvtSidebarFooter>
    </StyledDvtSidebar>
  );
};

export default DvtSidebar;
