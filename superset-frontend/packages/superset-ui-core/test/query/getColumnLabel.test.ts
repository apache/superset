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
import { getColumnLabel } from '@superset-ui/core';

describe('getColumnLabel', () => {
  it('should handle physical column', () => {
    expect(getColumnLabel('gender')).toEqual('gender');
  });

  it('should handle adhoc columns with label', () => {
    expect(
      getColumnLabel({
        sqlExpression: "case when 1 then 'a' else 'b' end",
        label: 'my col',
        expressionType: 'SQL',
      }),
    ).toEqual('my col');
  });

  it('should handle adhoc columns without label', () => {
    expect(
      getColumnLabel({
        sqlExpression: "case when 1 then 'a' else 'b' end",
        expressionType: 'SQL',
      }),
    ).toEqual("case when 1 then 'a' else 'b' end");
  });
});
