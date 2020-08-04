import AbortController, {AbortSignal} from './abortcontroller';
import {nativeAbortControllerIsBroken} from './utils';

(function(self) {
  'use strict';

  if (self.AbortController && !nativeAbortControllerIsBroken(self)) {
    return;
  }

  self.AbortController = AbortController;
  self.AbortSignal = AbortSignal;

})(typeof self !== 'undefined' ? self : global);
