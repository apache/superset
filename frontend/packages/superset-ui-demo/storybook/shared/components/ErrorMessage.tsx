import React from 'react';

export type Props = {
  error: Error;
};

export default function ErrorMessage({ error }: Props) {
  return (
    <div className="alert alert-danger">
      {error.stack || error.message}
      {!error.message &&
        !error.stack &&
        (typeof error === 'object' ? JSON.stringify(error) : String(error))}
    </div>
  );
}
