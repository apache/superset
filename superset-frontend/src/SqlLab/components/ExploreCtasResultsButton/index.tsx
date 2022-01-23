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
import React, { FC } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import Button from 'src/components/Button';
import { exploreChart } from 'src/explore/exploreUtils';
import * as actions from 'src/SqlLab/actions/sqlLab';

interface IExploreCtasResultsButtonProps {
  actions: {
  };
  table: string;
  schema?: string;
  dbId: number;
  errorMessage?: string;
  templateParams?: string;
}

const ExploreCtasResultsButton: FC<IExploreCtasResultsButtonProps> = ({
  actions,
  table,
  schema,
  dbId,
  errorMessage,
  templateParams,
}) => {
  const buildVizOptions = () => {
    return {
      datasourceName: table,
      schema: schema,
      dbId: dbId,
      templateParams: templateParams,
    };
  }

  const visualize = () => {
    actions.createCtasDatasource(buildVizOptions())
      .then(data => {
        const formData = {
          datasource: `${data.table_id}__table`,
          metrics: ['count'],
          groupby: [],
          viz_type: 'table',
          since: '100 years ago',
          all_columns: [],
          row_limit: 1000,
        };
        actions.addInfoToast(
          t('Creating a data source and creating a new tab'),
        );

        // open new window for data visualization
        exploreChart(formData);
      })
      .catch(() => {
        actions.addDangerToast(
          errorMessage || t('An error occurred'),
        );
      });
  };

  return (
    <>
      <Button
        buttonSize="small"
        onClick={visualize}
        tooltip={t('Explore the result set in the data exploration view')}
      >
        <InfoTooltipWithTrigger
          icon="line-chart"
          placement="top"
          label="explore"
        />{' '}
        {t('Explore')}
      </Button>
    </>
  );
};

function mapStateToProps({ sqlLab, common }) {
  return {
    errorMessage: sqlLab.errorMessage,
    timeout: common.conf ? common.conf.SUPERSET_WEBSERVER_TIMEOUT : null,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ExploreCtasResultsButton);
