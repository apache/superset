import { ClientConfig, SupersetClientClass } from './SupersetClientClass';
import { RequestConfig, SupersetClientResponse } from './types';

let singletonClient: SupersetClientClass | undefined;

function getInstance(maybeClient: SupersetClientClass | undefined): SupersetClientClass {
  if (!maybeClient) {
    throw new Error('You must call SupersetClient.configure(...) before calling other methods');
  }

  return maybeClient;
}

export interface SupersetClientInterface {
  configure: (config?: ClientConfig) => SupersetClientClass;
  get: (request: RequestConfig) => Promise<SupersetClientResponse>;
  getInstance: (maybeClient?: SupersetClientClass) => SupersetClientClass;
  init: (force?: boolean) => Promise<string | undefined>;
  isAuthenticated: () => boolean;
  post: (request: RequestConfig) => Promise<SupersetClientResponse>;
  reAuthenticate: () => Promise<string | undefined>;
  reset: () => void;
}

const SupersetClient: SupersetClientInterface = {
  configure: (config?: ClientConfig): SupersetClientClass => {
    singletonClient = new SupersetClientClass(config);

    return singletonClient;
  },
  get: (request: RequestConfig) => getInstance(singletonClient).get(request),
  getInstance,
  init: (force?: boolean) => getInstance(singletonClient).init(force),
  isAuthenticated: () => getInstance(singletonClient).isAuthenticated(),
  post: (request: RequestConfig) => getInstance(singletonClient).post(request),
  reAuthenticate: () => getInstance(singletonClient).init(/* force = */ true),
  reset: () => {
    singletonClient = undefined;
  },
};

export default SupersetClient;
