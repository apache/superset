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
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import Alert from 'src/components/Alert';
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import shortid from 'shortid';
import Button, { OnClickHandler } from 'src/components/Button';
import { Query } from 'src/SqlLab/types';
import rootReducer from 'src/SqlLab/reducers';

type RootState = ReturnType<typeof rootReducer>;

interface ExploreResultsButtonProps {
  query?: Query;
  database: {
    allows_subquery?: boolean;
  };
  onClick: OnClickHandler;
}

const ExploreResultsButton: FC<ExploreResultsButtonProps> = ({
  query = {},
  database,
  onClick,
}) => {
  const dispatch = useDispatch();
  const conf = useSelector(
    (state: RootState) => state.common.conf,
  );
  const timeout = conf ? conf.SUPERSET_WEBSERVER_TIMEOUT : null;

  const getColumns = () => query?.results?.selected_columns ?? [];

  const getQueryDuration = () => {
    return moment
      .duration(query.endDttm - query.startDttm)
      .asSeconds();
  };

  const getInvalidColumns = () => {
    const re1 = /__\d+$/; // duplicate column name pattern
    const re2 = /^__timestamp/i; // reserved temporal column alias

    return query.results.selected_columns
      .map(col => col.name)
      .filter(col => re1.test(col) || re2.test(col));
  };

  const datasourceName = () => {
    const uniqueId = shortid.generate();
    let datasourceName = uniqueId;
    if (query) {
      datasourceName = query.user ? `${query.user}-` : '';
      datasourceName += `${query.tab}-${uniqueId}`;
    }
    return datasourceName;
  };

  const buildVizOptions = () => {
    const { schema, sql, dbId, templateParams } = query;
    return {
      dbId,
      schema,
      sql,
      templateParams,
      datasourceName: datasourceName(),
      columns: getColumns(),
    };
  };

  const renderTimeoutWarning = () => {
    return (
      <Alert
        type="warning"
        message={
          <>
            {t(
              'This query took %s seconds to run, ',
              Math.round(getQueryDuration()),
            ) +
              t(
                'and the explore view times out at %s seconds ',
                dispatch(timeout),
              ) +
              t(
                'following this flow will most likely lead to your query timing out. ',
              ) +
              t(
                'We recommend your summarize your data further before following that flow. ',
              ) +
              t('If activated you can use the ')}
            <strong>CREATE TABLE AS </strong>
            {t(
              'feature to store a summarized data set that you can then explore.',
            )}
          </>
        }
      />
    );
  };

  const renderInvalidColumnMessage = () => {
    const invalidColumns = getInvalidColumns();
    if (invalidColumns.length === 0) {
      return null;
    }
    return (
      <div>
        {t('Column name(s) ')}
        <code>
          <strong>{invalidColumns.join(', ')} </strong>
        </code>
        {t(`cannot be used as a column name. The column name/alias "__timestamp"
          is reserved for the main temporal expression, and column aliases ending with
          double underscores followed by a numeric value (e.g. "my_col__1") are reserved
          for deduplicating duplicate column names. Please use aliases to rename the
          invalid column names.`)}
      </div>
    );
  };

  const allowsSubquery = database && database.allows_subquery;
  return (
    <>
      <Button
        buttonSize="small"
        onClick={onClick}
        disabled={!allowsSubquery}
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

export default ExploreResultsButton;
