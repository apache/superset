import { API_HANDLER } from './api';
import { MicrofrontendParams } from './types/global';

export const composeAPIConfig = (params: MicrofrontendParams) => {
  console.log('WEBPACK_MODE', process.env.WEBPACK_MODE);

  if (process.env.WEBPACK_MODE === 'production') {
    API_HANDLER.setConfig({
      originUrl: params.originUrl,
      ENV: 'prod',
      FRONTEND_LOGGER: params.frontendLogger || false,
      token: params.token || '', // can take the token from the tool
    });
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
      originUrl: params.originUrl,
      FRONTEND_LOGGER: params.frontendLogger || false,
      token: params.token || '',
    });
  }
};
