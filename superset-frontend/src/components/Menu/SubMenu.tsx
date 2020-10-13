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
import React, { ReactNode } from 'react';
import { Link, useHistory } from 'react-router-dom';
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
      a,
      div {
        font-size: ${({ theme }) => theme.typography.sizes.s}px;
        padding: ${({ theme }) => theme.gridUnit * 2}px 0;
        margin: ${({ theme }) => theme.gridUnit * 2}px;
        color: ${({ theme }) => theme.colors.secondary.dark1};

        a {
          margin: 0;
          padding: ${({ theme }) => theme.gridUnit * 4}px;
        }
      }

      &.no-router a {
        padding: ${({ theme }) => theme.gridUnit * 2}px
          ${({ theme }) => theme.gridUnit * 4}px;
      }
    }
    li.active > a,
    li.active > div,
    li > a:hover,
    li > div:hover {
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
  usesRouter?: boolean;
};

export interface ButtonProps {
  name: ReactNode;
  onClick: OnClickHandler;
  buttonStyle:
    | 'primary'
    | 'secondary'
    | 'dashed'
    | 'link'
    | 'warning'
    | 'success'
    | 'tertiary';
}

export interface SubMenuProps {
  buttons?: Array<ButtonProps>;
  name: string;
  children?: MenuChild[];
  activeChild?: MenuChild['name'];
  /* If usesRouter is true, a react-router <Link> component will be used instead of href.
   *  ONLY set usesRouter to true if SubMenu is wrapped in a react-router <Router>;
   *  otherwise, a 'You should not use <Link> outside a <Router>' error will be thrown */
  usesRouter?: boolean;
}

const SubMenu: React.FunctionComponent<SubMenuProps> = props => {
  let hasHistory = true;
  // If no parent <Router> component exists, useHistory throws an error
  try {
    useHistory();
  } catch (err) {
    // If error is thrown, we know not to use <Link> in render
    hasHistory = false;
  }
  return (
    <StyledHeader>
      <Navbar inverse fluid role="navigation">
        <Navbar.Header>
          <Navbar.Brand>{props.name}</Navbar.Brand>
        </Navbar.Header>
        <Nav>
          {props.children &&
            props.children.map(child => {
              if ((props.usesRouter || hasHistory) && !!child.usesRouter) {
                return (
                  <li
                    className={child.name === props.activeChild ? 'active' : ''}
                    key={`${child.label}`}
                  >
                    <div>
                      <Link to={child.url}>{child.label}</Link>
                    </div>
                  </li>
                );
              }

              return (
                <MenuItem
                  className="no-router"
                  active={child.name === props.activeChild}
                  key={`${child.label}`}
                  href={child.url}
                >
                  {child.label}
                </MenuItem>
              );
            })}
        </Nav>
        <Nav className="navbar-right">
          {props.buttons?.map((btn, i) => (
            <Button
              key={`${i}`}
              buttonStyle={btn.buttonStyle}
              onClick={btn.onClick}
            >
              {btn.name}
            </Button>
          ))}
        </Nav>
      </Navbar>
    </StyledHeader>
  );
};

export default SubMenu;
