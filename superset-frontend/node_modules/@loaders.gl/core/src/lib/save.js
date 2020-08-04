import {encode, encodeSync} from './encode';
import {writeFile, writeFileSync} from './fetch/write-file';

export function save(data, url, writer, options) {
  const encodedData = encode(data, writer, options, url);
  return writeFile(url, encodedData);
}

export function saveSync(data, url, writer, options) {
  const encodedData = encodeSync(data, writer, options, url);
  return writeFileSync(url, encodedData);
}
