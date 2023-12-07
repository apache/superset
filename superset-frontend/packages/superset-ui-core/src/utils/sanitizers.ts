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
export function sanitizeFileName(fileName: string) {
  // Allow only alphanumeric characters, hyphens, and underscores
  return fileName.replace(/[^a-zA-Z0-9-_]/g, '');
}

export function sanitizeUrl(url: string) {
  try {
    // Attempt to create a URL object. If this fails, the URL is invalid
    // eslint-disable-next-line no-new
    new URL(url);

    // The URL is valid if no error was thrown.
    // Proceed with removing JavaScript: and data: protocols to prevent XSS attacks
    return url.replace(/(javascript:|data:)/gi, '');
  } catch (e) {
    // If URL is invalid, return an empty string or handle as needed
    return '';
  }
}
