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
import { QueryFormData } from '@superset-ui/core';
import { Slice } from 'src/types/Chart';
import withToasts from 'src/components/MessageToasts/withToasts';
import ExploreAdditionalActionsMenu from './ExploreAdditionalActionsMenu';

type ExploreActionButtonsProps = {
  actions: { redirectSQLLab: () => void; openPropertiesModal: () => void };
  canDownloadCSV: boolean;
  chartStatus: string;
  latestQueryFormData: QueryFormData;
  queriesResponse: {};
  slice: Slice;
  addDangerToast: Function;
  addSuccessToast: Function;
  canAddReports: boolean;
};

const ExploreActionButtons = (props: ExploreActionButtonsProps) => {
  const { actions, canDownloadCSV, latestQueryFormData, slice, canAddReports } =
    props;
  return (
    <ExploreAdditionalActionsMenu
      latestQueryFormData={latestQueryFormData}
      onOpenInEditor={actions.redirectSQLLab}
      onOpenPropertiesModal={actions.openPropertiesModal}
      slice={slice}
      canDownloadCSV={canDownloadCSV}
      canAddReports={canAddReports}
    />
  );
};

export default withToasts(ExploreActionButtons);
