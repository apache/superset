import { SET_DATASOURCE } from '../actions/datasources';

export default function datasourceReducer(datasources = {}, action) {
  const actionHandlers = {
    [SET_DATASOURCE]() {
      return action.datasource;
    },
  };

  if (action.type in actionHandlers) {
    return {
      ...datasources,
      [action.key]: actionHandlers[action.type](
        datasources[action.key],
        action,
      ),
    };
  }
  return datasources;
}
