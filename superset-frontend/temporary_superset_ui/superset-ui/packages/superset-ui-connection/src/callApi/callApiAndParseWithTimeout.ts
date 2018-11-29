import callApi from './callApi';
import rejectAfterTimeout from './rejectAfterTimeout';
import parseResponse from './parseResponse';
import { CallApi, ClientTimeout, SupersetClientResponse, ParseMethod } from '../types';

export default function callApiAndParseWithTimeout({
  timeout,
  parseMethod,
  ...rest
}: { timeout?: ClientTimeout; parseMethod?: ParseMethod } & CallApi): Promise<
  SupersetClientResponse
> {
  const apiPromise = callApi(rest);

  const racedPromise =
    typeof timeout === 'number' && timeout > 0
      ? Promise.race([rejectAfterTimeout(timeout), apiPromise])
      : apiPromise;

  return parseResponse(racedPromise, parseMethod);
}
