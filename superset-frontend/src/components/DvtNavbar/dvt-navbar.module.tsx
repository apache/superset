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
`;

const NavbarTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
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

export { StyledDvtNavbar, NavbarTop, NavbarBottom, NavbarBottomRight };
