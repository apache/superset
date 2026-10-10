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
import { useCallback, useEffect, useState } from 'react';

const read = (): string | undefined =>
  new URLSearchParams(window.location.hash.slice(1)).get('draft') ?? undefined;

/**
 * The draft token in the page URL's fragment (`#draft=<token>`). Browsers
 * never send the fragment to the server, so the token stays out of logs.
 */
export function useDraftToken() {
  const [token, setToken] = useState(read);

  useEffect(() => {
    const onChange = () => setToken(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const clear = useCallback(() => {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    );
    setToken(undefined);
  }, []);

  return { token, clear };
}
