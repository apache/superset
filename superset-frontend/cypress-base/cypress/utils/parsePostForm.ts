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
/**
 * Parse multipart form data sent via POST requests.
 */
export default function parsePostForm(requestBody: ArrayBuffer) {
  type ParsedFields = Record<string, string[] | string>;
  if (requestBody.constructor.name !== 'ArrayBuffer') {
    return (requestBody as unknown) as ParsedFields;
  }
  const lines = new TextDecoder('utf-8').decode(requestBody).split('\n');
  const fields: ParsedFields = {};
  let key = '';
  let value: string[] = [];

  function addField(key: string, value: string) {
    if (key in fields) {
      if (Array.isArray(fields[key])) {
        (fields[key] as string[]).push(value);
      } else {
        fields[key] = [fields[key] as string, value];
      }
    } else {
      fields[key] = value;
    }
  }

  lines.forEach(line => {
    const nameMatch = line.match(/Content-Disposition: form-data; name="(.*)"/);
    if (nameMatch) {
      if (key) {
        addField(key, value.join('\n'));
      }
      key = nameMatch[1];
      value = [];
    } else if (!/----.*FormBoundary/.test(line)) {
      value.push(line);
    }
  });
  if (key && value) {
    addField(key, value.join('\n'));
  }
  return fields;
}
