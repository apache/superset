import callApi from './callApi';
import rejectAfterTimeout from './rejectAfterTimeout';
import parseResponse from './parseResponse';
import { CallApi, ClientTimeout, ParseMethod } from '../types';

export default async function callApiAndParseWithTimeout<T extends ParseMethod = 'json'>({
  timeout,
  parseMethod,
  ...rest
}: { timeout?: ClientTimeout; parseMethod?: T } & CallApi) {
  const apiPromise = callApi(rest);
  const racedPromise =
    typeof timeout === 'number' && timeout > 0
      ? Promise.race([apiPromise, rejectAfterTimeout<Response>(timeout)])
      : apiPromise;

  return parseResponse(racedPromise, parseMethod);
}
