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

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attemptNumber: number, delay: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  shouldRetry: () => true,
  onRetry: () => {},
};

export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === config.maxRetries || !config.shouldRetry(error)) {
        throw error;
      }

      const baseDelay =
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
      const delay = Math.min(baseDelay, config.maxDelay);

      config.onRetry(attempt + 1, delay, error);

      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function retryWithStaggeredDelay<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { staggerOffset?: number } = {},
): Promise<T> {
  // Add random jitter to stagger requests
  const staggerOffset = options.staggerOffset || Math.random() * 500;

  return retryWithExponentialBackoff(async () => {
    // Add initial stagger delay on first attempt
    if (staggerOffset > 0) {
      await new Promise(resolve => setTimeout(resolve, staggerOffset));
    }
    return fn();
  }, options);
}
