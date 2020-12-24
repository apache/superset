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
import cx from 'classnames';
import { Nav, Navbar } from 'react-bootstrap';
import Button, { OnClickHandler } from 'src/components/Button';

const StyledHeader = styled.header`
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  .navbar {
    margin-bottom: 0;
  }
  .navbar-header .navbar-brand {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    margin-right: ${({ theme }) => theme.gridUnit * 3}px;
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
          line-height: ${({ theme }) => theme.gridUnit * 5}px;
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
    li > a:focus,
    li > div:hover {
      background: ${({ theme }) => theme.colors.secondary.light4};
      border-bottom: none;
      border-radius: ${({ theme }) => theme.borderRadius}px;
      margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }
  .navbar-inverse {
    .navbar-nav {
      & > .active > a {
        background: ${({ theme }) => theme.colors.secondary.light4};
        &:hover,
        &:focus {
          background: ${({ theme }) => theme.colors.secondary.light4};
        }
      }
    }
  }

  .btn-link {
    padding: 10px 0;
  }
`;

type MenuChild = {
  label: string;
  name: string;
  url?: string;
  usesRouter?: boolean;
  onClick?: () => void;
};

export interface ButtonProps {
  name: ReactNode;
  onClick: OnClickHandler;
  'data-test'?: string;
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
  name?: string | ReactNode;
  tabs?: MenuChild[];
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
          {props.tabs &&
            props.tabs.map(tab => {
              if ((props.usesRouter || hasHistory) && !!tab.usesRouter) {
                return (
                  <li
                    className={tab.name === props.activeChild ? 'active' : ''}
                    key={`${tab.label}`}
                  >
                    <div>
                      <Link to={tab.url || ''}>{tab.label}</Link>
                    </div>
                  </li>
                );
              }

              return (
                <li
                  className={cx('no-router', {
                    active: tab.name === props.activeChild,
                  })}
                  key={`${tab.label}`}
                >
                  <a href={tab.url} onClick={tab.onClick}>
                    {tab.label}
                  </a>
                </li>
              );
            })}
        </Nav>
        <Nav className="navbar-right">
          {props.buttons?.map((btn, i) => (
            <Button
              key={`${i}`}
              buttonStyle={btn.buttonStyle}
              onClick={btn.onClick}
              data-test={btn['data-test']}
            >
              {btn.name}
            </Button>
          ))}
        </Nav>
      </Navbar>
      {props.children}
    </StyledHeader>
  );
};

export default SubMenu;
