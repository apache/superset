import { ClientConfig, SupersetClientClass } from './SupersetClientClass';
import { RequestConfig } from './types';

let singletonClient: SupersetClientClass | undefined;

function hasInstance(
  maybeClient: SupersetClientClass | undefined,
): maybeClient is SupersetClientClass {
  if (!maybeClient) {
    throw new Error('You must call SupersetClient.configure(...) before calling other methods');
  }

  return true;
}

const SupersetClient = {
  configure: (config: ClientConfig = {}): SupersetClientClass => {
    singletonClient = new SupersetClientClass(config);

    return singletonClient;
  },
  get: (request: RequestConfig) => hasInstance(singletonClient) && singletonClient.get(request),
  init: (force?: boolean) => hasInstance(singletonClient) && singletonClient.init(force),
  isAuthenticated: () => hasInstance(singletonClient) && singletonClient.isAuthenticated(),
  post: (request: RequestConfig) => hasInstance(singletonClient) && singletonClient.post(request),
  reAuthenticate: () => hasInstance(singletonClient) && singletonClient.init(/* force = */ true),
  reset: () => {
    singletonClient = undefined;
  },
};

export default SupersetClient;
