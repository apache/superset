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

export type DatasetCertification = {
  certified_by?: string;
  certification_details?: string;
};

type JsonObject = Record<string, unknown>;

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseExtra = (extra?: string): JsonObject | undefined => {
  if (!extra?.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(extra);
    return isJsonObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const isDatasetExtraValid = (extra?: string): boolean =>
  parseExtra(extra) !== undefined;

export const getDatasetCertification = (
  extra?: string,
): DatasetCertification => {
  const certification = parseExtra(extra)?.certification;
  if (!isJsonObject(certification)) {
    return {};
  }

  return {
    certified_by:
      typeof certification.certified_by === 'string'
        ? certification.certified_by
        : undefined,
    certification_details:
      typeof certification.details === 'string'
        ? certification.details
        : undefined,
  };
};

export const setDatasetCertification = (
  extra: string | undefined,
  { certified_by, certification_details }: DatasetCertification,
): string | undefined => {
  const parsedExtra = parseExtra(extra);

  // Do not replace malformed raw metadata while the user is correcting it in
  // the adjacent Extra editor.
  if (!parsedExtra) {
    return extra;
  }

  const normalizedCertifiedBy = certified_by || undefined;
  const normalizedDetails = certification_details || undefined;
  const existing = getDatasetCertification(extra);

  // Avoid reformatting raw Extra JSON when the certification did not change.
  if (
    existing.certified_by === normalizedCertifiedBy &&
    existing.certification_details === normalizedDetails
  ) {
    return extra;
  }

  const existingCertification = parsedExtra.certification;
  const certification = isJsonObject(existingCertification)
    ? { ...existingCertification }
    : {};
  delete certification.certified_by;
  delete certification.details;

  if (normalizedCertifiedBy) {
    certification.certified_by = normalizedCertifiedBy;
  }
  if (normalizedDetails) {
    certification.details = normalizedDetails;
  }

  if (Object.keys(certification).length > 0) {
    parsedExtra.certification = certification;
  } else {
    delete parsedExtra.certification;
  }

  return JSON.stringify(parsedExtra);
};
