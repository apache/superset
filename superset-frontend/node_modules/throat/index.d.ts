/**
 * Throttle the given function to only run `size` times in parallel.
 * Extra calls will be queued until one of the earlier calls completes.
 */
declare function throat<TResult, TArgs extends any[]>(
  size: number,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult>;

/**
 * Throttle the given function to only run `size` times in parallel.
 * Extra calls will be queued until one of the earlier calls completes.
 */
declare function throat<TResult, TArgs extends any[]>(
  fn: (...args: TArgs) => Promise<TResult>,
  size: number
): (...args: TArgs) => Promise<TResult>;

/**
 * Create a throttle that only allows `size` calls in parallel.
 * Extra calls will be queued until one of the earlier calls completes.
 *
 * To create an exclusive lock, just use a `size` of `1`.
 */
declare function throat(
  size: number
): <TResult, TArgs extends any[] = []>(
  fn: (...args: TArgs) => Promise<TResult>,
  ...args: TArgs
) => Promise<TResult>;
export default throat;

