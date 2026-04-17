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
import { ReactNode, useState, useEffect, useCallback, useMemo } from 'react';
import rison from 'rison';
import { t } from '@apache-superset/core';
import { isDefined, JsonResponse, SupersetClient } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import { getUrlParam } from 'src/utils/urlUtils';
import { FilterPlugins, URL_PARAMS } from 'src/constants';
import { Link, useHistory } from 'react-router-dom';
import {
  AsyncSelect,
  Button,
  Loading,
  Steps,
} from '@superset-ui/core/components';
import withToasts from 'src/components/MessageToasts/withToasts';

import VizTypeGallery, {
  MAX_ADVISABLE_VIZ_GALLERY_WIDTH,
} from 'src/explore/components/controls/VizTypeControl/VizTypeGallery';
import { findPermission } from 'src/utils/findPermission';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import getBootstrapData from 'src/utils/getBootstrapData';
import {
  Dataset,
  DatasetSelectLabel,
} from 'src/features/datasets/DatasetSelectLabel';
import { Icons } from '@superset-ui/core/components/Icons';

export interface ChartCreationProps {
  user: UserWithPermissionsAndRoles;
  addSuccessToast: (arg: string) => void;
}

const ESTIMATED_NAV_HEIGHT = 56;
const ELEMENTS_EXCEPT_VIZ_GALLERY = ESTIMATED_NAV_HEIGHT + 250;

const bootstrapData = getBootstrapData();
const denyList: string[] = (
  bootstrapData.common.conf.VIZ_TYPE_DENYLIST || []
).concat(Object.values(FilterPlugins));

const StyledContainer = styled.div`
  ${({ theme }) => `
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
    max-width: ${MAX_ADVISABLE_VIZ_GALLERY_WIDTH}px;
    max-height: calc(100vh - ${ESTIMATED_NAV_HEIGHT}px);
    border-radius: ${theme.borderRadius}px;
    background-color: ${theme.colorBgContainer};
    margin-left: auto;
    margin-right: auto;
    padding-left: ${theme.padding}px;
    padding-right: ${theme.padding}px;
    padding-bottom: ${theme.padding}px;

    h3 {
      padding-bottom: ${theme.paddingSM}px;
    }

    & .dataset {
      display: flex;
      flex-direction: row;
      align-items: center;
      margin-bottom: ${theme.marginMD}px;

      & > div {
        min-width: 200px;
        width: 300px;
      }

      & > span {
        color: ${theme.colorText};
        margin-left: ${theme.margin}px;
      }
    }

    & .viz-gallery {
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      margin: ${theme.marginXXS}px 0px;
      max-height: calc(100vh - ${ELEMENTS_EXCEPT_VIZ_GALLERY}px);
      flex: 1;
    }

    & .footer {
      flex: 1;
      display: flex;
      flex-direction: row;
      justify-content: flex-end;
      align-items: center;

      & > span {
        color: ${theme.colorText};
        margin-right: ${theme.margin}px;
      }
    }

    /* The following extra ampersands (&&&&) are used to boost selector specificity */

    &&&& .ant-steps-item-tail {
      display: none;
    }

    &&&& .ant-steps-item-icon {
      margin-right: ${theme.marginXS}px;
      width: ${theme.sizeUnit * 5}px;
      height: ${theme.sizeUnit * 5}px;
      line-height: ${theme.sizeUnit * 5}px;
    }

    &&&& .ant-steps-item-title {
      line-height: ${theme.sizeUnit * 5}px;
    }

    &&&& .ant-steps-item-content {
      overflow: unset;

      .ant-steps-item-description {
        margin-top: ${theme.sizeUnit}px;
        padding-bottom: ${theme.sizeUnit}px;
      }
    }

    &&&& .ant-tooltip-open {
      display: inline;
    }
  `}
`;

const StyledStepTitle = styled.span`
  ${({ theme: { fontSize, fontWeightStrong } }) => `
      font-size: ${fontSize}px;
      font-weight: ${fontWeightStrong};
    `}
`;

const StyledStepDescription = styled.div`
  ${({ theme }) => `
    margin-top: ${theme.margin}px;
    margin-bottom: ${theme.marginSM}px;
    margin-left: ${theme.marginMD}px;
  `}
`;

export const ChartCreation = ({
  user,
  addSuccessToast,
}: ChartCreationProps) => {
  const theme = useTheme();
  const history = useHistory();

  const canCreateDataset = useMemo(
    () => findPermission('can_write', 'Dataset', user.roles),
    [user.roles],
  );

  const hasDatasetParam = useMemo(
    () => new URLSearchParams(window.location.search).has('dataset'),
    [],
  );

  const [datasource, setDatasource] = useState<
    { label: string | ReactNode; value: string } | undefined
  >(undefined);
  const [vizType, setVizType] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(hasDatasetParam);

  const exploreUrl = useCallback(() => {
    const dashboardId = getUrlParam(URL_PARAMS.dashboardId);
    let url = `/explore/?viz_type=${vizType}&datasource=${datasource?.value}`;
    if (isDefined(dashboardId)) {
      url += `&dashboard_id=${dashboardId}`;
    }
    return url;
  }, [vizType, datasource?.value]);

  const gotoSlice = useCallback(() => {
    history.push(exploreUrl());
  }, [history, exploreUrl]);

  const changeDatasource = useCallback(
    (newDatasource: { label: string | ReactNode; value: string }) => {
      setDatasource(newDatasource);
    },
    [],
  );

  const changeVizType = useCallback((newVizType: string | null) => {
    setVizType(newVizType);
  }, []);

  const isBtnDisabled = useCallback(
    () => !(datasource?.value && vizType),
    [datasource?.value, vizType],
  );

  const onVizTypeDoubleClick = useCallback(() => {
    if (!isBtnDisabled()) {
      gotoSlice();
    }
  }, [isBtnDisabled, gotoSlice]);

  const loadDatasources = useCallback(
    (search: string, page: number, pageSize: number, exactMatch = false) => {
      const query = rison.encode({
        columns: [
          'id',
          'table_name',
          'datasource_type',
          'database.database_name',
          'schema',
        ],
        filters: [
          { col: 'table_name', opr: exactMatch ? 'eq' : 'ct', value: search },
        ],
        page,
        page_size: pageSize,
        order_column: 'table_name',
        order_direction: 'asc',
      });
      return SupersetClient.get({
        endpoint: `/api/v1/dataset/?q=${query}`,
      }).then((response: JsonResponse) => {
        const list: {
          id: number;
          label: string | ReactNode;
          value: string;
          table_name: string;
        }[] = response.json.result.map((item: Dataset) => ({
          id: item.id,
          value: `${item.id}__${item.datasource_type}`,
          label: DatasetSelectLabel(item),
          table_name: item.table_name,
        }));
        return {
          data: list,
          totalCount: response.json.count,
        };
      });
    },
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search).get('dataset');
    if (params) {
      loadDatasources(params, 0, 1, true)
        .then(r => {
          const newDatasource = r.data[0];
          setDatasource(newDatasource);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
      addSuccessToast(t('The dataset has been saved'));
    }
  }, [loadDatasources, addSuccessToast]);

  const isButtonDisabled = isBtnDisabled();
  const VIEW_INSTRUCTIONS_TEXT = t('view instructions');
  const datasetHelpText = canCreateDataset ? (
    <span data-test="dataset-write">
      <Link to="/dataset/add/" data-test="add-chart-new-dataset">
        {t('Add a dataset')}
      </Link>{' '}
      {t('or')}{' '}
      <a
        href="https://superset.apache.org/docs/creating-charts-dashboards/creating-your-first-dashboard/#registering-a-new-table"
        rel="noopener noreferrer"
        target="_blank"
        data-test="add-chart-new-dataset-instructions"
      >
        {`${VIEW_INSTRUCTIONS_TEXT} `}
        <Icons.Full iconSize="m" iconColor={theme.colorPrimary} />
      </a>
      .
    </span>
  ) : (
    <span data-test="no-dataset-write">
      <a
        href="https://superset.apache.org/docs/creating-charts-dashboards/creating-your-first-dashboard/#registering-a-new-table"
        rel="noopener noreferrer"
        target="_blank"
      >
        {`${VIEW_INSTRUCTIONS_TEXT} `}
        <Icons.Full iconSize="m" iconColor={theme.colorPrimary} />
      </a>
      .
    </span>
  );

  if (loading) {
    return <Loading />;
  }

  return (
    <StyledContainer>
      <h3>{t('Create a new chart')}</h3>
      <Steps direction="vertical" size="small">
        <Steps.Step
          title={<StyledStepTitle>{t('Choose a dataset')}</StyledStepTitle>}
          status={datasource?.value ? 'finish' : 'process'}
          description={
            <StyledStepDescription className="dataset">
              <AsyncSelect
                autoFocus
                ariaLabel={t('Dataset')}
                name="select-datasource"
                onChange={changeDatasource}
                options={loadDatasources}
                optionFilterProps={['id', 'table_name']}
                placeholder={t('Choose a dataset')}
                showSearch
                value={datasource}
              />
              {datasetHelpText}
            </StyledStepDescription>
          }
        />
        <Steps.Step
          title={<StyledStepTitle>{t('Choose chart type')}</StyledStepTitle>}
          status={vizType ? 'finish' : 'process'}
          description={
            <StyledStepDescription>
              <VizTypeGallery
                denyList={denyList}
                className="viz-gallery"
                onChange={changeVizType}
                onDoubleClick={onVizTypeDoubleClick}
                selectedViz={vizType}
              />
            </StyledStepDescription>
          }
        />
      </Steps>
      <div className="footer">
        {isButtonDisabled && (
          <span>
            {t('Please select both a Dataset and a Chart type to proceed')}
          </span>
        )}
        <Button
          buttonStyle="primary"
          disabled={isButtonDisabled}
          onClick={gotoSlice}
        >
          {t('Create new chart')}
        </Button>
      </div>
    </StyledContainer>
  );
};

export default withToasts(ChartCreation);
