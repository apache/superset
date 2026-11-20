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
/** Flatten structured validation errors without showing escaped JSON to users. */
export default function reportErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    try {
      const parsed: unknown = JSON.parse(error);
      if (typeof parsed === 'object' && parsed !== null)
        return reportErrorMessage(parsed);
    } catch {
      // Plain server messages are already suitable for display.
    }
    return error;
  }
  if (Array.isArray(error))
    return error.map(reportErrorMessage).filter(Boolean).join(' ');
  if (error && typeof error === 'object') {
    return Object.values(error)
      .map(reportErrorMessage)
      .filter(Boolean)
      .join(' ');
  }
  return '';
}
