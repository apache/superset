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
import { AnnotationLayer } from './types/AnnotationLayer';
import getLocalizedFormDataValue from './getLocalizedFormDataValue';

/**
 * Get localized name for an annotation layer.
 *
 * Resolves `layer.translations.name[locale]` with base language fallback
 * (e.g., "de" from "de-AT"). Returns the original `layer.name` when no
 * translation is found.
 *
 * @param layer - The annotation layer object
 * @param locale - The user's locale (e.g., "de", "ru")
 * @returns The localized name if available, otherwise the original name
 */
export default function getLocalizedAnnotationName(
  layer: AnnotationLayer,
  locale?: string,
): string {
  return (
    getLocalizedFormDataValue(layer.translations, 'name', locale) ?? layer.name
  );
}
