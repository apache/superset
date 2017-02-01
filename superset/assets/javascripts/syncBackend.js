import fs from 'fs';
import path from 'path';
import { fields } from './explorev2/stores/fields';

function exportFile(fileLocation, content) {
  fs.writeFile(fileLocation, content, function(err) {
    if (err) {
        console.log(`File ${fileLocation} was not saved... :(`);
    }
    console.log(`File ${fileLocation} was saved!`);
  });
}

function main() {
  const APP_DIR = path.resolve(__dirname, './');
  const blob = {
    fields,
  };
  exportFile(APP_DIR + '/../dist/backendSync.json', JSON.stringify(blob, null, 2));
}
main();
