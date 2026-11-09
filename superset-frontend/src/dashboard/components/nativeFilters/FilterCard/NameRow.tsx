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
import { useSelector } from 'react-redux';
import { isChartCustomization, useTruncation } from '@superset-ui/core';
import { css, SupersetTheme, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Icons, Space } from '@superset-ui/core/components';
import { useFilterConfigModal } from 'src/dashboard/components/nativeFilters/FilterBar/FilterConfigurationLink/useFilterConfigModal';
import { RootState } from 'src/dashboard/types';
import { Row, FilterName, InternalRow } from './Styles';
import { FilterCardRowProps } from './types';
import { FilterConfigurationLink } from '../FilterBar/FilterConfigurationLink';
import { DescriptionToolTip } from '../FilterBar/FilterControls/FilterControlShared';
import { TooltipWithTruncation } from './TooltipWithTruncation';

export const NameRow = ({
  filter,
  hidePopover,
}: FilterCardRowProps & { hidePopover: () => void }) => {
  const theme = useTheme();
  const [filterNameRef, , elementsTruncated] = useTruncation();
  const dashboardId = useSelector<RootState, number>(
    ({ dashboardInfo }) => dashboardInfo.id,
  );

  const canEdit = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.dash_edit_perm,
  );

  const { FilterConfigModalComponent, openFilterConfigModal } =
    useFilterConfigModal({
      dashboardId,
      initialFilterId: filter.id,
    });

  const isCustomization = isChartCustomization(filter);

  return (
    <Row
      css={(theme: SupersetTheme) => css`
        margin-bottom: ${theme.sizeUnit * 3}px;
        justify-content: space-between;
      `}
    >
      <InternalRow>
        {isCustomization ? (
          <Icons.GroupOutlined
            iconSize="s"
            css={theme => css`
              margin-right: ${theme.sizeUnit}px;
            `}
          />
        ) : (
          <Icons.FilterOutlined
            iconSize="s"
            css={(theme: SupersetTheme) => css`
              margin-right: ${theme.sizeUnit}px;
            `}
          />
        )}
        <TooltipWithTruncation title={elementsTruncated ? filter.name : null}>
          <FilterName ref={filterNameRef}>{filter.name}</FilterName>
        </TooltipWithTruncation>
      </InternalRow>
      {(canEdit ||
        (filter.filterType === 'filter_select' &&
          filter.controlValues?.multiSelect)) && (
        <Space size={theme.sizeUnit} align="center">
          {canEdit && (
            <FilterConfigurationLink
              onClick={() => {
                openFilterConfigModal();
                hidePopover();
              }}
            >
              <Icons.EditOutlined
                iconSize="l"
                iconColor={theme.colorIcon}
                css={() => css`
                  cursor: pointer;
                `}
              />
            </FilterConfigurationLink>
          )}
          {filter.filterType === 'filter_select' &&
            filter.controlValues?.multiSelect && (
              <DescriptionToolTip
                description={t(
                  'When typing or pasting filter values, commas will separate values into multiple entries. To include a comma within a value, wrap it in double quotes: "San Francisco, CA"',
                )}
              />
            )}
        </Space>
      )}
      {FilterConfigModalComponent}
    </Row>
  );
};
