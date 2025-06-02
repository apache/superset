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
import { core } from '../api';

/**
 * Represents a type which can release resources, such
 * as event listening or a timer.
 */
export class Disposable implements core.Disposable {
  /**
   * Combine many disposable-likes into one. You can use this method when having objects with
   * a dispose function which aren't instances of `Disposable`.
   *
   * @param disposableLikes Objects that have at least a `dispose`-function member. Note that asynchronous
   * dispose-functions aren't awaited.
   * @returns Returns a new disposable which, upon dispose, will
   * dispose all provided disposables.
   */
  static from(
    ...disposableLikes: {
      /**
       * Function to clean up resources.
       */
      dispose: () => any;
    }[]
  ): Disposable {
    return new Disposable(() => {
      disposableLikes.forEach(disposable => {
        disposable.dispose();
      });
    });
  }

  /**
   * Creates a new disposable that calls the provided function
   * on dispose.
   *
   * *Note* that an asynchronous function is not awaited.
   *
   * @param callOnDispose Function that disposes something.
   */
  constructor(callOnDispose: () => any) {
    this.dispose = callOnDispose;
  }

  /**
   * Dispose this object.
   */
  dispose(): any {
    this.dispose();
  }
}
