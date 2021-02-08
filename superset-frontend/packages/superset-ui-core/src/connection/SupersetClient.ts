import SupersetClientClass from './SupersetClientClass';
import { SupersetClientInterface } from './types';

let singletonClient: SupersetClientClass | undefined;

function getInstance(): SupersetClientClass {
  if (!singletonClient) {
    throw new Error('You must call SupersetClient.configure(...) before calling other methods');
  }
  return singletonClient;
}

const SupersetClient: SupersetClientInterface = {
  configure: config => {
    singletonClient = new SupersetClientClass(config);
    return singletonClient;
  },
  reset: () => {
    singletonClient = undefined;
  },
  getInstance,
  delete: request => getInstance().delete(request),
  get: request => getInstance().get(request),
  init: force => getInstance().init(force),
  isAuthenticated: () => getInstance().isAuthenticated(),
  post: request => getInstance().post(request),
  put: request => getInstance().put(request),
  reAuthenticate: () => getInstance().reAuthenticate(),
  request: request => getInstance().request(request),
};

export default SupersetClient;
