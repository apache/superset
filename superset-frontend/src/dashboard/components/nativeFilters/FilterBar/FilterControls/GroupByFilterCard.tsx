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
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core';
import {
  DataMask,
  DataMaskStateWithId,
  Filter,
  useTruncation,
  ChartCustomization,
  NativeFilterTarget,
  Filters,
  NativeFilterType,
} from '@superset-ui/core';
import { styled, css, useTheme, SupersetTheme } from '@apache-superset/core/ui';
import {
  Typography,
  Select,
  Popover,
  Loading,
  Icons,
  Tooltip,
  FormItem,
} from '@superset-ui/core/components';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import { setPendingChartCustomization } from 'src/dashboard/actions/chartCustomizationActions';
import { TooltipWithTruncation } from 'src/dashboard/components/nativeFilters/FilterCard/TooltipWithTruncation';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import { dispatchChartCustomizationHoverAction } from './utils';
import { mergeExtraFormData } from '../../utils';

interface ColumnApiResponse {
  column_name?: string;
  name?: string;
  verbose_name?: string;
  filterable?: boolean;
}

interface GroupByFilterCardProps {
  customizationItem: ChartCustomization;
  orientation?: 'vertical' | 'horizontal';
  dataMaskSelected?: DataMaskStateWithId;
  onFilterSelectionChange?: (
    filter: Filter | ChartCustomization,
    dataMask: DataMask,
  ) => void;
}

const Row = styled.div`
  display: flex;
  align-items: center;
  margin: ${({ theme }) => theme.sizeUnit}px 0;
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  &:first-of-type {
    margin-top: 0;
  }

  &:last-of-type {
    margin-bottom: 0;
  }
`;

const RowLabel = styled.span`
  color: ${({ theme }) => theme.colorTextSecondary};
  padding-right: ${({ theme }) => theme.sizeUnit * 4}px;
  margin-right: auto;
  white-space: nowrap;
`;

const RowValue = styled.div`
  color: ${({ theme }) => theme.colorText};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline;
`;

const InternalRow = styled.div`
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const FilterTitle = styled(Typography.Text)`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorText};
  font-weight: 600;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  display: flex;
  align-items: center;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.colorPrimary};
  }
`;

const HorizontalFormItem = styled(FormItem)`
  && {
    margin-bottom: 0;
    align-items: center;
  }

  .ant-form-item-label {
    display: flex;
    align-items: center;
    overflow: visible;
    padding-bottom: 0;
    margin-right: ${({ theme }) => theme.sizeUnit * 2}px;

    & > label {
      margin-bottom: 0;
      padding: 0;
      line-height: 1;
      font-size: ${({ theme }) => theme.fontSizeSM}px;
      font-weight: ${({ theme }) => theme.fontWeightNormal};
      color: ${({ theme }) => theme.colorText};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &::after {
        display: none;
      }
    }
  }

  .ant-form-item-control {
    min-width: 164px;
    max-width: none;
  }

  .select-container {
    width: 100%;
  }

  .ant-select-dropdown {
    min-width: 200px !important;
    max-width: 400px !important;
  }
`;

const ToolTipContainer = styled.div`
  font-size: ${({ theme }) => theme.fontSize}px;
  display: flex;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const RequiredFieldIndicator = () => (
  <span
    css={(theme: SupersetTheme) => ({
      color: theme.colorError,
      fontSize: `${theme.fontSizeSM}px`,
      paddingLeft: '1px',
    })}
  >
    *
  </span>
);

const DescriptionTooltip = ({ description }: { description: string }) => (
  <ToolTipContainer>
    <Tooltip
      title={description}
      placement="right"
      overlayInnerStyle={{
        display: '-webkit-box',
        WebkitLineClamp: 10,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'normal',
      }}
    >
      <Icons.InfoCircleOutlined
        className="text-muted"
        role="button"
        css={theme => ({
          paddingLeft: `${theme.sizeUnit}px`,
        })}
      />
    </Tooltip>
  </ToolTipContainer>
);

const GroupByFilterCardContent: FC<{
  customizationItem: ChartCustomization;
  hidePopover: () => void;
}> = ({ customizationItem }) => {
  const { description, name } = customizationItem;
  const dataset = customizationItem.targets?.[0]?.datasetId;
  const [titleRef, , titleTruncated] = useTruncation();
  const displayName = name?.trim() || t('Dynamic group by');

  const datasetLabel = useMemo(() => {
    if (!dataset) {
      return t('Not set');
    }
    return `Dataset ${dataset}`;
  }, [dataset]);

  const aggregationDisplay = useMemo(() => {
    const sortMetric = customizationItem.controlValues?.sortMetric;
    if (sortMetric) {
      return sortMetric.toUpperCase();
    }
    return t('None');
  }, [customizationItem.controlValues?.sortMetric]);

  return (
    <div>
      <Row
        css={theme => css`
          margin-bottom: ${theme.sizeUnit * 3}px;
          justify-content: flex-start;
        `}
      >
        <InternalRow>
          <Icons.GroupOutlined
            iconSize="s"
            css={theme => css`
              margin-right: ${theme.sizeUnit}px;
            `}
          />
          <TooltipWithTruncation title={titleTruncated ? displayName : null}>
            <div ref={titleRef}>
              <Typography.Text strong>{displayName}</Typography.Text>
            </div>
          </TooltipWithTruncation>
        </InternalRow>
      </Row>
      <Row>
        <RowLabel>{t('Type')}</RowLabel>
        <RowValue>{t('Dynamic group by')}</RowValue>
      </Row>

      <Row>
        <RowLabel>{t('Dataset')}</RowLabel>
        <RowValue>
          {typeof datasetLabel === 'string' ? datasetLabel : 'Dataset'}
        </RowValue>
      </Row>

      <Row>
        <RowLabel>{t('Aggregation')}</RowLabel>
        <RowValue>{aggregationDisplay}</RowValue>
      </Row>

      {description && (
        <Row
          css={theme => css`
            margin-top: ${theme.sizeUnit * 2}px;
          `}
        >
          <DescriptionTooltip description={description} />
        </Row>
      )}
    </div>
  );
};

const GroupByFilterCard: FC<GroupByFilterCardProps> = ({
  customizationItem,
  orientation = 'vertical',
  dataMaskSelected,
  onFilterSelectionChange,
}) => {
  const theme = useTheme();
  const dataset = customizationItem.targets?.[0]?.datasetId;
  const [filterTitleRef, , titleElementsTruncated] = useTruncation();

  const [loading, setLoading] = useState(false);
  const [isHoverCardVisible, setIsHoverCardVisible] = useState(false);
  const [columnOptions, setColumnOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const dispatch = useDispatch();

  const isHorizontalLayout = orientation === 'horizontal';

  const hideHoverCard = useCallback(() => {
    setIsHoverCardVisible(false);
  }, []);

  const setHoveredChartCustomization = useCallback(
    () => dispatchChartCustomizationHoverAction(dispatch, customizationItem.id),
    [dispatch, customizationItem.id],
  );

  const unsetHoveredChartCustomization = useCallback(
    () => dispatchChartCustomizationHoverAction(dispatch),
    [dispatch],
  );

  const isRequired = useMemo(
    () => !!customizationItem.controlValues?.enableEmptyFilter,
    [customizationItem.controlValues?.enableEmptyFilter],
  );

  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );

  const effectiveDataMask = dataMaskSelected ?? dataMask;

  const columnName = customizationItem.targets?.[0]?.column?.name;

  const currentValue = useMemo(() => {
    const dataMaskValue =
      effectiveDataMask[customizationItem.id]?.filterState?.value;

    if (dataMaskValue !== undefined) {
      return dataMaskValue;
    }

    return null;
  }, [effectiveDataMask, customizationItem.id]);

  const canSelectMultiple =
    customizationItem.controlValues?.canSelectMultiple ?? true;

  const columnDisplayName = useMemo(() => {
    if (customizationItem.name) {
      return customizationItem.name;
    }
    if (columnName) {
      return columnName;
    }
    return t('Group By');
  }, [customizationItem.name, columnName]);

  const handleColumnChange = useCallback(
    (value: string | string[]) => {
      const columnValue = canSelectMultiple
        ? Array.isArray(value)
          ? value.length > 0
            ? value
            : null
          : value || null
        : typeof value === 'string'
          ? value
          : null;

      const targets: [Partial<NativeFilterTarget>] = columnValue
        ? ([
            {
              datasetId: dataset,
              column: { name: columnValue },
            },
          ] as [Partial<NativeFilterTarget>])
        : ([{}] as [Partial<NativeFilterTarget>]);

      dispatch(
        setPendingChartCustomization({
          ...customizationItem,
          targets,
        }),
      );

      const groupbyValue = columnValue
        ? Array.isArray(columnValue)
          ? columnValue
          : [columnValue]
        : [];

      const dataMask: DataMask = {
        extraFormData: {
          custom_form_data: {
            groupby: groupbyValue,
          },
        },
        filterState: {
          label: groupbyValue.join(', '),
          value: columnValue,
        },
        ownState: {
          column: columnValue,
        },
      };

      onFilterSelectionChange?.(customizationItem, dataMask);
    },
    [
      canSelectMultiple,
      dataset,
      dispatch,
      customizationItem,
      onFilterSelectionChange,
    ],
  );

  const filters = useSelector<RootState, Filters>(
    state => state.nativeFilters.filters,
  );

  const dependencies = useMemo(() => {
    let deps = {};

    Object.entries(filters).forEach(([filterId, filter]) => {
      if (
        filter.type === NativeFilterType.Divider ||
        !effectiveDataMask[filterId]?.filterState?.value
      ) {
        return;
      }

      const filterState = effectiveDataMask[filterId];
      deps = mergeExtraFormData(deps, filterState?.extraFormData);
    });

    return deps;
  }, [effectiveDataMask, filters]);

  useEffect(() => {
    const fetchColumnOptions = async () => {
      const datasetSource = dataset;

      if (!datasetSource) {
        return;
      }

      const datasetId =
        typeof datasetSource === 'number'
          ? datasetSource
          : typeof datasetSource === 'string'
            ? datasetSource
            : typeof datasetSource === 'object' &&
                datasetSource !== null &&
                'value' in datasetSource
              ? (datasetSource as { value: string | number }).value
              : null;

      if (!datasetId) {
        return;
      }

      setLoading(true);
      try {
        const endpoint = `/api/v1/dataset/${datasetId}`;
        const { json } = await cachedSupersetGet({ endpoint });

        if (json?.result?.columns) {
          const options = json.result.columns
            .filter((col: ColumnApiResponse) => col.filterable !== false)
            .map((col: ColumnApiResponse) => ({
              label: col.verbose_name || col.column_name || col.name || '',
              value: col.column_name || col.name || '',
            }));
          setColumnOptions(options);
        }
      } catch (error) {
        setColumnOptions([]);
        dispatch(
          addDangerToast(t('Failed to load columns for dataset %s', datasetId)),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchColumnOptions();
  }, [dataset, dependencies, dispatch]);

  const displayTitle = columnDisplayName;

  const description = customizationItem.description?.trim();

  return (
    <div>
      {!isHorizontalLayout && (
        <Popover
          placement="right"
          overlayStyle={{ width: '280px' }}
          content={
            <GroupByFilterCardContent
              customizationItem={customizationItem}
              hidePopover={hideHoverCard}
            />
          }
          mouseEnterDelay={0.2}
          mouseLeaveDelay={0.2}
          onOpenChange={visible => {
            setIsHoverCardVisible(visible);
          }}
          open={isHoverCardVisible}
          arrow={false}
        >
          <div
            css={css`
              display: flex;
              align-items: center;
              margin-bottom: ${theme.sizeUnit}px;
            `}
          >
            <TooltipWithTruncation
              title={titleElementsTruncated ? displayTitle : null}
            >
              <div ref={filterTitleRef}>
                <FilterTitle>
                  {displayTitle}
                  {isRequired && <RequiredFieldIndicator />}
                </FilterTitle>
              </div>
            </TooltipWithTruncation>
            {description && <DescriptionTooltip description={description} />}
          </div>
        </Popover>
      )}

      {isHorizontalLayout ? (
        <HorizontalFormItem
          label={
            <Popover
              placement="bottom"
              overlayStyle={{ width: '240px' }}
              content={
                <GroupByFilterCardContent
                  customizationItem={customizationItem}
                  hidePopover={hideHoverCard}
                />
              }
              mouseEnterDelay={0.2}
              mouseLeaveDelay={0.2}
              onOpenChange={visible => {
                setIsHoverCardVisible(visible);
              }}
              open={isHoverCardVisible}
              arrow={false}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                {displayTitle}
                {isRequired && <RequiredFieldIndicator />}
              </div>
            </Popover>
          }
        >
          <div
            onMouseEnter={setHoveredChartCustomization}
            onMouseLeave={unsetHoveredChartCustomization}
          >
            <Select
              allowClear
              autoClearSearchValue
              placeholder={t('Search columns...')}
              value={currentValue}
              onChange={handleColumnChange}
              options={columnOptions}
              showSearch
              mode={canSelectMultiple ? 'multiple' : undefined}
              filterOption={(input, option) =>
                ((option?.label as string) ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              getPopupContainer={triggerNode => triggerNode.parentNode}
              oneLine={isHorizontalLayout}
              className="select-container"
              loading={loading}
            />
          </div>
        </HorizontalFormItem>
      ) : (
        <div
          css={css`
            margin-bottom: ${theme.sizeUnit}px;
          `}
          onMouseEnter={setHoveredChartCustomization}
          onMouseLeave={unsetHoveredChartCustomization}
        >
          <Select
            allowClear
            autoClearSearchValue
            placeholder={t('Search columns...')}
            value={currentValue}
            onChange={handleColumnChange}
            options={columnOptions}
            showSearch
            mode={canSelectMultiple ? 'multiple' : undefined}
            filterOption={(input, option) =>
              ((option?.label as string) ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            loading={loading}
          />
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Loading position="inline" />
        </div>
      )}
    </div>
  );
};

export default GroupByFilterCard;
