import { convertQuerySettingsToFormData } from '../formDataUtils/convertToFormData';

import { fetchDatasources, fetchDatasourceMetadata } from './refDataActions';
import { UPDATE_FORM_DATA, setError, setAutoRun, importFormData } from './globalActions';
import { runQuery } from './vizDataActions';

export const SET_DEFAULTS = 'SET_DEFAULTS';
export function setDefaults(refData) {
  return { type: SET_DEFAULTS, refData };
}

export const SET_DATASOURCE = 'SET_DATASOURCE';
export function setDatasource(uid, init = true) {
  return (dispatch, getState) => {
    if (getState().settings.future.length === 0 &&
        getState().settings.present.query.datasource === uid &&
        getState().refData.columns.length) {
      return Promise.resolve();
    }
    return dispatch(fetchDatasourceMetadata(uid))
        .then(() => dispatch({
          type: SET_DATASOURCE,
          uid,
          name: (getState()
                  .refData
                  .datasources.find(x => x.uid === uid) || {}).name,
        }))
        .then(() => init ? dispatch(
            setDefaults(getState().refData)) : Promise.resolve());
  };
}

export const BOOTSTRAP = 'BOOTSTRAP';
export function bootstrap(formData) {
  return (dispatch, getState) =>
    dispatch(fetchDatasources()).then(() => {
      const datasource = getState().settings.present.query.datasource;
      if (formData.datasource) {
        return Promise.resolve(dispatch(setAutoRun(false)))
            .then(() => dispatch(setDatasource(formData.datasource, false)))
            .then(() => dispatch(importFormData(formData, getState().refData)))
            .then(() => dispatch(setAutoRun(true)));
      } else if (datasource) {
        return dispatch(setDatasource(datasource, false));
      }
      return Promise.resolve();
    });
}

export function updateFormDataAndRunQuery(settings) {
  return (dispatch) => {
    const formData = convertQuerySettingsToFormData(settings);
    return Promise.resolve(
        dispatch({ type: UPDATE_FORM_DATA, formData, wipeData: true }))
        .then(() => dispatch(setError(formData.error)))
        .then(() => dispatch(runQuery()));
  };
}

export const TOGGLE_METRIC = 'TOGGLE_METRIC';
export function toggleMetric(metric) {
  return { type: TOGGLE_METRIC, metric };
}

export const ADD_FILTER = 'ADD_FILTER';
export function addFilter(filter) {
  return { type: ADD_FILTER, filter };
}

export const CONFIGURE_FILTER = 'CONFIGURE_FILTER';
export function configureFilter(filter) {
  return { type: CONFIGURE_FILTER, filter };
}

export const REMOVE_FILTER = 'REMOVE_FILTER';
export function removeFilter(filter) {
  return { type: REMOVE_FILTER, filter };
}

export const ADD_SPLIT = 'ADD_SPLIT';
export function addSplit(split) {
  return { type: ADD_SPLIT, split };
}

export const CONFIGURE_SPLIT = 'CONFIGURE_SPLIT';
export function configureSplit(split) {
  return { type: CONFIGURE_SPLIT, split };
}

export const REMOVE_SPLIT = 'REMOVE_SPLIT';
export function removeSplit(split) {
  return { type: REMOVE_SPLIT, split };
}

export const CHANGE_INTERVAL = 'CHANGE_INTERVAL';
export function changeInterval(intervalStart, intervalEnd) {
  return { type: CHANGE_INTERVAL, intervalStart, intervalEnd };
}

// TODO need to move those to the vizSettings
export const SET_VIZTYPE = 'SET_VIZTYPE';
export function setVizType(vizType) {
  return { type: SET_VIZTYPE, vizType };
}

