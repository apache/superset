// returns a Promise that rejects after the specified timeout
export default function rejectAfterTimeout(timeout) {
  return new Promise((resolve, reject) => {
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
