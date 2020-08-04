import {isBrowser} from '../../utils/globals';
import * as node from '../../node/read-file-sync.node';
import {resolvePath} from './file-aliases';
import {readFileSyncBrowser} from './read-file.browser';

// In a few cases (data URIs, node.js) "files" can be read synchronously
export function readFileSync(url, options = {}) {
  url = resolvePath(url);
  if (!isBrowser && node.readFileSync) {
    return node.readFileSync(url, options);
  }
  return readFileSyncBrowser(url, options);
}
