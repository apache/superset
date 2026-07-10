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
import { OptionSelector } from './optionSelector';

const newSelector = (values: string[]) => new OptionSelector({}, true, values);

test('reorder moves an item across multiple positions without scrambling the rest', () => {
  // Regression for #33951: a fast drag reorders across several indices in a
  // single call. A swap would corrupt every position the cursor crossed, so
  // moving the last item to the front must preserve the order of the others.
  const selector = newSelector(['a', 'b', 'c', 'd', 'e']);
  selector.reorder(4, 0);
  expect(selector.getValues()).toEqual(['e', 'a', 'b', 'c', 'd']);
});

test('reorder moves an item from the front to the back', () => {
  const selector = newSelector(['a', 'b', 'c', 'd', 'e']);
  selector.reorder(0, 4);
  expect(selector.getValues()).toEqual(['b', 'c', 'd', 'e', 'a']);
});

test('reorder to the same index leaves the order unchanged', () => {
  const selector = newSelector(['a', 'b', 'c']);
  selector.reorder(1, 1);
  expect(selector.getValues()).toEqual(['a', 'b', 'c']);
});

test('reorder ignores out-of-range indices instead of splicing in undefined', () => {
  // A fast drag can resolve to a stale endpoint. Without a bounds guard, an
  // out-of-range `from` splices `undefined` into the values and corrupts the
  // list, blowing up downstream consumers.
  const selector = newSelector(['a', 'b', 'c']);
  selector.reorder(5, 0);
  selector.reorder(0, 5);
  selector.reorder(-1, 1);
  selector.reorder(1, -1);
  expect(selector.getValues()).toEqual(['a', 'b', 'c']);
});
