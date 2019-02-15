import SupersetClientClass from './SupersetClientClass';
import { ClientConfig, RequestConfig, SupersetClientInterface } from './types';

let singletonClient: SupersetClientClass | undefined;

function getInstance(maybeClient: SupersetClientClass | undefined): SupersetClientClass {
  if (!maybeClient) {
    throw new Error('You must call SupersetClient.configure(...) before calling other methods');
  }

  return maybeClient;
}

const SupersetClient: SupersetClientInterface = {
  configure: (config?: ClientConfig): SupersetClientClass => {
    singletonClient = new SupersetClientClass(config);

    return singletonClient;
  },
  delete: (request: RequestConfig) => getInstance(singletonClient).delete(request),
  get: (request: RequestConfig) => getInstance(singletonClient).get(request),
  getInstance,
  init: (force?: boolean) => getInstance(singletonClient).init(force),
  isAuthenticated: () => getInstance(singletonClient).isAuthenticated(),
  post: (request: RequestConfig) => getInstance(singletonClient).post(request),
  put: (request: RequestConfig) => getInstance(singletonClient).put(request),
  reAuthenticate: () => getInstance(singletonClient).init(/* force = */ true),
  request: (request: RequestConfig) => getInstance(singletonClient).get(request),
  reset: () => {
    singletonClient = undefined;
  },
};

export default SupersetClient;
