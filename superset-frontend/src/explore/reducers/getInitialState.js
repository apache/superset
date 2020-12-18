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
import shortid from 'shortid';

import getToastsFromPyFlashMessages from '../../messageToasts/utils/getToastsFromPyFlashMessages';
import { getChartKey } from '../exploreUtils';
import { getControlsState } from '../store';
import {
  getFormDataFromControls,
  applyMapStateToPropsToControl,
} from '../controlUtils';

export default function getInitialState(bootstrapData) {
  const { form_data: rawFormData } = bootstrapData;
  const { slice } = bootstrapData;
  const sliceName = slice ? slice.slice_name : null;
  const bootstrappedState = {
    ...bootstrapData,
    sliceName,
    common: {
      flash_messages: bootstrapData.common.flash_messages,
      conf: bootstrapData.common.conf,
    },
    rawFormData,
    filterColumnOpts: [],
    isDatasourceMetaLoading: false,
    isStarred: false,
  };
  const controls = getControlsState(bootstrappedState, rawFormData);
  bootstrappedState.controls = controls;

  // apply initial mapStateToProps for all controls, must execute AFTER
  // bootstrappedState has initialized `controls`. Order of execution is not
  // guaranteed, so controls shouldn't rely on the each other's mapped state.
  Object.entries(controls).forEach(([key, controlState]) => {
    controls[key] = applyMapStateToPropsToControl(
      controlState,
      bootstrappedState,
    );
  });

  const sliceFormData = slice
    ? getFormDataFromControls(getControlsState(bootstrapData, slice.form_data))
    : null;

  const chartKey = getChartKey(bootstrappedState);

  return {
    charts: {
      [chartKey]: {
        id: chartKey,
        chartAlert: null,
        chartStatus: null,
        chartUpdateEndTime: null,
        chartUpdateStartTime: 0,
        latestQueryFormData: getFormDataFromControls(controls),
        sliceFormData,
        queryController: null,
        queriesResponse: null,
        triggerQuery: false,
        lastRendered: 0,
      },
    },
    saveModal: {
      dashboards: [],
      saveModalAlert: null,
    },
    explore: bootstrappedState,
    impressionId: shortid.generate(),
    messageToasts: getToastsFromPyFlashMessages(
      (bootstrapData.common || {}).flash_messages || [],
    ),
  };
}
