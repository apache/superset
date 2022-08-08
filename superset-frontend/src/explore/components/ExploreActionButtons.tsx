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
import React, { ReactElement, useState } from 'react';
import cx from 'classnames';
import { QueryFormData, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import { Slice } from 'src/types/Chart';
import copyTextToClipboard from 'src/utils/copy';
import { getChartPermalink } from 'src/utils/urlUtils';
import withToasts from 'src/components/MessageToasts/withToasts';
import EmbedCodeButton from './EmbedCodeButton';
import { exportChart } from '../exploreUtils';
import ExploreAdditionalActionsMenu from './ExploreAdditionalActionsMenu';
import { ExportToCSVDropdown } from './ExportToCSVDropdown';

type ActionButtonProps = {
  prefixIcon: React.ReactElement;
  suffixIcon?: React.ReactElement;
  text?: string | ReactElement;
  tooltip: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onTooltipVisibilityChange?: (visible: boolean) => void;
  'data-test'?: string;
};

type ExploreActionButtonsProps = {
  actions: { redirectSQLLab: () => void; openPropertiesModal: () => void };
  canDownloadCSV: boolean;
  chartStatus: string;
  latestQueryFormData: QueryFormData;
  queriesResponse: {};
  slice: Slice;
  addDangerToast: Function;
  addSuccessToast: Function;
};

const VIZ_TYPES_PIVOTABLE = ['pivot_table', 'pivot_table_v2'];

const ActionButton = (props: ActionButtonProps) => {
  const {
    prefixIcon,
    suffixIcon,
    text,
    tooltip,
    className,
    onTooltipVisibilityChange,
    ...rest
  } = props;
  return (
    <Tooltip
      id={`${prefixIcon}-tooltip`}
      placement="top"
      title={tooltip}
      trigger={['hover']}
      onVisibleChange={onTooltipVisibilityChange}
    >
      <div
        role="button"
        tabIndex={0}
        css={{
          display: 'flex',
          alignItems: 'center',
          '&:focus, &:focus:active': { outline: 0 },
        }}
        className={className || 'btn btn-default btn-sm'}
        style={{ height: 30 }}
        {...rest}
      >
        {prefixIcon}
        {text && <span style={{ marginLeft: 5 }}>{text}</span>}
        {suffixIcon}
      </div>
    </Tooltip>
  );
};

const ExploreActionButtons = (props: ExploreActionButtonsProps) => {
  const {
    actions,
    canDownloadCSV,
    chartStatus,
    latestQueryFormData,
    slice,
    addDangerToast,
    addSuccessToast,
  } = props;

  const copyTooltipText = t('Copy permalink to clipboard');
  const [copyTooltip, setCopyTooltip] = useState(copyTooltipText);

  const doCopyLink = async () => {
    try {
      setCopyTooltip(t('Loading...'));
      const url = await getChartPermalink(latestQueryFormData);
      await copyTextToClipboard(url);
      setCopyTooltip(t('Copied to clipboard!'));
      addSuccessToast(t('Copied to clipboard!'));
    } catch (error) {
      setCopyTooltip(t('Copying permalink failed.'));
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  };

  const doShareEmail = async () => {
    try {
      const subject = t('Superset Chart');
      const url = await getChartPermalink(latestQueryFormData);
      const body = encodeURIComponent(t('%s%s', 'Check out this chart: ', url));
      window.location.href = `mailto:?Subject=${subject}%20&Body=${body}`;
    } catch (error) {
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  };

  const doExportCSV = canDownloadCSV
    ? exportChart.bind(this, {
        formData: latestQueryFormData,
        resultType: 'full',
        resultFormat: 'csv',
      })
    : null;

  const doExportCSVPivoted = canDownloadCSV
    ? exportChart.bind(this, {
        formData: latestQueryFormData,
        resultType: 'post_processed',
        resultFormat: 'csv',
      })
    : null;

  const doExportJson = exportChart.bind(this, {
    formData: latestQueryFormData,
    resultType: 'results',
    resultFormat: 'json',
  });

  const exportToCSVClasses = cx('btn btn-default btn-sm', {
    disabled: !canDownloadCSV,
  });

  return (
    <div
      className="btn-group results"
      role="group"
      data-test="btn-group-results"
    >
      {latestQueryFormData && (
        <>
          <ActionButton
            prefixIcon={<Icons.Link iconSize="l" />}
            tooltip={copyTooltip}
            onClick={doCopyLink}
            data-test="short-link-button"
            onTooltipVisibilityChange={value =>
              !value && setTimeout(() => setCopyTooltip(copyTooltipText), 200)
            }
          />
          <ActionButton
            prefixIcon={<Icons.Email iconSize="l" />}
            tooltip={t('Share permalink by email')}
            onClick={doShareEmail}
          />
          <EmbedCodeButton
            formData={latestQueryFormData}
            addDangerToast={addDangerToast}
          />
          <ActionButton
            prefixIcon={<Icons.FileTextOutlined iconSize="m" />}
            text=".JSON"
            tooltip={t('Export to .JSON format')}
            onClick={doExportJson}
          />
          {VIZ_TYPES_PIVOTABLE.includes(latestQueryFormData.viz_type) ? (
            <ExportToCSVDropdown
              exportCSVOriginal={doExportCSV}
              exportCSVPivoted={doExportCSVPivoted}
            >
              <ActionButton
                prefixIcon={<Icons.FileExcelOutlined iconSize="m" />}
                suffixIcon={
                  <Icons.CaretDown
                    iconSize="l"
                    css={theme => `
                    margin-left: ${theme.gridUnit}px;
                    margin-right: ${-theme.gridUnit}px;
                  `}
                  />
                }
                text=".CSV"
                tooltip={t('Export to .CSV format')}
                className={exportToCSVClasses}
              />
            </ExportToCSVDropdown>
          ) : (
            <ActionButton
              prefixIcon={<Icons.FileExcelOutlined iconSize="m" />}
              text=".CSV"
              tooltip={t('Export to .CSV format')}
              onClick={doExportCSV}
              className={exportToCSVClasses}
            />
          )}
        </>
      )}
      <ExploreAdditionalActionsMenu
        latestQueryFormData={latestQueryFormData}
        chartStatus={chartStatus}
        onOpenInEditor={actions.redirectSQLLab}
        onOpenPropertiesModal={actions.openPropertiesModal}
        slice={slice}
      />
    </div>
  );
};

export default withToasts(ExploreActionButtons);
