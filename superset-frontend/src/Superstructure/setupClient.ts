import { SupersetClient, logging } from '@superset-ui/core';
import parseCookie from './utils/parseCookie';

export default function setupClient() {
  const csrfNode = document.querySelector<HTMLInputElement>('#csrf_token');
  const csrfToken = csrfNode ? csrfNode.value : '';

  // when using flask-jwt-extended csrf is set in cookies
  const cookieCSRFToken = parseCookie().csrf_access_token || '';

  SupersetClient.configure({
    protocol: ['http:', 'https:'].includes(window?.location?.protocol)
      ? (window?.location?.protocol as 'http:' | 'https:')
      : undefined,
    host: (window.location && window.location.host) || '',
    csrfToken: csrfToken || cookieCSRFToken,
  })
    .init()
    .catch(error => {
      logging.warn('Error initializing SupersetClient', error);
    });
}
