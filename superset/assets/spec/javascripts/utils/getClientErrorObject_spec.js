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
import getClientErrorObject from '../../../src/utils/getClientErrorObject';

describe('getClientErrorObject()', () => {
  it('Returns a Promise', () => {
    const response = getClientErrorObject('error');
    expect(response.constructor === Promise).toBe(true);
  });

  it('Returns a Promise that resolves to an object with an error key', () => {
    const error = 'error';

    return getClientErrorObject(error).then(errorObj => {
      expect(errorObj).toMatchObject({ error });
    });
  });

  it('Handles Response that can be parsed as json', () => {
    const jsonError = { something: 'something', error: 'Error message' };
    const jsonErrorString = JSON.stringify(jsonError);

    return getClientErrorObject(new Response(jsonErrorString)).then(
      errorObj => {
        expect(errorObj).toMatchObject(jsonError);
      },
    );
  });

  it('Handles Response that can be parsed as text', () => {
    const textError = 'Hello I am a text error';

    return getClientErrorObject(new Response(textError)).then(errorObj => {
      expect(errorObj).toMatchObject({ error: textError });
    });
  });

  it('Handles plain text as input', () => {
    const error = 'error';

    return getClientErrorObject(error).then(errorObj => {
      expect(errorObj).toMatchObject({ error });
    });
  });
});
