/** setTimeout that returns a promise */
export default function promiseTimeout<T>(
  /** A function to be executed after the timer expires. */
  func: (...args: unknown[]) => T,
  /** The time, in milliseconds (thousandths of a second), the timer should wait before the specified function or code is executed. If this parameter is omitted, a value of 0 is used, meaning execute "immediately", or more accurately, as soon as possible.  */
  delay?: number,
) {
  return new Promise<T>(resolve => {
    setTimeout(() => {
      resolve(func());
    }, delay);
  });
}
