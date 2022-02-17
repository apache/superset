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
import { useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import Button from 'src/components/Button';
import { exploreChart } from 'src/explore/exploreUtils';
import { RootState } from 'src/SqlLab/types';

interface ExploreCtasResultsButtonProps {
  actions: {
    createCtasDatasource: Function;
    addInfoToast: Function;
    addDangerToast: Function;
  };
  table: string;
  schema?: string | null;
  dbId: number;
  templateParams?: string;
}

const ExploreCtasResultsButton = ({
  actions,
  table,
  schema,
  dbId,
  templateParams,
}: ExploreCtasResultsButtonProps) => {
  const { createCtasDatasource, addInfoToast, addDangerToast } = actions;
  const errorMessage = useSelector(
    (state: RootState) => state.sqlLab.errorMessage,
  );

  const buildVizOptions = {
    datasourceName: table,
    schema,
    dbId,
    templateParams,
  };

  const visualize = () => {
    createCtasDatasource(buildVizOptions)
      .then((data: { table_id: number }) => {
        const formData = {
          datasource: `${data.table_id}__table`,
          metrics: ['count'],
          groupby: [],
          viz_type: 'table',
          since: '100 years ago',
          all_columns: [],
          row_limit: 1000,
        };
        addInfoToast(t('Creating a data source and creating a new tab'));
        // open new window for data visualization
        exploreChart(formData);
      })
      .catch(() => {
        addDangerToast(errorMessage || t('An error occurred'));
      });
  };

  return (
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
  );
};

export default ExploreCtasResultsButton;
