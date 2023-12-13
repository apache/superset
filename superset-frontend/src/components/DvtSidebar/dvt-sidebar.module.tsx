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
import { styled } from '@superset-ui/core';

interface SidebarProps {
  pathName: string;
}
const StyledDvtSidebar = styled.div<SidebarProps>`
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 250px;
  padding: 32px 16px 39px 16px;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  box-shadow: 10px 10px 50px 0px
    ${({ theme }) => theme.colors.dvt.boxShadow.sidebar};
  z-index: 10;
`;

const StyledDvtSidebarHeader = styled.div`
  padding: 0 16px;
  padding-bottom: 27px;
  margin-bottom: 24px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.dvt.border.base};
`;

const StyledDvtSidebarBody = styled.div<SidebarProps>`
  padding: 0 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-bottom: ${({ pathName }) =>
    pathName === '/superset/welcome/' && ' 200px'};
  justify-content: ${({ pathName }) =>
    pathName === '/superset/welcome/' && ' space-between'};
`;

const StyledDvtSidebarBodyItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const StyledDvtSidebarFooter = styled.div`
  justify-content: end;
  padding: 0 16px;
`;

const StyledDvtSidebarSelect = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 17px;
  margin-left: 8px;
`;

const StyledDvtSidebarNavbarLogout = styled.div`
  display: flex;
  flex-direction: column;
  position: absolute;
  bottom: 0;
  margin-bottom: 35px;
`;

export {
  StyledDvtSidebar,
  StyledDvtSidebarHeader,
  StyledDvtSidebarBody,
  StyledDvtSidebarBodyItem,
  StyledDvtSidebarFooter,
  StyledDvtSidebarSelect,
  StyledDvtSidebarNavbarLogout,
};
