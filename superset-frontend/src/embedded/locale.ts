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

import { configure, LanguagePack } from '@apache-superset/core/ui';
import { SupersetClient } from '@superset-ui/core';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';

/**
 * Switches the embedded dashboard locale at runtime.
 *
 * 1. Fetches the language pack for the target locale from the Superset server.
 * 2. Reconfigures the translation singleton so all `t()` calls return new-locale strings.
 * 3. Updates dayjs locale for date formatting.
 * 4. Reloads the page so the server returns content localized to the new locale
 *    (backend `@post_dump` reads Accept-Language, which is set by the browser on reload).
 */
export async function applyLocale(locale: string): Promise<void> {
  if (locale === 'en') {
    configure();
  } else {
    const { json } = await SupersetClient.get({
      endpoint: `/superset/language_pack/${locale}/`,
    });
    configure({ languagePack: json as LanguagePack });
  }
  dayjs.locale(locale);
  window.location.reload();
}
