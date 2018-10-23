/* eslint no-console: 0 */
import { SupersetClient } from '@superset-ui/core';

export default function setupClient() {
  const csrfNode = document.querySelector('#csrf_token');
  const csrfToken = csrfNode ? csrfNode.value : null;

  SupersetClient.configure({
    protocol: (window.location && window.location.protocol) || '',
    host: (window.location && window.location.host) || '',
    csrfToken,
  })
    .init()
    .catch((error) => {
      console.warn('Error initializing SupersetClient', error);
    });
}
