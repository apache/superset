// eslint-disable-next-line import/no-extraneous-dependencies
import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/connection';

const LOGIN_GLOB = 'glob:*superset/csrf_token/*';

export default function setupClientForTest() {
  fetchMock.get(LOGIN_GLOB, { csrf_token: '1234' });
  SupersetClient.reset();
  SupersetClient.configure().init();
}
