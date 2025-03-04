import { API_HANDLER } from '@superset-ui/core';

export const composeAPIConfig = (params: {
  originUrl: string;
  frontendLogger: boolean;
  token?: string;
}) => {
  console.log('WEBPACK_MODE', process.env.WEBPACK_MODE);

  if (process.env.WEBPACK_MODE === 'production') {
    API_HANDLER.setConfig({
      ORIGIN_URL: params.originUrl,
      ENV: 'prod',
      FRONTEND_LOGGER: params.frontendLogger || false,
    });
    API_HANDLER.setToken(params.token || ''); // can take the token from the tool
  } else {
    const USERNAME = process.env.SUPERSET_DEV_USERNAME;
    const PASSWORD = process.env.SUPERSET_DEV_PASSWORD;
    const PROVIDER = process.env.SUPERSET_DEV_PROVIDER;

    if (!USERNAME || !PASSWORD || !PROVIDER) {
      throw new Error(
        'You are using dev environment, but you do not use .env file. See .env.example',
      );
    }

    API_HANDLER.setConfig({
      CREDS: {
        username: USERNAME,
        password: PASSWORD,
        provider: PROVIDER,
      },
      ENV: 'dev',
      ORIGIN_URL: params.originUrl,
      FRONTEND_LOGGER: params.frontendLogger || false,
    });
    API_HANDLER.setToken(params.token || ''); // can take the token from the tool
  }
};
