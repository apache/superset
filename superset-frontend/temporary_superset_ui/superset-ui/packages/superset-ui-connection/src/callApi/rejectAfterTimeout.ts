// returns a Promise that rejects after the specified timeout
export default function rejectAfterTimeout<T>(timeout: number) {
  return new Promise<T>((resolve, reject) => {
    setTimeout(
      () =>
        reject({
          error: 'Request timed out',
          statusText: 'timeout',
        }),
      timeout,
    );
  });
}
