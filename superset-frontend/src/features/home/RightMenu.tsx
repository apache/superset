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
import { MainNav as Menu } from 'src/components/Menu';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import Label from 'src/components/Label';
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
import TelemetryPixel from 'src/components/TelemetryPixel';
import LanguagePicker from './LanguagePicker';
import {
  ExtensionConfigs,
  GlobalMenuDataOptions,
  RightMenuProps,
} from './types';

const extensionsRegistry = getExtensionsRegistry();

const versionInfoStyles = (theme: SupersetTheme) => css`
  padding: ${theme.gridUnit * 1.5}px ${theme.gridUnit * 4}px
    ${theme.gridUnit * 4}px ${theme.gridUnit * 7}px;
  color: ${theme.colors.grayscale.base};
  font-size: ${theme.typography.sizes.xs}px;
  white-space: nowrap;
`;
const StyledI = styled.div`
  color: ${({ theme }) => theme.colors.primary.dark1};
`;

const styledDisabled = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light1};
  .ant-menu-item-active {
    color: ${theme.colors.grayscale.light1};
    cursor: default;
  }
`;

const StyledDiv = styled.div<{ align: string }>`
  display: flex;
  flex-direction: row;
  justify-content: ${({ align }) => align};
  align-items: center;
  margin-right: ${({ theme }) => theme.gridUnit}px;
  .ant-menu-submenu-title > svg {
    top: ${({ theme }) => theme.gridUnit * 5.25}px;
  }
`;

const StyledMenuItemWithIcon = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const StyledAnchor = styled.a`
  padding-right: ${({ theme }) => theme.gridUnit}px;
  padding-left: ${({ theme }) => theme.gridUnit}px;
`;

const tagStyles = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light5};
`;

const styledChildMenu = (theme: SupersetTheme) => css`
  &:hover {
    color: ${theme.colors.primary.base} !important;
    cursor: pointer !important;
  }
`;

const { SubMenu } = Menu;

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
  const dropdownItems: MenuObjectProps[] = [
    {
      label: t('Data'),
      icon: 'fa-database',
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
      icon: 'fa-fw fa-search',
      perm: 'can_sqllab',
      view: 'Superset',
    },
    {
      label: t('Chart'),
      url: Number.isInteger(dashboardId)
        ? `/chart/add?dashboard_id=${dashboardId}`
        : '/chart/add',
      icon: 'fa-fw fa-bar-chart',
      perm: 'can_write',
      view: 'Chart',
    },
    {
      label: t('Dashboard'),
      url: '/dashboard/new',
      icon: 'fa-fw fa-dashboard',
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
      // There might be some existings Gsheets and Clickhouse DBs
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

  const menuIconAndLabel = (menu: MenuObjectProps) => (
    <>
      <i data-test={`menu-item-${menu.label}`} className={`fa ${menu.icon}`} />
      {menu.label}
    </>
  );

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
        {item.url ? <a href={item.url}> {item.label} </a> : item.label}
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
          css={{ borderRadius: `${theme.gridUnit * 125}px` }}
          color={
            /^#(?:[0-9a-f]{3}){1,2}$/i.test(environmentTag.color)
              ? environmentTag.color
              : environmentTag.color
                  .split('.')
                  .reduce((o, i) => o[i], theme.colors)
          }
        >
          <span css={tagStyles}>{environmentTag.text}</span>
        </Label>
      )}
      <Menu
        selectable={false}
        mode="horizontal"
        onClick={handleMenuSelection}
        onOpenChange={onMenuOpen}
      >
        {RightMenuExtension && <RightMenuExtension />}
        {!navbarRight.user_is_anonymous && showActionDropdown && (
          <SubMenu
            data-test="new-dropdown"
            title={
              <StyledI data-test="new-dropdown-icon" className="fa fa-plus" />
            }
            icon={<Icons.TriangleDown />}
          >
            {dropdownItems?.map?.(menu => {
              const canShowChild = menu.childs?.some(
                item => typeof item === 'object' && !!item.perm,
              );
              if (menu.childs) {
                if (canShowChild) {
                  return (
                    <SubMenu
                      key={`sub2_${menu.label}`}
                      className="data-menu"
                      title={menuIconAndLabel(menu)}
                    >
                      {menu?.childs?.map?.((item, idx) =>
                        typeof item !== 'string' && item.name && item.perm ? (
                          <Fragment key={item.name}>
                            {idx === 3 && <Menu.Divider />}
                            {buildMenuItem(item)}
                          </Fragment>
                        ) : null,
                      )}
                    </SubMenu>
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
                        <i
                          data-test={`menu-item-${menu.label}`}
                          className={`fa ${menu.icon}`}
                        />{' '}
                        {menu.label}
                      </Link>
                    ) : (
                      <a href={menu.url}>
                        <i
                          data-test={`menu-item-${menu.label}`}
                          className={`fa ${menu.icon}`}
                        />{' '}
                        {menu.label}
                      </a>
                    )}
                  </Menu.Item>
                )
              );
            })}
          </SubMenu>
        )}
        <SubMenu
          title={t('Settings')}
          icon={<Icons.TriangleDown iconSize="xl" />}
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
                        <a href={child.url}>{menuItemDisplay}</a>
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
                  <a href={navbarRight.user_info_url}>{t('Info')}</a>
                </Menu.Item>
              )}
              <Menu.Item key="logout" onClick={handleLogout}>
                <a href={navbarRight.user_logout_url}>{t('Logout')}</a>
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
        </SubMenu>
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
              <i className={navbarRight.documentation_icon} />
            ) : (
              <i className="fa fa-question" />
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
              <i className="fa fa-bug" />
            )}
          </StyledAnchor>
          <span>&nbsp;</span>
        </>
      )}
      {navbarRight.user_is_anonymous && (
        <StyledAnchor href={navbarRight.user_login_url}>
          <i className="fa fa-fw fa-sign-in" />
          {t('Login')}
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
