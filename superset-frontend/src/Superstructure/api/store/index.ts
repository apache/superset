import { createStore, combineReducers } from 'redux';
import { authReducer, configReducer } from './reducers';

const APIStore = createStore(
  combineReducers({
    authReducer,
    configReducer,
  }),
);
export { APIStore };
