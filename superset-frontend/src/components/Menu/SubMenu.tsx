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
import React from 'react';
import { styled } from '@superset-ui/core';
import { Nav, Navbar, MenuItem } from 'react-bootstrap';
import Button, { OnClickHandler } from 'src/components/Button';

const StyledHeader = styled.header`
  .navbar-header .navbar-brand {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
  .navbar-right {
    padding: 8px 0;
    margin-right: 0;
  }
  .navbar-nav {
    li {
      a {
        font-size: ${({ theme }) => theme.typography.sizes.s}px;
        padding: ${({ theme }) => theme.gridUnit * 2}px;
        margin: ${({ theme }) => theme.gridUnit * 2}px;
        color: ${({ theme }) => theme.colors.secondary.dark1};
      }
    }

    li.active > a,
    li > a:hover {
      background-color: ${({ theme }) => theme.colors.secondary.light4};
      border-bottom: none;
      border-radius: 4px;
    }
  }
`;

type MenuChild = {
  label: string;
  name: string;
  url: string;
};

export interface SubMenuProps {
  primaryButton?: {
    name: React.ReactNode;
    onClick: OnClickHandler;
  };
  secondaryButton?: {
    name: React.ReactNode;
    onClick: OnClickHandler;
  };
  name: string;
  children?: MenuChild[];
  activeChild?: MenuChild['name'];
}

const SubMenu: React.FunctionComponent<SubMenuProps> = props => {
  return (
    <StyledHeader>
      <Navbar inverse fluid role="navigation">
        <Navbar.Header>
          <Navbar.Brand>{props.name}</Navbar.Brand>
        </Navbar.Header>
        <Nav>
          {props.children &&
            props.children.map(child => (
              <MenuItem
                active={child.name === props.activeChild}
                key={`${child.label}`}
                href={child.url}
              >
                {child.label}
              </MenuItem>
            ))}
        </Nav>
        <Nav className="navbar-right">
          {props.secondaryButton && (
            <Button
              buttonStyle="secondary"
              onClick={props.secondaryButton.onClick}
              cta
            >
              {props.secondaryButton.name}
            </Button>
          )}
          {props.primaryButton && (
            <Button
              buttonStyle="primary"
              onClick={props.primaryButton.onClick}
              cta
            >
              {props.primaryButton.name}
            </Button>
          )}
        </Nav>
      </Navbar>
    </StyledHeader>
  );
};

export default SubMenu;
