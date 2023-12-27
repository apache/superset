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
import querystring from 'query-string';
import {
  isFeatureEnabled,
  FeatureFlag,
  isDefined,
  JsonResponse,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import withToasts from 'src/components/MessageToasts/withToasts';
import { findPermission } from 'src/utils/findPermission';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import getBootstrapData from 'src/utils/getBootstrapData';
import {
  Dataset,
  DatasetSelectLabel,
} from 'src/features/datasets/DatasetSelectLabel';
import DvtVizTypeGallery from 'src/explore/components/controls/VizTypeControl/DvtVizTypeGallery';

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

const bootstrapData = getBootstrapData();
const denyList: string[] = bootstrapData.common.conf.VIZ_TYPE_DENYLIST || [];

if (
  isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS) &&
  !denyList.includes('filter_box')
) {
  denyList.push('filter_box');
}


export class ChartCreation extends React.PureComponent<
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

    return (

                <DvtVizTypeGallery
                  denyList={denyList}
                  className="viz-gallery"
                  onChange={this.changeVizType}
                  onDoubleClick={this.onVizTypeDoubleClick}
                  selectedViz={this.state.vizType}
                />

    );
  }
}

export default withRouter(withToasts(ChartCreation));
