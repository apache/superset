import React, { useMemo } from 'react';
import dompurify from 'dompurify';

const isHTML = RegExp.prototype.test.bind(/(<([^>]+)>)/i);

export default function HTMLRenderer({ value }: { value: string }) {
  if (isHTML(value)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const html = useMemo(() => ({ __html: dompurify.sanitize(value) }), [value]);
    return (
      // eslint-disable-next-line react/no-danger
      <div dangerouslySetInnerHTML={html} />
    );
  }

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{value}</>;
}
