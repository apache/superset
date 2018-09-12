import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/core';

export default function setupSupersetClient() {
  // The following are needed to mock out SupersetClient requests
  // including CSRF authentication and initialization
  // global.FormData = window.FormData;

  fetchMock.get('glob:*superset/csrf_token/*', { csrf_token: '1234' });

  SupersetClient.configure({ protocol: 'http', host: 'localhost' }).init();
}
