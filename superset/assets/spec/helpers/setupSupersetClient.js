import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/connection';

export default function setupSupersetClient() {
  // The following is needed to mock out SupersetClient requests
  // including CSRF authentication and initialization
  global.FormData = window.FormData; // used by SupersetClient
  fetchMock.get('glob:*superset/csrf_token/*', { csrf_token: '1234' });
  SupersetClient.configure({ protocol: 'http', host: 'localhost' }).init();
}
