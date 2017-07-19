import { setError, setRun, setIsRunning } from './globalActions';

export const SET_DATA = 'SET_DATA';
export function setData(data) {
  return { type: SET_DATA, data };
}

export const SET_OUTDATED = 'SET_OUTDATED';
export function setOutdated(outdated) {
  return { type: SET_OUTDATED, outdated };
}

export const RESET_DATA = 'RESET_DATA';
export function resetData() {
  return { type: RESET_DATA };
}

export function runQuery() {
  return (dispatch, getState) => {
    const { vizData, controls, settings } = getState();
    const payload = vizData.formData;
    if (!controls.error) {
      const datasource = settings.present.query.datasource;
      const [dsId, dsType] = datasource.split('__');
      const url = `${window.location.origin}/superset/explore_json/${dsType}/${dsId}`;
      const queryRequest = $.ajax({
        method: 'POST',
        url,
        dataType: 'json',
        contentType: 'application/json; charset=UTF-8',
        timeout: 300000,  // 5 Min
        data: payload.toJson() });
      return Promise.resolve(dispatch(setIsRunning(true, queryRequest)))
          .then(() => queryRequest)
          .then(data => Promise.all([
            dispatch(setData(data.data)),
            dispatch(setRun(false)),
            dispatch(setOutdated(false)),
            dispatch(setIsRunning(false, queryRequest))]))
          .catch(function (res) {
            if (res.status === 0) {
              return Promise.all([
                dispatch(setRun(false)),
                dispatch(setOutdated(true)),
                dispatch(setIsRunning(false, queryRequest))]);
            }
            let error;
            if (res.responseJSON) {
              error = res.responseJSON.error;
            } else {
              error = 'Server error';
            }
            return Promise.all([
              dispatch(setIsRunning(false, queryRequest)),
              dispatch(setData()),
              dispatch(setError(error)),
              dispatch(setOutdated(false)),
            ]);
          });
    }
    return Promise.resolve(dispatch(setOutdated(false)));
  };
}
