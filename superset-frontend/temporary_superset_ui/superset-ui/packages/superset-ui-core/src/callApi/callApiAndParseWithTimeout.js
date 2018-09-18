import callApi from './callApi';
import rejectAfterTimeout from './rejectAfterTimeout';
import parseResponse from './parseResponse';

export default function callApiAndParseWithTimeout({ timeout, parseMethod, ...rest }) {
  const apiPromise = callApi(rest);

  const racedPromise =
    typeof timeout === 'number' && timeout > 0
      ? Promise.race([rejectAfterTimeout(timeout), apiPromise])
      : apiPromise;

  return parseResponse(racedPromise, parseMethod);
}
