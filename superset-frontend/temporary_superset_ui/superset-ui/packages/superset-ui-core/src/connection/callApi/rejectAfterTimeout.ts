// returns a Promise that rejects after the specified timeout
export default function rejectAfterTimeout<T>(timeout: number) {
  return new Promise<T>((resolve, reject) => {
    setTimeout(
      () =>
        // eslint-disable-next-line prefer-promise-reject-errors
        reject({
          error: 'Request timed out',
          statusText: 'timeout',
          timeout,
        }),
      timeout,
    );
  });
}
