/* global fetch */
import {isFileReadable} from '../../javascript-utils/is-type';
import {resolvePath} from './file-aliases';
import fetchFileReadable from './fetch-file.browser';

// As fetch but respects pathPrefix and file aliases
// Reads file data from:
// * data urls
// * http/http urls
// * File/Blob objects
export async function fetchFile(url, options) {
  if (isFileReadable(url)) {
    return fetchFileReadable(url, options);
  }
  url = resolvePath(url);
  // TODO - SUPPORT reading from `File` objects
  return fetch(url, options);
}
