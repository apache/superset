import React, { useMemo } from 'react';
import dompurify from 'dompurify';

const isHTML = RegExp.prototype.test.bind(/(<([^>]+)>)/i);

export default function HTMLRenderer({ value }: { value: string }) {
  if (isHTML(value)) {
    const html = useMemo(() => ({ __html: dompurify.sanitize(value) }), [value]);

    return (
      // eslint-disable-next-line react/no-danger
      <div dangerouslySetInnerHTML={html} />
    );
  }

  return <>{value}</>;
}
