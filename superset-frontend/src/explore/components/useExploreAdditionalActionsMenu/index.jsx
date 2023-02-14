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
import React, { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { FileOutlined, FileImageOutlined } from '@ant-design/icons';
import { css, styled, t, useTheme } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import ModalTrigger from 'src/components/ModalTrigger';
import Button from 'src/components/Button';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { exportChart } from 'src/explore/exploreUtils';
import downloadAsImage from 'src/utils/downloadAsImage';
import { getChartPermalink } from 'src/utils/urlUtils';
import copyTextToClipboard from 'src/utils/copy';
import HeaderReportDropDown from 'src/components/ReportModal/HeaderReportDropdown';
import ViewQueryModal from '../controls/ViewQueryModal';
import EmbedCodeContent from '../EmbedCodeContent';

const MENU_KEYS = {
  EDIT_PROPERTIES: 'edit_properties',
  DOWNLOAD_SUBMENU: 'download_submenu',
  EXPORT_TO_CSV: 'export_to_csv',
  EXPORT_TO_CSV_PIVOTED: 'export_to_csv_pivoted',
  EXPORT_TO_JSON: 'export_to_json',
  DOWNLOAD_AS_IMAGE: 'download_as_image',
  SHARE_SUBMENU: 'share_submenu',
  COPY_PERMALINK: 'copy_permalink',
  EMBED_CODE: 'embed_code',
  SHARE_BY_EMAIL: 'share_by_email',
  REPORT_SUBMENU: 'report_submenu',
  SET_UP_REPORT: 'set_up_report',
  SET_REPORT_ACTIVE: 'set_report_active',
  EDIT_REPORT: 'edit_report',
  DELETE_REPORT: 'delete_report',
  VIEW_QUERY: 'view_query',
  RUN_IN_SQL_LAB: 'run_in_sql_lab',
};

const VIZ_TYPES_PIVOTABLE = ['pivot_table', 'pivot_table_v2'];

export const MenuItemWithCheckboxContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;

    & svg {
      width: ${theme.gridUnit * 3}px;
      height: ${theme.gridUnit * 3}px;
    }

    & span[role='checkbox'] {
      display: inline-flex;
      margin-right: ${theme.gridUnit}px;
    }
  `}
`;

export const MenuTrigger = styled(Button)`
  ${({ theme }) => css`
    width: ${theme.gridUnit * 8}px;
    height: ${theme.gridUnit * 8}px;
    padding: 0;
    border: 1px solid ${theme.colors.primary.dark2};

    &.ant-btn > span.anticon {
      line-height: 0;
      transition: inherit;
    }

    &:hover:not(:focus) > span.anticon {
      color: ${theme.colors.primary.light1};
    }
  `}
`;

export const useExploreAdditionalActionsMenu = (
  latestQueryFormData,
  canDownloadCSV,
  slice,
  onOpenInEditor,
  onOpenPropertiesModal,
  ownState,
) => {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast } = useToasts();
  const [showReportSubMenu, setShowReportSubMenu] = useState(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState([]);
  const charts = useSelector(state => state.charts);
  const chart = useMemo(() => {
    if (!charts) {
      return undefined;
    }
    const chartsValues = Object.values(charts);
    if (chartsValues.length > 0) {
      return chartsValues[0];
    }
    return undefined;
  }, [charts]);

  const { datasource } = latestQueryFormData;
  const sqlSupported = datasource && datasource.split('__')[1] === 'table';

  const shareByEmail = useCallback(async () => {
    try {
      const subject = t('Superset Chart');
      const url = await getChartPermalink(latestQueryFormData);
      const body = encodeURIComponent(t('%s%s', 'Check out this chart: ', url));
      window.location.href = `mailto:?Subject=${subject}%20&Body=${body}`;
    } catch (error) {
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  }, [addDangerToast, latestQueryFormData]);

  const exportCSV = useCallback(
    () =>
      canDownloadCSV
        ? exportChart({
            formData: latestQueryFormData,
            ownState,
            resultType: 'full',
            resultFormat: 'csv',
          })
        : null,
    [canDownloadCSV, latestQueryFormData],
  );

  const exportCSVPivoted = useCallback(
    () =>
      canDownloadCSV
        ? exportChart({
            formData: latestQueryFormData,
            resultType: 'post_processed',
            resultFormat: 'csv',
          })
        : null,
    [canDownloadCSV, latestQueryFormData],
  );

  const exportJson = useCallback(
    () =>
      exportChart({
        formData: latestQueryFormData,
        resultType: 'results',
        resultFormat: 'json',
      }),
    [latestQueryFormData],
  );

  const copyLink = useCallback(async () => {
    try {
      if (!latestQueryFormData) {
        throw new Error();
      }
      await copyTextToClipboard(() => getChartPermalink(latestQueryFormData));
      addSuccessToast(t('Copied to clipboard!'));
    } catch (error) {
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  }, [addDangerToast, addSuccessToast, latestQueryFormData]);

  const handleMenuClick = useCallback(
    ({ key, domEvent }) => {
      switch (key) {
        case MENU_KEYS.EDIT_PROPERTIES:
          onOpenPropertiesModal();
          setIsDropdownVisible(false);
          break;
        case MENU_KEYS.EXPORT_TO_CSV:
          exportCSV();
          setIsDropdownVisible(false);
          setOpenSubmenus([]);
          break;
        case MENU_KEYS.EXPORT_TO_CSV_PIVOTED:
          exportCSVPivoted();
          setIsDropdownVisible(false);
          setOpenSubmenus([]);
          break;
        case MENU_KEYS.EXPORT_TO_JSON:
          exportJson();
          setIsDropdownVisible(false);
          setOpenSubmenus([]);

          break;
        case MENU_KEYS.DOWNLOAD_AS_IMAGE:
          downloadAsImage(
            '.panel-body .chart-container',
            // eslint-disable-next-line camelcase
            slice?.slice_name ?? t('New chart'),
            true,
          )(domEvent);
          setIsDropdownVisible(false);
          setOpenSubmenus([]);
          break;
        case MENU_KEYS.COPY_PERMALINK:
          copyLink();
          setIsDropdownVisible(false);
          setOpenSubmenus([]);
          break;
        case MENU_KEYS.EMBED_CODE:
          setIsDropdownVisible(false);
          setOpenSubmenus([]);
          break;
        case MENU_KEYS.SHARE_BY_EMAIL:
          shareByEmail();
          setIsDropdownVisible(false);
          setOpenSubmenus([]);
          break;
        case MENU_KEYS.VIEW_QUERY:
          setIsDropdownVisible(false);
          break;
        case MENU_KEYS.RUN_IN_SQL_LAB:
          onOpenInEditor(latestQueryFormData);
          setIsDropdownVisible(false);
          break;
        default:
          break;
      }
    },
    [
      copyLink,
      exportCSV,
      exportCSVPivoted,
      exportJson,
      latestQueryFormData,
      onOpenInEditor,
      onOpenPropertiesModal,
      shareByEmail,
      slice?.slice_name,
    ],
  );

  const menu = useMemo(
    () => (
      <Menu
        onClick={handleMenuClick}
        selectable={false}
        openKeys={openSubmenus}
        onOpenChange={setOpenSubmenus}
      >
        {slice && (
          <>
            <Menu.Item key={MENU_KEYS.EDIT_PROPERTIES}>
              {t('Edit chart properties')}
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
        <Menu.SubMenu title={t('Download')} key={MENU_KEYS.DOWNLOAD_SUBMENU}>
          {VIZ_TYPES_PIVOTABLE.includes(latestQueryFormData.viz_type) ? (
            <>
              <Menu.Item
                key={MENU_KEYS.EXPORT_TO_CSV}
                icon={<FileOutlined />}
                disabled={!canDownloadCSV}
              >
                {t('Export to original .CSV')}
              </Menu.Item>
              <Menu.Item
                key={MENU_KEYS.EXPORT_TO_CSV_PIVOTED}
                icon={<FileOutlined />}
                disabled={!canDownloadCSV}
              >
                {t('Export to pivoted .CSV')}
              </Menu.Item>
            </>
          ) : (
            <Menu.Item
              key={MENU_KEYS.EXPORT_TO_CSV}
              icon={<FileOutlined />}
              disabled={!canDownloadCSV}
            >
              {t('Export to .CSV')}
            </Menu.Item>
          )}
          <Menu.Item key={MENU_KEYS.EXPORT_TO_JSON} icon={<FileOutlined />}>
            {t('Export to .JSON')}
          </Menu.Item>
          <Menu.Item
            key={MENU_KEYS.DOWNLOAD_AS_IMAGE}
            icon={<FileImageOutlined />}
          >
            {t('Download as image')}
          </Menu.Item>
        </Menu.SubMenu>
        <Menu.SubMenu title={t('Share')} key={MENU_KEYS.SHARE_SUBMENU}>
          <Menu.Item key={MENU_KEYS.COPY_PERMALINK}>
            {t('Copy permalink to clipboard')}
          </Menu.Item>
          <Menu.Item key={MENU_KEYS.SHARE_BY_EMAIL}>
            {t('Share chart by email')}
          </Menu.Item>
          <Menu.Item key={MENU_KEYS.EMBED_CODE}>
            <ModalTrigger
              triggerNode={
                <span data-test="embed-code-button">{t('Embed code')}</span>
              }
              modalTitle={t('Embed code')}
              modalBody={
                <EmbedCodeContent
                  formData={latestQueryFormData}
                  addDangerToast={addDangerToast}
                />
              }
              maxWidth={`${theme.gridUnit * 100}px`}
              destroyOnClose
              responsive
            />
          </Menu.Item>
        </Menu.SubMenu>
        <Menu.Divider />
        {showReportSubMenu ? (
          <>
            <Menu.SubMenu title={t('Manage email report')}>
              <HeaderReportDropDown
                chart={chart}
                setShowReportSubMenu={setShowReportSubMenu}
                showReportSubMenu={showReportSubMenu}
                setIsDropdownVisible={setIsDropdownVisible}
                isDropdownVisible={isDropdownVisible}
                useTextMenu
              />
            </Menu.SubMenu>
            <Menu.Divider />
          </>
        ) : (
          <Menu>
            <HeaderReportDropDown
              chart={chart}
              setShowReportSubMenu={setShowReportSubMenu}
              setIsDropdownVisible={setIsDropdownVisible}
              isDropdownVisible={isDropdownVisible}
              useTextMenu
            />
          </Menu>
        )}
        <Menu.Item key={MENU_KEYS.VIEW_QUERY}>
          <ModalTrigger
            triggerNode={
              <span data-test="view-query-menu-item">{t('View query')}</span>
            }
            modalTitle={t('View query')}
            modalBody={
              <ViewQueryModal latestQueryFormData={latestQueryFormData} />
            }
            draggable
            resizable
            responsive
          />
        </Menu.Item>
        {sqlSupported && (
          <Menu.Item key={MENU_KEYS.RUN_IN_SQL_LAB}>
            {t('Run in SQL Lab')}
          </Menu.Item>
        )}
      </Menu>
    ),
    [
      addDangerToast,
      canDownloadCSV,
      chart,
      handleMenuClick,
      isDropdownVisible,
      latestQueryFormData,
      openSubmenus,
      showReportSubMenu,
      slice,
      sqlSupported,
      theme.gridUnit,
    ],
  );
  return [menu, isDropdownVisible, setIsDropdownVisible];
};
