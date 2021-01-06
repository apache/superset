/**
 * Default cache configs
 */
import * as os from 'os';

export interface CacheConfig {
  path: string[] | string;
  hashFiles: string[] | string;
  keyPrefix?: string;
  restoreKeys?: string[] | string;
}

export interface CacheConfigs {
  [cacheName: string]: CacheConfig;
}

const { HOME = '~' } = process.env;
const platform = os.platform() as 'linux' | 'darwin' | 'win32';
const pathByPlatform = {
  linux: {
    pip: `${HOME}/.cache/pip`,
  },
  darwin: {
    pip: `${HOME}/Library/Caches/pip`,
  },
  win32: {
    pip: `${HOME}\\AppData\\Local\\pip\\Cache`,
  },
};

export default {
  pip: {
    path: pathByPlatform[platform].pip,
    hashFiles: 'requirements*.txt',
  },
  npm: {
    path: `${HOME}/.npm`,
    hashFiles: [
      `package-lock.json`,
      // support lerna monorepo with depth=2
      `*/*/package-lock.json`,
      `!node_modules/*/package-lock.json`,
    ],
  },
  yarn: {
    path: `${HOME}/.npm`,
    hashFiles: [`yarn.lock`, `*/*/yarn.lock`, `!node_modules/*/yarn.lock`],
  },
} as CacheConfigs;
