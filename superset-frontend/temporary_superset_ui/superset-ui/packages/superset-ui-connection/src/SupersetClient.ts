import SupersetClientClass from './SupersetClientClass';
import { ClientConfig, RequestConfig, SupersetClientInterface } from './types';

let singletonClient: SupersetClientClass | undefined;

function getInstance(): SupersetClientClass {
  if (!singletonClient) {
    throw new Error('You must call SupersetClient.configure(...) before calling other methods');
  }

  return singletonClient;
}

const SupersetClient: SupersetClientInterface = {
  configure: (config?: ClientConfig): SupersetClientClass => {
    singletonClient = new SupersetClientClass(config);

    return singletonClient;
  },
  delete: (request: RequestConfig) => getInstance().delete(request),
  get: (request: RequestConfig) => getInstance().get(request),
  getInstance,
  init: (force?: boolean) => getInstance().init(force),
  isAuthenticated: () => getInstance().isAuthenticated(),
  post: (request: RequestConfig) => getInstance().post(request),
  put: (request: RequestConfig) => getInstance().put(request),
  reAuthenticate: () => getInstance().init(/* force = */ true),
  request: (request: RequestConfig) => getInstance().request(request),
  reset: () => {
    singletonClient = undefined;
  },
};

export default SupersetClient;
