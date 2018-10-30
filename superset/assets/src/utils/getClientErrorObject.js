import { t } from '@superset-ui/translation';
import COMMON_ERR_MESSAGES from './errorMessages';

export default function getClientErrorObject(response) {
  // takes a Response object as input, attempts to read response as Json if possible,
  // and returns a Promise that resolves to a plain object with error key and text value.
  return new Promise((resolve) => {
    if (typeof response === 'string') {
      resolve({ error: response });
    } else if (response && response.constructor === Response && !response.bodyUsed) {
      // attempt to read the body as json, and fallback to text. we must clone the
      // response in order to fallback to .text() because Response is single-read
      response.clone().json().then((errorJson) => {
        let error = { ...response, ...errorJson };
        if (error.stack) {
          error = {
            ...error,
            error: t('Unexpected error: ') +
              (error.description || t('(no description, click to see stack trace)')),
            stacktrace: error.stack,
          };
        } else if (error.responseText && error.responseText.indexOf('CSRF') >= 0) {
          error = {
            ...error,
            error: t(COMMON_ERR_MESSAGES.SESSION_TIMED_OUT),
          };
        }
        resolve(error);
      }).catch(() => {
        // fall back to reading as text
        response.text().then((errorText) => {
          resolve({ ...response, error: errorText });
        });
      });
    } else {
      // fall back to Response.statusText or generic error of we cannot read the response
      resolve({ ...response, error: response.statusText || t('An error occurred') });
    }
  });
}
