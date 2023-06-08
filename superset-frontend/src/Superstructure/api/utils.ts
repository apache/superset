import { AxiosRequestConfig } from 'axios';

const logger = (params: AxiosRequestConfig, isEnabled = false) => {
  if (isEnabled) {
    console.groupCollapsed(`${params.url} [${params.method}]`);
    console.log('data', params.data);
    console.log('data JSON:', JSON.stringify(params.data));
    console.log('headers', params.headers);
    console.log('headers JSON:', JSON.stringify(params.headers));
    console.groupEnd();
  }
};

const handleCsrfToken = (csrfToken: string) => {
  const csrfOnThePage = document.getElementById('csrf_token');

  if (!csrfOnThePage) {
    const csrfTokenElement = document.createElement('input');
    csrfTokenElement.type = 'hidden';
    csrfTokenElement.name = 'csrf_token';
    csrfTokenElement.value = csrfToken;
    csrfTokenElement.id = 'csrf_token';
    document.body.appendChild(csrfTokenElement);
  } else {
    csrfOnThePage.setAttribute('value', csrfToken);
  }
};

export { logger, handleCsrfToken };
