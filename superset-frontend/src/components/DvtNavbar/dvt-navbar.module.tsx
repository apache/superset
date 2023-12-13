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

const StyledDvtNavbar = styled.div`
  padding: 0 30px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  position: fixed;
  top: 0;
  right: 0;
  left: 250px;
`;

const NavbarTop = styled.div`
  display: flex;
  align-items: center;
  min-height: 80px;
  border-top: 1px solid ${({ theme }) => theme.colors.dvt.border.base};
`;

const NavbarBottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 80px;
  border-top: 1px solid ${({ theme }) => theme.colors.dvt.border.base};
`;

const NavbarBottomRight = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const NavbarSearchInput = styled.div`
  width: 200px;
`;

const NavbarProfileMenu = styled.div`
  display: flex;
  width: 70px;
`;

const NavbarProfileIcon = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  margin-left: auto;
  margin-right: 32px;
`;

const NavbarProfileIconDot = styled.div`
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: ${({ theme }) => theme.colors.error.base};
  border-radius: 50%;
  top: 1px;
  right: 1px;
  border: 1px ${({ theme }) => theme.colors.grayscale.light5};
`;

const NavbarSearchGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 434px;
  margin-left: auto;
  margin-right: 150px;
  font-size: 14px;
  font-weight: 500;
`;

export {
  StyledDvtNavbar,
  NavbarTop,
  NavbarBottom,
  NavbarBottomRight,
  NavbarSearchInput,
  NavbarProfileMenu,
  NavbarSearchGroup,
  NavbarProfileIcon,
  NavbarProfileIconDot,
};
