import React from 'react';

export type Props = {
  error: Error;
};

export default function ErrorMessage({ error }: Props) {
  // eslint-disable-next-line no-console
  console.error(error);
  return (
    <pre className="alert alert-danger">
      {error.stack || error.message}
      {!error.message &&
        !error.stack &&
        (typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error))}
    </pre>
  );
}
