import { SafeMarkdown } from '@superset-ui/core';
import Handlebars from 'handlebars';
import React, { useMemo, useState } from 'react';

export interface HandlebarsViewerProps {
  templateSource: string;
  data: any;
}

export const HandlebarsViewer = ({
  templateSource,
  data,
}: HandlebarsViewerProps) => {
  const [renderedTemplate, setRenderedTemplate] = useState('');

  useMemo(() => {
    const template = Handlebars.compile(templateSource);
    const result = template(data);
    setRenderedTemplate(result);
  }, [templateSource, data]);

  if (renderedTemplate) {
    return <SafeMarkdown source={renderedTemplate} />;
  }
  return <p>Loading...</p>;
};
