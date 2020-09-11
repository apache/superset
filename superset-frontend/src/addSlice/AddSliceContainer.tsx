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
import { Panel } from 'react-bootstrap';
import Button from 'src/components/Button';
import Select from 'src/components/Select';
import { t } from '@superset-ui/core';

import VizTypeControl from '../explore/components/controls/VizTypeControl';

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
  visType: string;
};

const styleSelectWidth = { width: 600 };

export default class AddSliceContainer extends React.PureComponent<
  AddSliceContainerProps,
  AddSliceContainerState
> {
  constructor(props: AddSliceContainerProps) {
    super(props);
    this.state = {
      visType: 'table',
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
      datasourceType: option.value.split('__')[1],
    });
  }

  changeVisType(visType: string) {
    this.setState({ visType });
  }

  isBtnDisabled() {
    return !(this.state.datasourceId && this.state.visType);
  }

  render() {
    return (
      <div className="container">
        <Panel>
          <Panel.Heading>
            <h3>{t('Create a new chart')}</h3>
          </Panel.Heading>
          <Panel.Body>
            <div>
              <p>{t('Choose a datasource')}</p>
              <p>
                <div style={styleSelectWidth}>
                  <Select
                    clearable={false}
                    ignoreAccents={false}
                    name="select-datasource"
                    onChange={this.changeDatasource}
                    options={this.props.datasources}
                    placeholder={t('Choose a datasource')}
                    style={styleSelectWidth}
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
              </p>
              <span className="text-muted">
                {t(
                  'If the datasource you are looking for is not available in the list, follow the instructions on how to add it in the Superset tutorial.',
                )}{' '}
                <a
                  href="https://superset.apache.org/tutorial.html#adding-a-new-table"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <i className="fa fa-external-link" />
                </a>
              </span>
            </div>
            <br />
            <div>
              <p>{t('Choose a visualization type')}</p>
              <VizTypeControl
                name="select-vis-type"
                onChange={this.changeVisType}
                value={this.state.visType}
              />
            </div>
            <br />
            <hr />
            <Button
              buttonStyle="primary"
              disabled={this.isBtnDisabled()}
              onClick={this.gotoSlice}
            >
              {t('Create new chart')}
            </Button>
            <br />
            <br />
          </Panel.Body>
        </Panel>
      </div>
    );
  }
}
