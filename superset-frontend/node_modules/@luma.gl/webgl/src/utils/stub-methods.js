import log from './log';

// Install stubs for removed methods
export function stubRemovedMethods(instance, className, version, methodNames) {
  const upgradeMessage = `See luma.gl ${version} Upgrade Guide at \
http://uber.github.io/luma.gl/#/documentation/overview/upgrade-guide`;

  const prototype = Object.getPrototypeOf(instance);

  methodNames.forEach(methodName => {
    if (prototype.methodName) {
      return;
    }

    prototype[methodName] = () => {
      log.removed(`Calling removed method ${className}.${methodName}: `, upgradeMessage)();
      throw new Error(methodName);
    };
  });
}
