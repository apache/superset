import shortid from 'shortid';

import getToastsFromPyFlashMessages from '../../messageToasts/utils/getToastsFromPyFlashMessages';
import { now } from '../../modules/dates';
import { getChartKey } from '../exploreUtils';
import { getControlsState, getFormDataFromControls } from '../store';

export default function getInitialState(bootstrapData) {
  const controls = getControlsState(bootstrapData, bootstrapData.form_data);
  const rawFormData = { ...bootstrapData.form_data };

  const bootstrappedState = {
    ...bootstrapData,
    common: {
      flash_messages: bootstrapData.common.flash_messages,
      conf: bootstrapData.common.conf,
    },
    rawFormData,
    controls,
    filterColumnOpts: [],
    isDatasourceMetaLoading: false,
    isStarred: false,
  };

  const slice = bootstrappedState.slice;

  const sliceFormData = slice
    ? getFormDataFromControls(getControlsState(bootstrapData, slice.form_data))
    : null;

  const chartKey = getChartKey(bootstrappedState);

  return {
    featureFlags: bootstrapData.common.feature_flags,
    charts: {
      [chartKey]: {
        id: chartKey,
        chartAlert: null,
        chartStatus: 'loading',
        chartUpdateEndTime: null,
        chartUpdateStartTime: now(),
        latestQueryFormData: getFormDataFromControls(controls),
        sliceFormData,
        queryController: null,
        queryResponse: null,
        triggerQuery: true,
        lastRendered: 0,
      },
    },
    saveModal: {
      dashboards: [],
      saveModalAlert: null,
    },
    explore: bootstrappedState,
    impressionId: shortid.generate(),
    messageToasts: getToastsFromPyFlashMessages((bootstrapData.common || {}).flash_messages || []),
  };
}
