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
import React, { ReactNode, useState, useEffect } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { styled } from '@superset-ui/core';
import cx from 'classnames';
import { debounce } from 'lodash';
import { Row } from 'src/components';
import { Menu, MenuMode, MainNav as DropdownMenu } from 'src/components/Menu';
import Button, { OnClickHandler } from 'src/components/Button';
import Icons from 'src/components/Icons';
import { MenuObjectProps } from './Menu';

const StyledHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  .header {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    margin-right: ${({ theme }) => theme.gridUnit * 3}px;
    text-align: left;
    font-size: 18px;
    padding: ${({ theme }) => theme.gridUnit * 3}px;
    display: inline-block;
    line-height: ${({ theme }) => theme.gridUnit * 9}px;
  }
  .nav-right {
    display: flex;
    align-items: center;
    padding: ${({ theme }) => theme.gridUnit * 3.5}px 0;
    margin-right: ${({ theme }) => theme.gridUnit * 3}px;
    float: right;
    position: absolute;
    right: 0;
    ul.ant-menu-root {
      padding: 0px;
    }
    li[role='menuitem'] {
      border: 0;
      border-bottom: none;
      &:hover {
        border-bottom: transparent;
      }
    }
  }
  .nav-right-collapse {
    display: flex;
    align-items: center;
    padding: 14px 0;
    margin-right: 0;
    float: left;
    padding-left: 10px;
  }
  .menu {
    background-color: white;
    .ant-menu-horizontal {
      line-height: inherit;
      .ant-menu-item {
        border-bottom: none;
        &:hover {
          border-bottom: none;
          text-decoration: none;
        }
      }
    }
    .ant-menu {
      padding: ${({ theme }) => theme.gridUnit * 4}px 0px;
    }
  }

  .ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item {
    margin: 0 ${({ theme }) => theme.gridUnit + 1}px;
  }

  .menu .ant-menu-item {
    li {
      a,
      div {
        font-size: ${({ theme }) => theme.typography.sizes.s}px;
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
      text-decoration: none;
    }
  }

  .btn-link {
    padding: 10px 0;
  }
  .ant-menu-horizontal {
    border: none;
  }
  @media (max-width: 767px) {
    .header,
    .nav-right {
      position: relative;
      margin-left: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }
  .ant-menu-submenu {
    span[role='img'] {
      position: absolute;
      right: ${({ theme }) => -theme.gridUnit + -2}px;
      top: ${({ theme }) => theme.gridUnit + 1}px !important;
    }
  }
  .dropdown-menu-links > div.ant-menu-submenu-title,
  .ant-menu-submenu-open.ant-menu-submenu-active > div.ant-menu-submenu-title {
    color: ${({ theme }) => theme.colors.primary.dark1};
  }
`;

type MenuChild = {
  label: string;
  name: string;
  url?: string;
  usesRouter?: boolean;
  onClick?: () => void;
  'data-test'?: string;
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
  color?: string;
  dropDownLinks?: Array<MenuObjectProps>;
}

const { SubMenu } = DropdownMenu;

const SubMenuComponent: React.FunctionComponent<SubMenuProps> = props => {
  const [showMenu, setMenu] = useState<MenuMode>('horizontal');
  const [navRightStyle, setNavRightStyle] = useState('nav-right');

  let hasHistory = true;
  // If no parent <Router> component exists, useHistory throws an error
  try {
    useHistory();
  } catch (err) {
    // If error is thrown, we know not to use <Link> in render
    hasHistory = false;
  }

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth <= 767) setMenu('inline');
      else setMenu('horizontal');

      if (
        props.buttons &&
        props.buttons.length >= 3 &&
        window.innerWidth >= 795
      ) {
        // eslint-disable-next-line no-unused-expressions
        setNavRightStyle('nav-right');
      } else if (
        props.buttons &&
        props.buttons.length >= 3 &&
        window.innerWidth <= 795
      ) {
        setNavRightStyle('nav-right-collapse');
      }
    }
    handleResize();
    const resize = debounce(handleResize, 10);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [props.buttons]);

  return (
    <StyledHeader>
      <Row className="menu" role="navigation">
        {props.name && <div className="header">{props.name}</div>}
        <Menu mode={showMenu} style={{ backgroundColor: 'transparent' }}>
          {props.tabs?.map(tab => {
            if ((props.usesRouter || hasHistory) && !!tab.usesRouter) {
              return (
                <Menu.Item key={tab.label}>
                  <li
                    role="tab"
                    data-test={tab['data-test']}
                    className={tab.name === props.activeChild ? 'active' : ''}
                  >
                    <div>
                      <Link to={tab.url || ''}>{tab.label}</Link>
                    </div>
                  </li>
                </Menu.Item>
              );
            }

            return (
              <Menu.Item key={tab.label}>
                <li
                  className={cx('no-router', {
                    active: tab.name === props.activeChild,
                  })}
                  role="tab"
                >
                  <a href={tab.url} onClick={tab.onClick}>
                    {tab.label}
                  </a>
                </li>
              </Menu.Item>
            );
          })}
        </Menu>
        <div className={navRightStyle}>
          <Menu mode="horizontal" triggerSubMenuAction="click">
            {props.dropDownLinks?.map((link, i) => (
              <SubMenu
                key={i}
                title={link.label}
                icon={<Icons.TriangleDown />}
                popupOffset={[10, 20]}
                className="dropdown-menu-links"
              >
                {link.childs?.map(item => {
                  if (typeof item === 'object') {
                    return (
                      <DropdownMenu.Item key={item.label}>
                        <a href={item.url}>{item.label}</a>
                      </DropdownMenu.Item>
                    );
                  }
                  return null;
                })}
              </SubMenu>
            ))}
          </Menu>
          {props.buttons?.map((btn, i) => (
            <Button
              key={i}
              buttonStyle={btn.buttonStyle}
              onClick={btn.onClick}
              data-test={btn['data-test']}
            >
              {btn.name}
            </Button>
          ))}
        </div>
      </Row>
      {props.children}
    </StyledHeader>
  );
};

export default SubMenuComponent;
