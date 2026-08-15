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
import { Suspense } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { lazyWithRetry, retryImport } from './lazyWithRetry';

const chunkLoadError = () => {
  const error = new Error('Loading chunk 4169 failed.');
  error.name = 'ChunkLoadError';
  return error;
};

const Page = () => <div>Lazy page</div>;

test('lazyWithRetry recovers from a transient ChunkLoadError (#41266)', async () => {
  const factory = jest
    .fn()
    .mockRejectedValueOnce(chunkLoadError())
    .mockResolvedValue({ default: Page });

  const LazyPage = lazyWithRetry(factory, { retryDelayMs: 0 });

  render(
    <Suspense fallback={<div>Loading</div>}>
      <LazyPage />
    </Suspense>,
  );

  expect(await screen.findByText('Lazy page')).toBeInTheDocument();
  expect(factory).toHaveBeenCalledTimes(2);
});

test('retryImport exhausts its attempts and rethrows the last error (#41266)', async () => {
  const factory = jest.fn().mockRejectedValue(chunkLoadError());

  await expect(
    retryImport(factory, { retries: 2, retryDelayMs: 0 }),
  ).rejects.toThrow('Loading chunk 4169 failed.');
  expect(factory).toHaveBeenCalledTimes(3);
});

test('retryImport does not retry a successful import (#41266)', async () => {
  const factory = jest.fn().mockResolvedValue({ default: Page });

  await expect(retryImport(factory, { retryDelayMs: 0 })).resolves.toEqual({
    default: Page,
  });
  expect(factory).toHaveBeenCalledTimes(1);
});
