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
import { styled, SupersetTheme, css, t, useTheme } from '@superset-ui/core';
import cx from 'classnames';
import { debounce } from 'lodash';
import { Menu, MenuMode, MainNav } from '@superset-ui/core/components/Menu';
import {
  Button,
  Tooltip,
  Row,
  type OnClickHandler,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { IconType } from '@superset-ui/core/components/Icons/types';
import { MenuObjectProps } from 'src/types/bootstrapTypes';
import { Typography } from '@superset-ui/core/components/Typography';

const StyledHeader = styled.div<{ backgroundColor?: string }>`
  background-color: ${({ theme, backgroundColor }) =>
    backgroundColor || theme.colorBgContainer};
  align-items: center;
  position: relative;
  padding: ${({ theme }) => theme.sizeUnit * 2}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
  .header {
    font-weight: ${({ theme }) => theme.fontWeightStrong};
    margin-right: ${({ theme }) => theme.sizeUnit * 3}px;
    text-align: left;
    font-size: 18px;
    display: inline-block;
    line-height: ${({ theme }) => theme.sizeUnit * 9}px;
  }
  .nav-right {
    display: flex;
    align-items: center;
    /* margin-right: ${({ theme }) => theme.sizeUnit * 3}px; */
    float: right;
    position: absolute;
    right: ${({ theme }) => theme.sizeUnit * 4}px;
    ul.ant-menu-root {
      padding: 0px;
    }
    .ant-row {
      align-items: center;
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
    align-items: center;
  }

  .menu > .ant-menu {
    padding-left: ${({ theme }) => theme.sizeUnit * 5}px;
    line-height: ${({ theme }) => theme.sizeUnit * 5}px;

    .ant-menu-item {
      border-radius: ${({ theme }) => theme.borderRadius}px;
      font-size: ${({ theme }) => theme.fontSizeSM}px;
      padding: ${({ theme }) => theme.sizeUnit}px
        ${({ theme }) => theme.sizeUnit * 4}px;
      margin-right: ${({ theme }) => theme.sizeUnit}px;
    }
    .ant-menu-item:hover,
    .ant-menu-item:has(> span > .active) {
      background-color: ${({ theme }) => theme.colorPrimaryBgHover};
      color: ${({ theme }) => theme.colorText};
    }
  }

  .btn-link {
    padding: 10px 0;
  }
  @media (max-width: 767px) {
    .header,
    .nav-right {
      position: relative;
      margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
    }
  }
`;

const styledDisabled = (theme: SupersetTheme) => css`
  color: ${theme.colorTextDisabled};
  cursor: not-allowed;

  &:hover {
    color: ${theme.colorTextDisabled};
  }

  .ant-menu-item-selected {
    background-color: ${theme.colorBgContainerDisabled};
  }
`;

type MenuChild = {
  label: string;
  name: string;
  url?: string;
  usesRouter?: boolean;
  onClick?: () => void;
  'data-test'?: string;
  id?: string;
  'aria-controls'?: string;
};

export interface ButtonProps {
  name: ReactNode;
  onClick?: OnClickHandler;
  'data-test'?: string;
  buttonStyle: 'primary' | 'secondary' | 'dashed' | 'link' | 'tertiary';
  loading?: boolean;
  icon?: IconType;
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
  backgroundColor?: string;
}

const { SubMenu } = MainNav;

const SubMenuComponent: FunctionComponent<SubMenuProps> = props => {
  const [showMenu, setMenu] = useState<MenuMode>('horizontal');
  const [navRightStyle, setNavRightStyle] = useState('nav-right');
  const theme = useTheme();

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
    <StyledHeader backgroundColor={props.backgroundColor}>
      <Row className="menu" role="navigation">
        {props.name && <div className="header">{props.name}</div>}
        <Menu
          mode={showMenu}
          disabledOverflow
          role="tablist"
          items={props.tabs?.map(tab => {
            if ((props.usesRouter || hasHistory) && !!tab.usesRouter) {
              return {
                key: tab.label,
                label: (
                  <Link
                    to={tab.url || ''}
                    role="tab"
                    id={tab.id || tab.name}
                    data-test={tab['data-test']}
                    aria-selected={tab.name === props.activeChild}
                    aria-controls={tab['aria-controls'] || ''}
                    className={tab.name === props.activeChild ? 'active' : ''}
                  >
                    {tab.label}
                  </Link>
                ),
              };
            }
            return {
              key: tab.label,
              label: (
                <div
                  className={cx('no-router', {
                    active: tab.name === props.activeChild,
                  })}
                  role="tab"
                  aria-selected={tab.name === props.activeChild}
                >
                  <Typography.Link href={tab.url} onClick={tab.onClick}>
                    {tab.label}
                  </Typography.Link>
                </div>
              ),
            };
          })}
        />
        <div className={navRightStyle}>
          <Menu mode="horizontal" triggerSubMenuAction="click" disabledOverflow>
            {props.dropDownLinks?.map((link, i) => (
              <SubMenu
                css={css`
                  [data-icon='caret-down'] {
                    color: ${theme.colorIcon};
                    font-size: ${theme.fontSizeXS}px;
                    margin-left: ${theme.sizeUnit}px;
                  }
                `}
                key={i}
                title={link.label}
                icon={<Icons.CaretDownOutlined />}
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
                        <Typography.Link href={item.url} onClick={item.onClick}>
                          {item.label}
                        </Typography.Link>
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
              icon={btn.icon}
              onClick={btn.onClick}
              data-test={btn['data-test']}
              loading={btn.loading ?? false}
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
