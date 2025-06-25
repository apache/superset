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
import { getOverrideHtmlSchema } from '../../src/components/SafeMarkdown';

describe('getOverrideHtmlSchema', () => {
  it('should append the override items', () => {
    const original = {
      attributes: {
        '*': ['size'],
      },
      clobberPrefix: 'original-prefix',
      tagNames: ['h1', 'h2', 'h3'],
    };
    const result = getOverrideHtmlSchema(original, {
      attributes: { '*': ['src'], h1: ['style'] },
      clobberPrefix: 'custom-prefix',
      tagNames: ['iframe'],
    });
    expect(result.clobberPrefix).toEqual('custom-prefix');
    expect(result.attributes).toEqual({ '*': ['size', 'src'], h1: ['style'] });
    expect(result.tagNames).toEqual(['h1', 'h2', 'h3', 'iframe']);
  });
});
