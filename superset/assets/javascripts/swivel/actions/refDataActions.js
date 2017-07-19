import ColumnTypes from '../ColumnTypes';

export const SET_COLUMNS = 'SET_COLUMNS';
export function setColumns(columns) {
  return { type: SET_COLUMNS, columns };
}

export const SET_DATASOURCES = 'SET_DATASOURCES';
export function setDatasources(datasources) {
  return { type: SET_DATASOURCES, datasources };
}

export const SET_METRICS = 'SET_METRICS';
export function setMetrics(metrics) {
  return { type: SET_METRICS, metrics };
}

export const SET_TIME_GRAINS = 'SET_TIME_GRAINS';
export function setTimeGrains(timeGrains) {
  return { type: SET_TIME_GRAINS, timeGrains };
}

export function fetchDatasources() {
  return dispatch => fetch('/superset/datasources/', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
  }).then(response => response.json()).then((data) => {
    const datasources = data.map(x => ({
      uid: x.uid,
      name: x.name,
      type: x.type,
      id: x.id }));
    return datasources;
  }).then(datasources => dispatch(setDatasources(datasources)));
}

export function fetchDatasourceMetadata(uid) {
  return function (dispatch) {
    if (!uid) {
      return Promise.resolve();
    }
    const url = `/swivel/fetch_datasource_metadata?uid=${uid}`;
    return fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
    }).then(response => response.json()).then((data) => {
      const columns = data.columns
            .filter(x => x.groupable ||
                x.filterable ||
                (x.type !== ColumnTypes.NUMERIC)).map(x => ({
                  name: x.name,
                  id: x.id,
                  columnType: x.type,
                  groupable: x.groupable,
                }));
      const metrics = data.metrics.map(x => ({
        name: x.name,
        id: x.id,
        format: x.format,
      }));
      const timeGrains = data.time_grains;

        // Todo: this is hacky should be done better
      if (uid.endsWith('druid')) {
        let timeColumn = columns.find(x =>
              x.id.toLowerCase() === '__time');
        if (!timeColumn) {
          timeColumn = {
            name: 'Time',
            id: '__time',
          };
          columns.push(timeColumn);
        }
        timeColumn.columnType = ColumnTypes.TIMESTAMP;
        timeColumn.groupable = false;
      }

      return Promise.all([
        dispatch(setColumns(columns)),
        dispatch(setMetrics(metrics)),
        dispatch(setTimeGrains(timeGrains)),
      ]);
    });
  };
}
