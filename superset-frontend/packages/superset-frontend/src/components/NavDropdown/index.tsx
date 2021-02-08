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
import { NavDropdown as ReactBootstrapNavDropdown } from 'react-bootstrap';

const NavDropdown = styled(ReactBootstrapNavDropdown)`
  &.dropdown > a.dropdown-toggle {
    padding-right: ${({ theme }) => theme.gridUnit * 6}px;
  }
  & > a {
    transition: background-color ${({ theme }) => theme.transitionTiming}s;
  }
  &.dropdown.open > a.dropdown-toggle {
    background: ${({ theme }) => theme.colors.primary.light4};
  }

  :after {
    content: '';
    height: ${({ theme }) => theme.gridUnit * 6}px;
    width: ${({ theme }) => theme.gridUnit * 6}px;
    background: url('/static/assets/images/icons/triangle_down.svg');
    background-size: contain;
    background-position: center center;
    background-repeat: no-repeat;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({ theme }) => theme.gridUnit}px;
    transition: opacity ${({ theme }) => theme.transitionTiming}s;
    opacity: ${({ theme }) => theme.opacity.mediumLight};
    pointer-events: none;
  }
  &:hover,
  &.active {
    &:after {
      opacity: ${({ theme }) => theme.opacity.mediumHeavy};
    }
  }
  .dropdown-menu {
    padding: ${({ theme }) => theme.gridUnit}px 0;
    top: 100%;
    border: none;
  }
`;

export default NavDropdown;
