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
import { Fragment, useState, useEffect, FC, PureComponent } from 'react';

import rison from 'rison';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useQueryParams, BooleanParam } from 'use-query-params';
import { get, isEmpty } from 'lodash';

import {
  t,
  styled,
  css,
  SupersetTheme,
  SupersetClient,
  getExtensionsRegistry,
  useTheme,
} from '@superset-ui/core';
import { Menu } from '@superset-ui/core/components/Menu';
import { Label, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';
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
import TelemetryPixel from '@superset-ui/core/components/TelemetryPixel';
import { useThemeContext } from 'src/theme/ThemeProvider';
import ThemeSelect from '@superset-ui/core/components/ThemeSelect';
import LanguagePicker from './LanguagePicker';
import {
  ExtensionConfigs,
  GlobalMenuDataOptions,
  RightMenuProps,
} from './types';

const extensionsRegistry = getExtensionsRegistry();

const versionInfoStyles = (theme: SupersetTheme) => css`
  padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 4}px
    ${theme.sizeUnit * 4}px ${theme.sizeUnit * 7}px;
  color: ${theme.colors.grayscale.base};
  font-size: ${theme.fontSizeXS}px;
  white-space: nowrap;
`;

const styledDisabled = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light1};
`;

const StyledDiv = styled.div<{ align: string }>`
  display: flex;
  height: 100%;
  flex-direction: row;
  justify-content: ${({ align }) => align};
  align-items: center;
  margin-right: ${({ theme }) => theme.sizeUnit}px;
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

const tagStyles = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light5};
`;

const styledChildMenu = (theme: SupersetTheme) => css`
  &:hover {
    color: ${theme.colorPrimary} !important;
    cursor: pointer !important;
  }
`;

const { SubMenu } = Menu;

const StyledSubMenu = styled(SubMenu)`
  ${({ theme }) => css`
    [data-icon='caret-down'] {
      color: ${theme.colorIcon};
      font-size: ${theme.fontSizeXS}px;
      margin-left: ${theme.sizeUnit}px;
    }
    &.ant-menu-submenu-active {
      .ant-menu-title-content {
        color: ${theme.colorPrimary};
      }
    }
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

  const buildMenuItem = (item: MenuObjectChildProps) =>
    item.disable ? (
      <Menu.Item key={item.name} css={styledDisabled} disabled>
        <Tooltip placement="top" title={tooltipText}>
          {item.label}
        </Tooltip>
      </Menu.Item>
    ) : (
      <Menu.Item key={item.name} css={styledChildMenu}>
        {item.url ? (
          <Typography.Link href={ensureAppRoot(item.url)}>
            {' '}
            {item.label}{' '}
          </Typography.Link>
        ) : (
          item.label
        )}
      </Menu.Item>
    );

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

  const theme = useTheme();
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
      {environmentTag?.text && (
        <Label
          css={{ borderRadius: `${theme.sizeUnit * 125}px` }}
          color={
            /^#(?:[0-9a-f]{3}){1,2}$/i.test(environmentTag.color)
              ? environmentTag.color
              : get(theme.colors, environmentTag.color)
          }
        >
          <span css={tagStyles}>{environmentTag.text}</span>
        </Label>
      )}
      <Menu
        css={css`
          display: flex;
          flex-direction: row;
          align-items: center;
        `}
        selectable={false}
        mode="horizontal"
        onClick={handleMenuSelection}
        onOpenChange={onMenuOpen}
        disabledOverflow
      >
        {RightMenuExtension && <RightMenuExtension />}
        {!navbarRight.user_is_anonymous && showActionDropdown && (
          <StyledSubMenu
            key="sub1"
            data-test="new-dropdown"
            title={
              <Icons.PlusOutlined
                iconColor={theme.colorPrimary}
                data-test="new-dropdown-icon"
              />
            }
            icon={<Icons.CaretDownOutlined iconSize="xs" />}
          >
            {dropdownItems?.map?.(menu => {
              const canShowChild = menu.childs?.some(
                item => typeof item === 'object' && !!item.perm,
              );
              if (menu.childs) {
                if (canShowChild) {
                  return (
                    <StyledSubMenu
                      key={`sub2_${menu.label}`}
                      className="data-menu"
                      title={menu.label}
                      icon={menu.icon}
                    >
                      {menu?.childs?.map?.((item, idx) =>
                        typeof item !== 'string' && item.name && item.perm ? (
                          <Fragment key={item.name}>
                            {idx === 3 && <Menu.Divider />}
                            {buildMenuItem(item)}
                          </Fragment>
                        ) : null,
                      )}
                    </StyledSubMenu>
                  );
                }
                if (!menu.url) {
                  return null;
                }
              }
              return (
                findPermission(
                  menu.perm as string,
                  menu.view as string,
                  roles,
                ) && (
                  <Menu.Item key={menu.label}>
                    {isFrontendRoute(menu.url) ? (
                      <Link to={menu.url || ''}>
                        {menu.icon} {menu.label}
                      </Link>
                    ) : (
                      <Typography.Link href={ensureAppRoot(menu.url || '')}>
                        {menu.icon} {menu.label}
                      </Typography.Link>
                    )}
                  </Menu.Item>
                )
              );
            })}
          </StyledSubMenu>
        )}
        {canSetMode() && (
          <span>
            <ThemeSelect
              setThemeMode={setThemeMode}
              themeMode={themeMode}
              hasLocalOverride={hasDevOverride()}
              onClearLocalSettings={clearLocalOverrides}
              allowOSPreference={canDetectOSPreference()}
            />
          </span>
        )}

        <StyledSubMenu
          key="sub3_settings"
          title={t('Settings')}
          icon={<Icons.CaretDownOutlined iconSize="xs" />}
        >
          {settings?.map?.((section, index) => [
            <Menu.ItemGroup key={`${section.label}`} title={section.label}>
              {section?.childs?.map?.(child => {
                if (typeof child !== 'string') {
                  const menuItemDisplay = RightMenuItemIconExtension ? (
                    <StyledMenuItemWithIcon>
                      {child.label}
                      <RightMenuItemIconExtension menuChild={child} />
                    </StyledMenuItemWithIcon>
                  ) : (
                    child.label
                  );
                  return (
                    <Menu.Item key={`${child.label}`}>
                      {isFrontendRoute(child.url) ? (
                        <Link to={child.url || ''}>{menuItemDisplay}</Link>
                      ) : (
                        <Typography.Link href={child.url || ''}>
                          {menuItemDisplay}
                        </Typography.Link>
                      )}
                    </Menu.Item>
                  );
                }
                return null;
              })}
            </Menu.ItemGroup>,
            index < settings.length - 1 && (
              <Menu.Divider key={`divider_${index}`} />
            ),
          ])}

          {!navbarRight.user_is_anonymous && [
            <Menu.Divider key="user-divider" />,
            <Menu.ItemGroup key="user-section" title={t('User')}>
              {navbarRight.user_info_url && (
                <Menu.Item key="info">
                  <Typography.Link href={navbarRight.user_info_url}>
                    {t('Info')}
                  </Typography.Link>
                </Menu.Item>
              )}
              <Menu.Item key="logout" onClick={handleLogout}>
                <Typography.Link href={navbarRight.user_logout_url}>
                  {t('Logout')}
                </Typography.Link>
              </Menu.Item>
            </Menu.ItemGroup>,
          ]}
          {(navbarRight.version_string || navbarRight.version_sha) && [
            <Menu.Divider key="version-info-divider" />,
            <Menu.ItemGroup key="about-section" title={t('About')}>
              <div className="about-section">
                {navbarRight.show_watermark && (
                  <div css={versionInfoStyles}>
                    {t('Powered by Apache Superset')}
                  </div>
                )}
                {navbarRight.version_string && (
                  <div css={versionInfoStyles}>
                    {t('Version')}: {navbarRight.version_string}
                  </div>
                )}
                {navbarRight.version_sha && (
                  <div css={versionInfoStyles}>
                    {t('SHA')}: {navbarRight.version_sha}
                  </div>
                )}
                {navbarRight.build_number && (
                  <div css={versionInfoStyles}>
                    {t('Build')}: {navbarRight.build_number}
                  </div>
                )}
              </div>
            </Menu.ItemGroup>,
          ]}
        </StyledSubMenu>
        {navbarRight.show_language_picker && (
          <LanguagePicker
            locale={navbarRight.locale}
            languages={navbarRight.languages}
          />
        )}
      </Menu>
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
