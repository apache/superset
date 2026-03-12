/* Licensed to the Apache Software Foundation (ASF) under one
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

// Create a new type by picking only the keys with V type from T
export type OnlyKeyWithType<T, V> = keyof {
  [K in keyof T as NonNullable<T[K]> extends V ? K : never]: T[K];
};

export const isIterable = (obj: any): obj is Iterable<any> =>
  obj != null && typeof obj[Symbol.iterator] === 'function';
