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
import React, { ReactNode } from 'react';
import rison from 'rison';
import { styled, t, SupersetClient, JsonResponse } from '@superset-ui/core';
import { Steps } from 'src/common/components';
import Button from 'src/components/Button';
import { Select } from 'src/components';
import { FormLabel } from 'src/components/Form';
import { Tooltip } from 'src/components/Tooltip';

import VizTypeGallery, {
  MAX_ADVISABLE_VIZ_GALLERY_WIDTH,
} from 'src/explore/components/controls/VizTypeControl/VizTypeGallery';

type Dataset = {
  id: number;
  table_name: string;
  description: string;
  datasource_type: string;
};

export type AddSliceContainerProps = {};

export type AddSliceContainerState = {
  datasource?: { label: string; value: string };
  visType: string | null;
};

const ESTIMATED_NAV_HEIGHT = 56;
const ELEMENTS_EXCEPT_VIZ_GALLERY = ESTIMATED_NAV_HEIGHT + 250;

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
      margin-bottom: ${theme.gridUnit * 2}px;

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

    &&&& .ant-steps-item-tail {
      display: none;
    }

    &&&& .ant-steps-item-icon {
      margin-right: ${theme.gridUnit * 2}px;
      width: ${theme.gridUnit * 5}px;
      height: ${theme.gridUnit * 5}px;
      line-height: ${theme.gridUnit * 5}px;
    }

    &&&& .ant-steps-item-title {
      line-height: ${theme.gridUnit * 5}px;
    }

    &&&& .ant-steps-item-content {
      overflow: unset;

      .ant-steps-item-description {
        margin-top: ${theme.gridUnit}px;
      }
    }

    &&&& .ant-tooltip-open {
      display: inline;
    }

    &&&& .ant-select-selector {
      padding: 0;
    }

    &&&& .ant-select-selection-placeholder {
      padding-left: ${theme.gridUnit * 3}px;
    }
  `}
`;

const TooltipContent = styled.div<{ hasDescription: boolean }>`
  ${({ theme, hasDescription }) => `
    .tooltip-header {
      font-size: ${
        hasDescription ? theme.typography.sizes.l : theme.typography.sizes.s
      }px;
      font-weight: ${
        hasDescription
          ? theme.typography.weights.bold
          : theme.typography.weights.normal
      };
    }

    .tooltip-description {
      margin-top: ${theme.gridUnit * 2}px;
      display: -webkit-box;
      -webkit-line-clamp: 20;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `}
`;

const StyledLabel = styled.span`
  ${({ theme }) => `
    position: absolute;
    left: ${theme.gridUnit * 3}px;
    right: ${theme.gridUnit * 3}px;
    overflow: hidden;
    text-overflow: ellipsis;
  `}
`;

export default class AddSliceContainer extends React.PureComponent<
  AddSliceContainerProps,
  AddSliceContainerState
> {
  constructor(props: AddSliceContainerProps) {
    super(props);
    this.state = {
      visType: null,
    };

    this.changeDatasource = this.changeDatasource.bind(this);
    this.changeVisType = this.changeVisType.bind(this);
    this.gotoSlice = this.gotoSlice.bind(this);
    this.newLabel = this.newLabel.bind(this);
    this.loadDatasources = this.loadDatasources.bind(this);
  }

  exploreUrl() {
    const formData = encodeURIComponent(
      JSON.stringify({
        viz_type: this.state.visType,
        datasource: this.state.datasource?.value,
      }),
    );
    return `/superset/explore/?form_data=${formData}`;
  }

  gotoSlice() {
    window.location.href = this.exploreUrl();
  }

  changeDatasource(datasource: { label: string; value: string }) {
    this.setState({ datasource });
  }

  changeVisType(visType: string | null) {
    this.setState({ visType });
  }

  isBtnDisabled() {
    return !(this.state.datasource?.value && this.state.visType);
  }

  newLabel(item: Dataset) {
    return (
      <Tooltip
        mouseEnterDelay={1}
        placement="right"
        title={
          <TooltipContent hasDescription={!!item.description}>
            <div className="tooltip-header">{item.table_name}</div>
            {item.description && (
              <div className="tooltip-description">{item.description}</div>
            )}
          </TooltipContent>
        }
      >
        <StyledLabel>{item.table_name}</StyledLabel>
      </Tooltip>
    );
  }

  loadDatasources(search: string, page: number, pageSize: number) {
    const query = rison.encode({
      columns: ['id', 'table_name', 'description', 'datasource_type'],
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
        label: string;
        value: string;
      }[] = response.json.result
        .map((item: Dataset) => ({
          value: `${item.id}__${item.datasource_type}`,
          customLabel: this.newLabel(item),
          label: item.table_name,
        }))
        .sort((a: { label: string }, b: { label: string }) =>
          a.label.localeCompare(b.label),
        );
      return {
        data: list,
        totalCount: response.json.count,
      };
    });
  }

  render() {
    const isButtonDisabled = this.isBtnDisabled();
    return (
      <StyledContainer>
        <h3>{t('Create a new chart')}</h3>
        <Steps direction="vertical" size="small">
          <Steps.Step
            title={<FormLabel>{t('Choose a dataset')}</FormLabel>}
            status={this.state.datasource?.value ? 'finish' : 'process'}
            description={
              <div className="dataset">
                <Select
                  autoFocus
                  ariaLabel={t('Dataset')}
                  name="select-datasource"
                  onChange={this.changeDatasource}
                  options={this.loadDatasources}
                  placeholder={t('Choose a dataset')}
                  showSearch
                  value={this.state.datasource}
                />
                <span>
                  {t(
                    'Instructions to add a dataset are available in the Superset tutorial.',
                  )}{' '}
                  <a
                    href="https://superset.apache.org/docs/creating-charts-dashboards/first-dashboard#adding-a-new-table"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <i className="fa fa-external-link" />
                  </a>
                </span>
              </div>
            }
          />
          <Steps.Step
            title={<FormLabel>{t('Choose chart type')}</FormLabel>}
            status={this.state.visType ? 'finish' : 'process'}
            description={
              <VizTypeGallery
                className="viz-gallery"
                onChange={this.changeVisType}
                selectedViz={this.state.visType}
              />
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
