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

/**
 * Utility functions for Matrixify functionality
 */

/**
 * Checks if Matrixify is enabled based on the new layout controls
 * @param formData - The form data object
 * @returns true if either vertical or horizontal layout is enabled
 */
export function isMatrixifyEnabled(formData: Record<string, any>): boolean {
  return !!(
    formData?.matrixify_enable_vertical_layout === true ||
    formData?.matrixify_enable_horizontal_layout === true
  );
}

/**
 * Checks if vertical layout (rows) is enabled
 * @param formData - The form data object
 * @returns true if vertical layout is enabled
 */
export function isVerticalLayoutEnabled(
  formData: Record<string, any>,
): boolean {
  return formData?.matrixify_enable_vertical_layout === true;
}

/**
 * Checks if horizontal layout (columns) is enabled
 * @param formData - The form data object
 * @returns true if horizontal layout is enabled
 */
export function isHorizontalLayoutEnabled(
  formData: Record<string, any>,
): boolean {
  return formData?.matrixify_enable_horizontal_layout === true;
}
