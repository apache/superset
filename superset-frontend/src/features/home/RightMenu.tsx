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
import { useState, useEffect, FC, PureComponent, useMemo } from 'react';
import rison from 'rison';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useQueryParams, BooleanParam } from 'use-query-params';
import { isEmpty } from 'lodash';
import {
  t,
  styled,
  css,
  SupersetTheme,
  SupersetClient,
  getExtensionsRegistry,
  useTheme,
} from '@superset-ui/core';
import {
  Tag,
  Tooltip,
  Menu,
  Icons,
  Typography,
  TelemetryPixel,
} from '@superset-ui/core/components';
import type { ItemType, MenuItem } from '@superset-ui/core/components/Menu';
import { ensureAppRoot } from 'src/utils/pathUtils';
import { findPermission } from 'src/utils/findPermission';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import {
  MenuObjectProps,
  UserWithPermissionsAndRoles,
  MenuObjectChildProps,
} from 'src/types/bootstrapTypes';
import { RootState } from 'src/dashboard/types';
import DatabaseModal from 'src/features/databases/DatabaseModal';
import UploadDataModal from 'src/features/databases/UploadDataModel';
import { uploadUserPerms } from 'src/views/CRUD/utils';
import { useThemeContext } from 'src/theme/ThemeProvider';
import { useThemeMenuItems } from 'src/hooks/useThemeMenuItems';
import { useLanguageMenuItems } from './LanguagePicker';
import {
  ExtensionConfigs,
  GlobalMenuDataOptions,
  RightMenuProps,
} from './types';
import { NAVBAR_MENU_POPUP_OFFSET } from './commonMenuData';

const extensionsRegistry = getExtensionsRegistry();

const StyledDiv = styled.div<{ align: string }>`
  display: flex;
  height: 100%;
  flex-direction: row;
  justify-content: ${({ align }) => align};
  align-items: center;
`;

const StyledMenuItemWithIcon = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const StyledAnchor = styled.a`
  padding-right: ${({ theme }) => theme.sizeUnit}px;
  padding-left: ${({ theme }) => theme.sizeUnit}px;
`;

const StyledMenuItem = styled.div<{ disabled?: boolean }>`
  ${({ theme, disabled }) => css`
    &&:hover {
      color: ${!disabled && theme.colorPrimary};
      cursor: ${!disabled ? 'pointer' : 'not-allowed'};
    }
    ${disabled &&
    css`
      color: ${theme.colorTextDisabled};
    `}
  `}
`;

const RightMenu = ({
  align,
  settings,
  navbarRight,
  isFrontendRoute,
  environmentTag,
  setQuery,
}: RightMenuProps & {
  setQuery: ({
    databaseAdded,
    datasetAdded,
  }: {
    databaseAdded?: boolean;
    datasetAdded?: boolean;
  }) => void;
}) => {
  const theme = useTheme();
  const user = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const dashboardId = useSelector<RootState, number | undefined>(
    state => state.dashboardInfo?.id,
  );
  const userValues = user || {};
  const { roles } = userValues;
  const {
    CSV_EXTENSIONS,
    COLUMNAR_EXTENSIONS,
    EXCEL_EXTENSIONS,
    ALLOWED_EXTENSIONS,
    HAS_GSHEETS_INSTALLED,
  } = useSelector<any, ExtensionConfigs>(state => state.common.conf);
  const [showDatabaseModal, setShowDatabaseModal] = useState<boolean>(false);
  const [showCSVUploadModal, setShowCSVUploadModal] = useState<boolean>(false);
  const [showExcelUploadModal, setShowExcelUploadModal] =
    useState<boolean>(false);
  const [showColumnarUploadModal, setShowColumnarUploadModal] =
    useState<boolean>(false);
  const [engine, setEngine] = useState<string>('');
  const canSql = findPermission('can_sqllab', 'Superset', roles);
  const canDashboard = findPermission('can_write', 'Dashboard', roles);
  const canChart = findPermission('can_write', 'Chart', roles);
  const canDatabase = findPermission('can_write', 'Database', roles);
  const canDataset = findPermission('can_write', 'Dataset', roles);

  const { canUploadData, canUploadCSV, canUploadColumnar, canUploadExcel } =
    uploadUserPerms(
      roles,
      CSV_EXTENSIONS,
      COLUMNAR_EXTENSIONS,
      EXCEL_EXTENSIONS,
      ALLOWED_EXTENSIONS,
    );

  const showActionDropdown = canSql || canChart || canDashboard;
  const [allowUploads, setAllowUploads] = useState<boolean>(false);
  const [nonExamplesDBConnected, setNonExamplesDBConnected] =
    useState<boolean>(false);
  const isAdmin = isUserAdmin(user);
  const showUploads = allowUploads || isAdmin;
  const {
    setThemeMode,
    themeMode,
    clearLocalOverrides,
    hasDevOverride,
    canSetMode,
    canDetectOSPreference,
  } = useThemeContext();
  const dropdownItems: MenuObjectProps[] = [
    {
      label: t('Data'),
      icon: <Icons.DatabaseOutlined data-test={`menu-item-${t('Data')}`} />,
      childs: [
        {
          label: t('Connect database'),
          name: GlobalMenuDataOptions.DbConnection,
          perm: canDatabase && !nonExamplesDBConnected,
        },
        {
          label: t('Create dataset'),
          name: GlobalMenuDataOptions.DatasetCreation,
          url: '/dataset/add/',
          perm: canDataset && nonExamplesDBConnected,
        },
        {
          label: t('Connect Google Sheet'),
          name: GlobalMenuDataOptions.GoogleSheets,
          perm: canDatabase && HAS_GSHEETS_INSTALLED,
        },
        {
          label: t('Upload CSV to database'),
          name: GlobalMenuDataOptions.CSVUpload,
          perm: canUploadCSV && showUploads,
          disable: isAdmin && !allowUploads,
        },
        {
          label: t('Upload Excel to database'),
          name: GlobalMenuDataOptions.ExcelUpload,
          perm: canUploadExcel && showUploads,
          disable: isAdmin && !allowUploads,
        },
        {
          label: t('Upload Columnar file to database'),
          name: GlobalMenuDataOptions.ColumnarUpload,
          perm: canUploadColumnar && showUploads,
          disable: isAdmin && !allowUploads,
        },
      ],
    },
    {
      label: t('SQL query'),
      url: '/sqllab?new=true',
      icon: <Icons.SearchOutlined data-test={`menu-item-${t('SQL query')}`} />,
      perm: 'can_sqllab',
      view: 'Superset',
    },
    {
      label: t('Chart'),
      url: Number.isInteger(dashboardId)
        ? `/chart/add?dashboard_id=${dashboardId}`
        : '/chart/add',
      icon: <Icons.BarChartOutlined data-test={`menu-item-${t('Chart')}`} />,
      perm: 'can_write',
      view: 'Chart',
    },
    {
      label: t('Dashboard'),
      url: '/dashboard/new',
      icon: (
        <Icons.DashboardOutlined data-test={`menu-item-${t('Dashboard')}`} />
      ),
      perm: 'can_write',
      view: 'Dashboard',
    },
  ];

  const checkAllowUploads = () => {
    const payload = {
      filters: [
        { col: 'allow_file_upload', opr: 'upload_is_enabled', value: true },
      ],
    };
    SupersetClient.get({
      endpoint: `/api/v1/database/?q=${rison.encode(payload)}`,
    }).then(({ json }: Record<string, any>) => {
      // There might be some existing Gsheets and Clickhouse DBs
      // with allow_file_upload set as True which is not possible from now on
      const allowedDatabasesWithFileUpload =
        json?.result?.filter(
          (database: any) => database?.engine_information?.supports_file_upload,
        ) || [];
      setAllowUploads(allowedDatabasesWithFileUpload?.length >= 1);
    });
  };

  const existsNonExamplesDatabases = () => {
    const payload = {
      filters: [{ col: 'database_name', opr: 'neq', value: 'examples' }],
    };
    SupersetClient.get({
      endpoint: `/api/v1/database/?q=${rison.encode(payload)}`,
    }).then(({ json }: Record<string, any>) => {
      setNonExamplesDBConnected(json.count >= 1);
    });
  };

  useEffect(() => {
    if (canUploadData) {
      checkAllowUploads();
    }
  }, [canUploadData]);

  useEffect(() => {
    if (canDatabase || canDataset) {
      existsNonExamplesDatabases();
    }
  }, [canDatabase, canDataset]);

  const handleMenuSelection = (itemChose: any) => {
    if (itemChose.key === GlobalMenuDataOptions.DbConnection) {
      setShowDatabaseModal(true);
    } else if (itemChose.key === GlobalMenuDataOptions.GoogleSheets) {
      setShowDatabaseModal(true);
      setEngine('Google Sheets');
    } else if (itemChose.key === GlobalMenuDataOptions.CSVUpload) {
      setShowCSVUploadModal(true);
    } else if (itemChose.key === GlobalMenuDataOptions.ExcelUpload) {
      setShowExcelUploadModal(true);
    } else if (itemChose.key === GlobalMenuDataOptions.ColumnarUpload) {
      setShowColumnarUploadModal(true);
    }
  };

  const handleOnHideModal = () => {
    setEngine('');
    setShowDatabaseModal(false);
  };

  const tooltipText = t(
    "Enable 'Allow file uploads to database' in any database's settings",
  );

  const buildMenuItem = (item: MenuObjectChildProps): MenuItem => ({
    key: item.name || item.label,
    label: item.disable ? (
      <StyledMenuItem disabled>
        <Tooltip placement="top" title={tooltipText}>
          {item.label}
        </Tooltip>
      </StyledMenuItem>
    ) : item.url ? (
      <Typography.Link href={ensureAppRoot(item.url)}>
        {item.label}
      </Typography.Link>
    ) : (
      item.label
    ),
    disabled: item.disable,
  });

  const onMenuOpen = (openKeys: string[]) => {
    // We should query the API only if opening Data submenus
    // because the rest don't need this information. Not using
    // "Data" directly since we might change the label later on?
    if (
      openKeys.length > 1 &&
      !isEmpty(
        openKeys?.filter((key: string) =>
          key.includes(`sub2_${dropdownItems?.[0]?.label}`),
        ),
      )
    ) {
      if (canUploadData) checkAllowUploads();
      if (canDatabase || canDataset) existsNonExamplesDatabases();
    }
    return null;
  };
  const RightMenuExtension = extensionsRegistry.get('navbar.right');
  const RightMenuItemIconExtension = extensionsRegistry.get(
    'navbar.right-menu.item.icon',
  );

  const handleDatabaseAdd = () => setQuery({ databaseAdded: true });

  const handleLogout = () => {
    localStorage.removeItem('redux');
  };

  // Use the theme menu hook
  const themeMenuItem = useThemeMenuItems({
    setThemeMode,
    themeMode,
    hasLocalOverride: hasDevOverride(),
    onClearLocalSettings: clearLocalOverrides,
    allowOSPreference: canDetectOSPreference(),
  });

  const languageMenuItem = useLanguageMenuItems({
    locale: navbarRight.locale || 'en',
    languages: navbarRight.languages || {},
  });

  // Build main menu items
  const menuItems = useMemo(() => {
    // Build menu items for the new dropdown
    const buildNewDropdownItems = (): MenuItem[] => {
      const items: MenuItem[] = [];

      dropdownItems?.forEach(menu => {
        const canShowChild = menu.childs?.some(
          item => typeof item === 'object' && !!item.perm,
        );

        if (menu.childs) {
          if (canShowChild) {
            const childItems: MenuItem[] = [];
            menu.childs.forEach((item, idx) => {
              if (typeof item !== 'string' && item.name && item.perm) {
                if (idx === 3) {
                  childItems.push({ type: 'divider', key: `divider-${idx}` });
                }
                childItems.push(buildMenuItem(item));
              }
            });

            items.push({
              key: `sub2_${menu.label}`,
              label: menu.label,
              icon: menu.icon,
              children: childItems,
              popupOffset: NAVBAR_MENU_POPUP_OFFSET,
            });
          } else if (menu.url) {
            if (
              findPermission(menu.perm as string, menu.view as string, roles)
            ) {
              items.push({
                key: menu.label,
                label: isFrontendRoute(menu.url) ? (
                  <Link to={menu.url || ''}>
                    {menu.icon} {menu.label}
                  </Link>
                ) : (
                  <Typography.Link href={ensureAppRoot(menu.url || '')}>
                    {menu.icon} {menu.label}
                  </Typography.Link>
                ),
              });
            }
          }
        } else if (
          findPermission(menu.perm as string, menu.view as string, roles)
        ) {
          items.push({
            key: menu.label,
            label: isFrontendRoute(menu.url) ? (
              <Link to={menu.url || ''}>
                {menu.icon} {menu.label}
              </Link>
            ) : (
              <Typography.Link href={ensureAppRoot(menu.url || '')}>
                {menu.icon} {menu.label}
              </Typography.Link>
            ),
          });
        }
      });

      return items;
    };

    // Build settings menu items
    const buildSettingsMenuItems = (): MenuItem[] => {
      const items: MenuItem[] = [];

      settings?.forEach((section, index) => {
        const sectionItems: MenuItem[] = [];

        section.childs?.forEach(child => {
          if (typeof child !== 'string') {
            const menuItemDisplay = RightMenuItemIconExtension ? (
              <StyledMenuItemWithIcon>
                {child.label}
                <RightMenuItemIconExtension menuChild={child} />
              </StyledMenuItemWithIcon>
            ) : (
              child.label
            );

            sectionItems.push({
              key: child.label,
              label: isFrontendRoute(child.url) ? (
                <Link to={child.url || ''}>{menuItemDisplay}</Link>
              ) : (
                <Typography.Link
                  href={child.url || ''}
                  css={css`
                    display: flex;
                    align-items: center;
                    line-height: ${theme.sizeUnit * 10}px;
                  `}
                >
                  {menuItemDisplay}
                </Typography.Link>
              ),
            });
          }
        });

        items.push({
          type: 'group',
          label: section.label,
          key: section.label,
          children: sectionItems,
        });

        if (index < settings.length - 1) {
          items.push({ type: 'divider', key: `divider_${index}` });
        }
      });

      if (!navbarRight.user_is_anonymous) {
        items.push({ type: 'divider', key: 'user-divider' });

        const userItems: MenuItem[] = [];
        if (navbarRight.user_info_url) {
          userItems.push({
            key: 'info',
            label: (
              <Typography.Link href={navbarRight.user_info_url}>
                {t('Info')}
              </Typography.Link>
            ),
          });
        }
        userItems.push({
          key: 'logout',
          label: (
            <Typography.Link href={navbarRight.user_logout_url}>
              {t('Logout')}
            </Typography.Link>
          ),
          onClick: handleLogout,
        });

        items.push({
          type: 'group',
          label: t('User'),
          key: 'user-section',
          children: userItems,
        });
      }

      if (navbarRight.version_string || navbarRight.version_sha) {
        items.push({ type: 'divider', key: 'version-info-divider' });

        const aboutItem: ItemType = {
          type: 'group',
          label: t('About'),
          key: 'about-section',
          children: [
            {
              key: 'about-info',
              style: { height: 'auto', minHeight: 'auto' },
              label: (
                <div
                  css={(theme: SupersetTheme) => css`
                    font-size: ${theme.fontSizeSM}px;
                    color: ${theme.colorTextSecondary || theme.colorText};
                    white-space: pre-wrap;
                    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
                  `}
                >
                  {[
                    navbarRight.show_watermark &&
                      t('Powered by Apache Superset'),
                    navbarRight.version_string &&
                      `${t('Version')}: ${navbarRight.version_string}`,
                    navbarRight.version_sha &&
                      `${t('SHA')}: ${navbarRight.version_sha}`,
                    navbarRight.build_number &&
                      `${t('Build')}: ${navbarRight.build_number}`,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </div>
              ),
            },
          ],
        };
        items.push(aboutItem);
      }
      return items;
    };

    const items: MenuItem[] = [];

    if (RightMenuExtension) {
      items.push({
        key: 'extension',
        label: <RightMenuExtension />,
      });
    }

    if (!navbarRight.user_is_anonymous && showActionDropdown) {
      items.push({
        key: 'new-dropdown',
        label: <Icons.PlusOutlined data-test="new-dropdown-icon" />,
        className: 'submenu-with-caret',
        icon: <Icons.DownOutlined iconSize="xs" />,
        children: buildNewDropdownItems(),
        popupOffset: NAVBAR_MENU_POPUP_OFFSET,
        ...{ 'data-test': 'new-dropdown' },
      });
    }

    if (canSetMode()) {
      items.push(themeMenuItem);
    }

    if (navbarRight.show_language_picker && languageMenuItem) {
      items.push(languageMenuItem);
    }

    items.push({
      key: 'settings',
      label: t('Settings'),
      icon: <Icons.DownOutlined iconSize="xs" />,
      children: buildSettingsMenuItems(),
      className: 'submenu-with-caret',
      popupOffset: NAVBAR_MENU_POPUP_OFFSET,
    });

    return items;
  }, [
    RightMenuExtension,
    navbarRight,
    showActionDropdown,
    canSetMode,
    theme.colorPrimary,
    themeMenuItem,
    languageMenuItem,
    dropdownItems,
    roles,
    settings,
    RightMenuItemIconExtension,
    buildMenuItem,
    handleLogout,
  ]);

  return (
    <StyledDiv align={align}>
      {canDatabase && (
        <DatabaseModal
          onHide={handleOnHideModal}
          show={showDatabaseModal}
          dbEngine={engine}
          onDatabaseAdd={handleDatabaseAdd}
        />
      )}
      {canUploadCSV && (
        <UploadDataModal
          onHide={() => setShowCSVUploadModal(false)}
          show={showCSVUploadModal}
          allowedExtensions={CSV_EXTENSIONS}
          type="csv"
        />
      )}
      {canUploadExcel && (
        <UploadDataModal
          onHide={() => setShowExcelUploadModal(false)}
          show={showExcelUploadModal}
          allowedExtensions={EXCEL_EXTENSIONS}
          type="excel"
        />
      )}
      {canUploadColumnar && (
        <UploadDataModal
          onHide={() => setShowColumnarUploadModal(false)}
          show={showColumnarUploadModal}
          allowedExtensions={COLUMNAR_EXTENSIONS}
          type="columnar"
        />
      )}
      {environmentTag?.text &&
        (() => {
          // Map color values to Ant Design semantic colors
          const validAntDesignColors = [
            'error',
            'warning',
            'success',
            'processing',
            'default',
          ];

          const tagColor = validAntDesignColors.includes(environmentTag.color)
            ? environmentTag.color
            : 'default';

          return (
            <Tag
              color={tagColor}
              css={css`
                border-radius: ${theme.sizeUnit * 125}px;
              `}
            >
              {environmentTag.text}
            </Tag>
          );
        })()}
      <Menu
        css={css`
          display: flex;
          flex-direction: row;
          align-items: center;
          height: 100%;
          border-bottom: none !important;

          /* Remove the underline from menu items */
          .ant-menu-item:after,
          .ant-menu-submenu:after {
            content: none !important;
          }

          .submenu-with-caret {
            height: 100%;
            padding: 0;
            .ant-menu-submenu-title {
              align-items: center;
              display: flex;
              gap: ${theme.sizeUnit * 2}px;
              flex-direction: row-reverse;
              height: 100%;
            }
            &.ant-menu-submenu::after {
              inset-inline: ${theme.sizeUnit}px;
            }
            &.ant-menu-submenu:hover,
            &.ant-menu-submenu-active {
              .ant-menu-title-content {
                color: ${theme.colorPrimary};
              }
            }
          }
        `}
        selectable={false}
        mode="horizontal"
        onClick={handleMenuSelection}
        onOpenChange={onMenuOpen}
        disabledOverflow
        items={menuItems}
      />
      {navbarRight.documentation_url && (
        <>
          <StyledAnchor
            href={navbarRight.documentation_url}
            target="_blank"
            rel="noreferrer"
            title={navbarRight.documentation_text || t('Documentation')}
          >
            {navbarRight.documentation_icon ? (
              <Icons.BookOutlined />
            ) : (
              <Icons.QuestionCircleOutlined />
            )}
          </StyledAnchor>
          <span>&nbsp;</span>
        </>
      )}
      {navbarRight.bug_report_url && (
        <>
          <StyledAnchor
            href={navbarRight.bug_report_url}
            target="_blank"
            rel="noreferrer"
            title={navbarRight.bug_report_text || t('Report a bug')}
          >
            {navbarRight.bug_report_icon ? (
              <i className={navbarRight.bug_report_icon} />
            ) : (
              <Icons.BugOutlined />
            )}
          </StyledAnchor>
          <span>&nbsp;</span>
        </>
      )}
      {navbarRight.user_is_anonymous && (
        <StyledAnchor href={navbarRight.user_login_url}>
          <Icons.LoginOutlined /> {t('Login')}
        </StyledAnchor>
      )}
      <TelemetryPixel
        version={navbarRight.version_string}
        sha={navbarRight.version_sha}
        build={navbarRight.build_number}
      />
    </StyledDiv>
  );
};

const RightMenuWithQueryWrapper: FC<RightMenuProps> = props => {
  const [, setQuery] = useQueryParams({
    databaseAdded: BooleanParam,
    datasetAdded: BooleanParam,
  });

  return <RightMenu setQuery={setQuery} {...props} />;
};

// Query param manipulation requires that, during the setup, the
// QueryParamProvider is present and configured.
// Superset still has multiple entry points, and not all of them have
// the same setup, and critically, not all of them have the QueryParamProvider.
// This wrapper ensures the RightMenu renders regardless of the provider being present.
class RightMenuErrorWrapper extends PureComponent<RightMenuProps> {
  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  noop = () => {};

  render() {
    if (this.state.hasError) {
      return <RightMenu setQuery={this.noop} {...this.props} />;
    }

    return this.props.children;
  }
}

const RightMenuWrapper: FC<RightMenuProps> = props => (
  <RightMenuErrorWrapper {...props}>
    <RightMenuWithQueryWrapper {...props} />
  </RightMenuErrorWrapper>
);

export default RightMenuWrapper;
