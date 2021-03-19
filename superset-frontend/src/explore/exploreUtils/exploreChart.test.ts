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

import { exploreChart } from '.';

/**
 * I'm leaving this comment here to show one of the approaches I tried and it didn't work.
 *
 * The same problem occurred with: "exploreChart"
 */
// import * as index from './index';
// const spy = jest.spyOn(index, 'postForm');

const params = {
  formData: { data: 'same-string' },
  resultFormat: 'json',
  resultType: 'full',
  force: false,
};

/**
 * For some reason the spy is not working properly and I also did not find a way to mock only the "postForm"
 * I believe that if this file is divided the problem will be solved.
 */
test.skip('Should call postForm correctly', () => {
  exploreChart(params);
  //   expect(spy).toBeCalledTimes(1);
});
