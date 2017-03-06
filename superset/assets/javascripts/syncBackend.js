/* eslint no-console: 0 */
import fs from 'fs';
import path from 'path';
import { fields } from './explorev2/stores/controls';

function exportFile(fileLocation, content) {
  fs.writeFile(fileLocation, content, function (err) {
    if (err) {
      console.log(`File ${fileLocation} was not saved... :(`);
    } else {
      console.log(`File ${fileLocation} was saved!`);
    }
  });
}

function main() {
  const APP_DIR = path.resolve(__dirname, './');
  const dir = APP_DIR + '/../dist/';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const blob = { fields };
  exportFile(APP_DIR + '/../backendSync.json', JSON.stringify(blob, null, 2));
}
main();
