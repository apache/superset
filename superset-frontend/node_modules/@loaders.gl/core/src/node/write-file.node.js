import fs from 'fs';
import {promisify} from 'util';
import toBuffer from './utils/to-buffer.node';

export function writeFile(filePath, arrayBufferOrString) {
  return promisify(fs.writeFile)(`${filePath}`, toBuffer(arrayBufferOrString), {flag: 'w'});
}

export function writeFileSync(filePath, arrayBufferOrString) {
  return fs.writeFileSync(`${filePath}`, toBuffer(arrayBufferOrString), {flag: 'w'});
}
