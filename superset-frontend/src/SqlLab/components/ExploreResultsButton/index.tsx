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
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import Button, { OnClickHandler } from 'src/components/Button';

export interface ExploreResultsButtonProps {
  database?: {
    allows_subquery?: boolean;
  };
  onClick: OnClickHandler;
}

const ExploreResultsButton = ({
  database,
  onClick,
}: ExploreResultsButtonProps) => {
  const allowsSubquery = database?.allows_subquery ?? false;
  return (
    <Button
      buttonSize="small"
      onClick={onClick}
      disabled={!allowsSubquery}
      tooltip={t('Explore the result set in the data exploration view')}
      data-test="explore-results-button"
    >
      <InfoTooltipWithTrigger
        icon="line-chart"
        placement="top"
        label={t('explore')}
      />{' '}
      {t('Create Chart')}
    </Button>
  );
};

export default ExploreResultsButton;
