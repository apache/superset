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
import React from 'react';
import Button from 'src/components/Button';
import Select from 'src/components/Select';
import { css, styled, t } from '@superset-ui/core';

import VizTypeGallery, {
  MAX_ADVISABLE_VIZ_GALLERY_WIDTH,
} from 'src/explore/components/controls/VizTypeControl/VizTypeGallery';

interface Datasource {
  label: string;
  value: string;
}

export type AddSliceContainerProps = {
  datasources: Datasource[];
};

export type AddSliceContainerState = {
  datasourceId?: string;
  datasourceType?: string;
  datasourceValue?: string;
  visType: string | null;
};

const ESTIMATED_NAV_HEIGHT = '56px';
const styleSelectContainer = { width: 600, marginBottom: '10px' };
const StyledContainer = styled.div`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  max-width: ${MAX_ADVISABLE_VIZ_GALLERY_WIDTH}px;
  max-height: calc(100vh - ${ESTIMATED_NAV_HEIGHT});
  border-radius: ${({ theme }) => theme.gridUnit}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  padding-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  h3 {
    padding-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
`;

const cssStatic = css`
  flex: 0 0 auto;
`;

const StyledVizTypeGallery = styled(VizTypeGallery)`
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  margin: ${({ theme }) => theme.gridUnit * 3}px 0px;
  flex: 1 1 auto;
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
  }

  exploreUrl() {
    const formData = encodeURIComponent(
      JSON.stringify({
        viz_type: this.state.visType,
        datasource: this.state.datasourceValue,
      }),
    );
    return `/superset/explore/?form_data=${formData}`;
  }

  gotoSlice() {
    window.location.href = this.exploreUrl();
  }

  changeDatasource(option: { value: string }) {
    this.setState({
      datasourceValue: option.value,
      datasourceId: option.value.split('__')[0],
    });
  }

  changeVisType(visType: string | null) {
    this.setState({ visType });
  }

  isBtnDisabled() {
    return !(this.state.datasourceId && this.state.visType);
  }

  render() {
    return (
      <StyledContainer className="container">
        <h3 css={cssStatic}>{t('Create a new chart')}</h3>
        <div css={cssStatic}>
          <p>{t('Choose a dataset')}</p>
          <div style={styleSelectContainer}>
            <Select
              clearable={false}
              ignoreAccents={false}
              name="select-datasource"
              onChange={this.changeDatasource}
              options={this.props.datasources}
              placeholder={t('Choose a dataset')}
              value={
                this.state.datasourceValue
                  ? {
                      value: this.state.datasourceValue,
                    }
                  : undefined
              }
              width={600}
            />
          </div>
          <span className="text-muted">
            {t(
              'If the dataset you are looking for is not available in the list, follow the instructions on how to add it in the Superset tutorial.',
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
        <StyledVizTypeGallery
          onChange={this.changeVisType}
          selectedViz={this.state.visType}
        />
        <Button
          css={[
            cssStatic,
            css`
              align-self: flex-end;
            `,
          ]}
          buttonStyle="primary"
          disabled={this.isBtnDisabled()}
          onClick={this.gotoSlice}
        >
          {t('Create new chart')}
        </Button>
      </StyledContainer>
    );
  }
}
