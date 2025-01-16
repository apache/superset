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
import { PureComponent, ReactNode } from 'react';
import rison from 'rison';
import querystring from 'query-string';
import {
  isDefined,
  JsonResponse,
  styled,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { getUrlParam } from 'src/utils/urlUtils';
import { FilterPlugins, URL_PARAMS } from 'src/constants';
import { Link, withRouter, RouteComponentProps } from 'react-router-dom';
import Button from 'src/components/Button';
import { AsyncSelect } from 'src/components';
import { Steps } from 'src/components/Steps';
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

export interface ChartCreationProps extends RouteComponentProps {
  user: UserWithPermissionsAndRoles;
  addSuccessToast: (arg: string) => void;
}

export type ChartCreationState = {
  datasource?: { label: string; value: string };
  datasetName?: string | string[] | null;
  vizType: string | null;
  canCreateDataset: boolean;
};

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
    border-radius: ${theme.gridUnit}px;
    background-color: ${theme.colors.grayscale.light5};
    margin-left: auto;
    margin-right: auto;
    padding-left: ${theme.gridUnit * 4}px;
    padding-right: ${theme.gridUnit * 4}px;
    padding-bottom: ${theme.gridUnit * 4}px;

    h3 {
      padding-bottom: ${theme.gridUnit * 3}px;
    }

    & .dataset {
      display: flex;
      flex-direction: row;
      align-items: center;
      margin-bottom: ${theme.gridUnit * 5}px;

      & > div {
        min-width: 200px;
        width: 300px;
      }

      & > span {
        color: ${theme.colors.grayscale.light1};
        margin-left: ${theme.gridUnit * 4}px;
      }
    }

    & .viz-gallery {
      border: 1px solid ${theme.colors.grayscale.light2};
      border-radius: ${theme.gridUnit}px;
      margin: ${theme.gridUnit}px 0px;
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
        color: ${theme.colors.grayscale.light1};
        margin-right: ${theme.gridUnit * 4}px;
      }
    }

    /* The following extra ampersands (&&&&) are used to boost selector specificity */

    &&&& .antd5-steps-item-tail {
      display: none;
    }

    &&&& .antd5-steps-item-icon {
      margin-right: ${theme.gridUnit * 2}px;
      width: ${theme.gridUnit * 5}px;
      height: ${theme.gridUnit * 5}px;
      line-height: ${theme.gridUnit * 5}px;
    }

    &&&& .antd5-steps-item-title {
      line-height: ${theme.gridUnit * 5}px;
    }

    &&&& .antd5-steps-item-content {
      overflow: unset;

      .antd5-steps-item-description {
        margin-top: ${theme.gridUnit}px;
        padding-bottom: ${theme.gridUnit}px;
      }
    }

    &&&& .antd5-tooltip-open {
      display: inline;
    }

    &&&& .ant-select-selector {
      padding: 0;
    }

    &&&& .ant-select-selection-placeholder {
      padding-left: ${theme.gridUnit * 3}px;
    }

    &&&& .ant-select-selection-item {
      padding-left: ${theme.gridUnit * 3}px;
    }
  `}
`;

const StyledStepTitle = styled.span`
  ${({
    theme: {
      typography: { sizes, weights },
    },
  }) => `
      font-size: ${sizes.m}px;
      font-weight: ${weights.bold};
    `}
`;

const StyledStepDescription = styled.div`
  ${({ theme: { gridUnit } }) => `
    margin-top: ${gridUnit * 4}px;
    margin-bottom: ${gridUnit * 3}px;
  `}
`;

export class ChartCreation extends PureComponent<
  ChartCreationProps,
  ChartCreationState
> {
  constructor(props: ChartCreationProps) {
    super(props);
    this.state = {
      vizType: null,
      canCreateDataset: findPermission(
        'can_write',
        'Dataset',
        props.user.roles,
      ),
    };

    this.changeDatasource = this.changeDatasource.bind(this);
    this.changeVizType = this.changeVizType.bind(this);
    this.gotoSlice = this.gotoSlice.bind(this);
    this.loadDatasources = this.loadDatasources.bind(this);
    this.onVizTypeDoubleClick = this.onVizTypeDoubleClick.bind(this);
  }

  componentDidMount() {
    const params = querystring.parse(window.location.search)?.dataset as string;
    if (params) {
      this.loadDatasources(params, 0, 1).then(r => {
        const datasource = r.data[0];
        // override here to force styling of option label
        // which expects a reactnode instead of string
        // @ts-expect-error
        datasource.label = datasource.customLabel;
        this.setState({ datasource });
      });
      this.props.addSuccessToast(t('The dataset has been saved'));
    }
  }

  exploreUrl() {
    const dashboardId = getUrlParam(URL_PARAMS.dashboardId);
    let url = `/explore/?viz_type=${this.state.vizType}&datasource=${this.state.datasource?.value}`;
    if (isDefined(dashboardId)) {
      url += `&dashboard_id=${dashboardId}`;
    }
    return url;
  }

  gotoSlice() {
    this.props.history.push(this.exploreUrl());
  }

  changeDatasource(datasource: { label: string; value: string }) {
    this.setState({ datasource });
  }

  changeVizType(vizType: string | null) {
    this.setState({ vizType });
  }

  isBtnDisabled() {
    return !(this.state.datasource?.value && this.state.vizType);
  }

  onVizTypeDoubleClick() {
    if (!this.isBtnDisabled()) {
      this.gotoSlice();
    }
  }

  loadDatasources(search: string, page: number, pageSize: number) {
    const query = rison.encode({
      columns: [
        'id',
        'table_name',
        'datasource_type',
        'database.database_name',
        'schema',
      ],
      filters: [{ col: 'table_name', opr: 'ct', value: search }],
      page,
      page_size: pageSize,
      order_column: 'table_name',
      order_direction: 'asc',
    });
    return SupersetClient.get({
      endpoint: `/api/v1/dataset/?q=${query}`,
    }).then((response: JsonResponse) => {
      const list: {
        customLabel: ReactNode;
        id: number;
        label: string;
        value: string;
      }[] = response.json.result.map((item: Dataset) => ({
        id: item.id,
        value: `${item.id}__${item.datasource_type}`,
        customLabel: DatasetSelectLabel(item),
        label: item.table_name,
      }));
      return {
        data: list,
        totalCount: response.json.count,
      };
    });
  }

  render() {
    const isButtonDisabled = this.isBtnDisabled();
    const VIEW_INSTRUCTIONS_TEXT = t('view instructions');
    const datasetHelpText = this.state.canCreateDataset ? (
      <span data-test="dataset-write">
        <Link to="/dataset/add/" data-test="add-chart-new-dataset">
          {t('Add a dataset')}{' '}
        </Link>
        {t('or')}{' '}
        <a
          href="https://superset.apache.org/docs/creating-charts-dashboards/creating-your-first-dashboard/#registering-a-new-table"
          rel="noopener noreferrer"
          target="_blank"
          data-test="add-chart-new-dataset-instructions"
        >
          {`${VIEW_INSTRUCTIONS_TEXT} `}
          <i className="fa fa-external-link" />
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
          <i className="fa fa-external-link" />
        </a>
        .
      </span>
    );

    return (
      <StyledContainer>
        <h3>{t('Create a new chart')}</h3>
        <Steps direction="vertical" size="small">
          <Steps.Step
            title={<StyledStepTitle>{t('Choose a dataset')}</StyledStepTitle>}
            status={this.state.datasource?.value ? 'finish' : 'process'}
            description={
              <StyledStepDescription className="dataset">
                <AsyncSelect
                  autoFocus
                  ariaLabel={t('Dataset')}
                  name="select-datasource"
                  onChange={this.changeDatasource}
                  options={this.loadDatasources}
                  optionFilterProps={['id', 'label']}
                  placeholder={t('Choose a dataset')}
                  showSearch
                  value={this.state.datasource}
                />
                {datasetHelpText}
              </StyledStepDescription>
            }
          />
          <Steps.Step
            title={<StyledStepTitle>{t('Choose chart type')}</StyledStepTitle>}
            status={this.state.vizType ? 'finish' : 'process'}
            description={
              <StyledStepDescription>
                <VizTypeGallery
                  denyList={denyList}
                  className="viz-gallery"
                  onChange={this.changeVizType}
                  onDoubleClick={this.onVizTypeDoubleClick}
                  selectedViz={this.state.vizType}
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
            onClick={this.gotoSlice}
          >
            {t('Create new chart')}
          </Button>
        </div>
      </StyledContainer>
    );
  }
}

export default withRouter(withToasts(ChartCreation));
