/*
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
import { formatSpecifier } from 'd3-format';

// D3's '%' and 'p' types both multiply by 100; parsed via d3-format's own
// grammar so garbage like "foo%" is rejected rather than matched by suffix.
// The stored value is trimmed before parsing because
// NumberFormatterRegistry.get() trims it the same way before rendering, so
// this check agrees with what the renderer actually sees.
export default function isPercentD3Format(d3format?: string): boolean {
  if (!d3format) {
    return false;
  }
  try {
    const { type } = formatSpecifier(d3format.trim());
    return type === '%' || type === 'p';
  } catch {
    return false;
  }
}
