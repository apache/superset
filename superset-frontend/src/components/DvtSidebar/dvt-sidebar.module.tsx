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
import { Link } from 'react-router-dom';

interface SidebarProps {
  pathName: string;
}

interface SidebarIcon {
  isOpen: boolean;
  active: boolean;
}

interface SidebarRotateIcon {
  isOpen: boolean;
}

const StyledDvtSidebar = styled.div<SidebarProps>`
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: ${({ pathName }) =>
    `${pathName === '/superset/welcome/' ? 250 : 300}`}px;
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
  padding: ${({ pathName }) =>
    `0 ${pathName === '/superset/welcome/' ? 16 : 8}`}px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ pathName }) => (pathName === '/superset/welcome/' ? 40 : 12)}px;
`;

const StyledDvtSidebarBodyItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const StyledDvtSidebarBodySelect = styled.div``;

const StyledDvtSidebarFooter = styled.div`
  justify-content: end;
  padding: 0 16px;
`;

const StyledDvtSidebarNavbarLogout = styled.div`
  display: flex;
  flex-direction: column;
  position: absolute;
  bottom: 0;
  margin-bottom: 35px;
`;

const StyledDvtSidebarIconGroup = styled.div<SidebarRotateIcon>`
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 20px;
  padding-right: ${({ isOpen }) => (isOpen ? '' : '6px')};
  border-right: ${({ isOpen, theme }) =>
    isOpen ? 'none' : `3px solid ${theme.colors.dvt.border.base}`};
`;

const StyledDvtSidebarGroup = styled.div`
  display: flex;
`;

const StyledDvtSidebarIcon = styled(Link)<SidebarIcon>`
  display: flex;
  justify-content: ${({ isOpen }) => (isOpen ? '' : 'center')};
  align-items: center;
  border-radius: 10px;
  width: ${({ isOpen }) => (isOpen ? '250px' : '40px')};
  height: 40px;
  padding-left: ${({ isOpen }) => (isOpen ? '15px' : '')};
  gap: 15px;
  text-decoration: ${({ active }) => (active ? 'underline' : '')};
  font-size: 14px;
  font-weight: 500;
  background-color: ${({ theme }) => theme.colors.dvt.primary.base};
  color: ${({ theme }) => theme.colors.grayscale.light5};
  &:hover,
  &:focus {
    color: ${({ theme }) => theme.colors.grayscale.light5};
  }
`;

const StyledDvtSidebarRotateIcon = styled.div<SidebarRotateIcon>`
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.dvt.primary.base};
  color: ${({ theme }) => theme.colors.grayscale.light5};
  border-radius: 50px;
  width: 40px;
  height: 40px;
  transition: transform 0.5s ease-in-out;
  transform: ${({ isOpen }) => (isOpen ? 'rotate(180deg)' : 'none')};
`;

export {
  StyledDvtSidebar,
  StyledDvtSidebarHeader,
  StyledDvtSidebarBody,
  StyledDvtSidebarBodyItem,
  StyledDvtSidebarBodySelect,
  StyledDvtSidebarFooter,
  StyledDvtSidebarNavbarLogout,
  StyledDvtSidebarIconGroup,
  StyledDvtSidebarGroup,
  StyledDvtSidebarIcon,
  StyledDvtSidebarRotateIcon,
};
