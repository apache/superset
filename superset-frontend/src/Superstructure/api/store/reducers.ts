import { authActionTypes, configActionTypes } from './actions';

function authReducer(
  APIState = {
    Authorization: '',
    'x-csrftoken': '',
  },
  action: { type: string; payload: any },
) {
  switch (action.type) {
    case authActionTypes.UPDATE_JWT:
      return { ...APIState, Authorization: `Bearer ${action.payload}` };
    case authActionTypes.UPDATE_CSRF:
      return { ...APIState, 'x-csrftoken': action.payload };
    default:
      return APIState;
  }
}

function configReducer(
  ConfigState = {
    ORIGIN_URL: '',
    ENV: '',
    CREDS: {
      username: '',
      password: '',
      provider: '',
    },
    FRONTEND_LOGGER: false,
  },
  action: { type: string; payload: any },
) {
  switch (action.type) {
    case configActionTypes.UPDATE_ORIGIN_URL:
      return { ...ConfigState, ORIGIN_URL: action.payload };
    case configActionTypes.UPDATE_ENV:
      return { ...ConfigState, ENV: action.payload };
    case configActionTypes.UPDATE_CREDS:
      return { ...ConfigState, CREDS: { ...action.payload } };
    case configActionTypes.UPDATE_LOGGER:
      return { ...ConfigState, FRONTEND_LOGGER: action.payload };
    default:
      return ConfigState;
  }
}

export { authReducer, configReducer };
