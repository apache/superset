// Aborts the current query
export const ABORT = 'ABORT';
export function abort() {
  return { type: ABORT };
}

export const RESET = 'RESET';
export const CLEAR_HISTORY = 'CLEAR_HISTORY';
export function reset(clearHistory) {
  if (clearHistory) {
    return dispatch =>
        // We need the sandwich to make sure there is enough space in the
        // local storage to RESET
        Promise.resolve(dispatch({ type: ABORT }))
            .then(() => dispatch({ type: CLEAR_HISTORY }))
            .then(() => dispatch({ type: RESET }))
            .then(() => dispatch({ type: CLEAR_HISTORY }));
  }
  return dispatch =>
      Promise.resolve(dispatch({ type: ABORT }))
          .then(() => dispatch({ type: RESET }));
}

// This controls whether a query should be run
export const SET_RUN = 'SET_RUN';
export function setRun(run) {
  return { type: SET_RUN, run };
}

// This controls if a query should automatically run if the query settings change
export const SET_AUTO_RUN = 'SET_AUTO_RUN';
export function setAutoRun(autoRun) {
  return { type: SET_AUTO_RUN, autoRun };
}

// This indicates if a query is currently running
export const SET_IS_RUNNING = 'SET_IS_RUNNING';
export function setIsRunning(isRunning, queryRequest) {
  return { type: SET_IS_RUNNING, isRunning, queryRequest };
}

export const SET_ERROR = 'SET_ERROR';
export function setError(error) {
  return { type: SET_ERROR, error };
}

export const UPDATE_FORM_DATA = 'UPDATE_FORM_DATA';
export const IMPORT_FORM_DATA = 'IMPORT_FORM_DATA';
export function importFormData(formData, refData) {
  return { type: IMPORT_FORM_DATA, formData, refData };
}
