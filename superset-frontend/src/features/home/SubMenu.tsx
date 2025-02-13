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
import { ReactNode, useState, useEffect, FunctionComponent } from 'react';

import { Link, useHistory } from 'react-router-dom';
import { styled, SupersetTheme, css, t } from '@superset-ui/core';
import cx from 'classnames';
import { Tooltip } from 'src/components/Tooltip';
import { debounce } from 'lodash';
import { Row } from 'src/components';
import { Menu, MenuMode, MainNav } from 'src/components/Menu';
import Button, { OnClickHandler } from 'src/components/Button';
import Icons from 'src/components/Icons';
import { MenuObjectProps } from 'src/types/bootstrapTypes';

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
    ul.antd5-menu-root {
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
    background-color: ${({ theme }) => theme.colors.grayscale.light5};
  }

  .menu > .antd5-menu {
    padding: ${({ theme }) => theme.gridUnit * 5}px
      ${({ theme }) => theme.gridUnit * 8}px;

    .antd5-menu-item {
      border-radius: ${({ theme }) => theme.borderRadius}px;
      font-size: ${({ theme }) => theme.typography.sizes.s}px;
      padding: ${({ theme }) => theme.gridUnit}px
        ${({ theme }) => theme.gridUnit * 4}px;
      margin-right: ${({ theme }) => theme.gridUnit}px;
    }
    .antd5-menu-item:hover,
    .antd5-menu-item:has(> span > .active) {
      background-color: ${({ theme }) => theme.colors.secondary.light4};
    }
  }

  .btn-link {
    padding: 10px 0;
  }
  @media (max-width: 767px) {
    .header,
    .nav-right {
      position: relative;
      margin-left: ${({ theme }) => theme.gridUnit * 2}px;
    }
  }
`;

const styledDisabled = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light1};
  cursor: not-allowed;

  &:hover {
    color: ${theme.colors.grayscale.light1};
  }

  .antd5-menu-item-selected {
    background-color: ${theme.colors.grayscale.light1};
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
  onClick?: OnClickHandler;
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

const { SubMenu } = MainNav;

const SubMenuComponent: FunctionComponent<SubMenuProps> = props => {
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
        <Menu mode={showMenu} disabledOverflow>
          {props.tabs?.map(tab => {
            if ((props.usesRouter || hasHistory) && !!tab.usesRouter) {
              return (
                <Menu.Item key={tab.label}>
                  <div
                    role="tab"
                    data-test={tab['data-test']}
                    className={tab.name === props.activeChild ? 'active' : ''}
                  >
                    <div>
                      <Link to={tab.url || ''}>{tab.label}</Link>
                    </div>
                  </div>
                </Menu.Item>
              );
            }

            return (
              <Menu.Item key={tab.label}>
                <div
                  className={cx('no-router', {
                    active: tab.name === props.activeChild,
                  })}
                  role="tab"
                >
                  <a href={tab.url} onClick={tab.onClick}>
                    {tab.label}
                  </a>
                </div>
              </Menu.Item>
            );
          })}
        </Menu>
        <div className={navRightStyle}>
          <Menu mode="horizontal" triggerSubMenuAction="click" disabledOverflow>
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
                    return item.disable ? (
                      <MainNav.Item
                        key={item.label}
                        css={styledDisabled}
                        disabled
                      >
                        <Tooltip
                          placement="top"
                          title={t(
                            "Enable 'Allow file uploads to database' in any database's settings",
                          )}
                        >
                          {item.label}
                        </Tooltip>
                      </MainNav.Item>
                    ) : (
                      <MainNav.Item key={item.label}>
                        <a href={item.url} onClick={item.onClick}>
                          {item.label}
                        </a>
                      </MainNav.Item>
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
