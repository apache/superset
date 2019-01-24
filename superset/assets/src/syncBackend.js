/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint no-console: 0 */
import fs from 'fs';
import path from 'path';
import { controls } from './explore/controls';

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
  const blob = { controls };
  exportFile(APP_DIR + '/../backendSync.json', JSON.stringify(blob, null, 2));
}
main();
