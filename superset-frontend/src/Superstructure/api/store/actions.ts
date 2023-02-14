const authActionTypes = {
  UPDATE_JWT: 'auth/updateJWT',
  UPDATE_CSRF: 'auth/updateCSRF',
};

const configActionTypes = {
  UPDATE_JWT: 'auth/updateJWT',
  UPDATE_ORIGIN_URL: 'config/updateOriginUrl',
  UPDATE_ENV: 'config/updateEnv',
  UPDATE_CREDS: 'config/updateCreds',
  UPDATE_LOGGER: 'config/updateFrontendLogger',
};

export { authActionTypes, configActionTypes };
