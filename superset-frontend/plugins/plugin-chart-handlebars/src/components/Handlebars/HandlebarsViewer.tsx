import { SafeMarkdown } from '@superset-ui/core';
import Handlebars from 'handlebars';
import moment from 'moment';
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

//  usage: {{dateFormat my_date format="MMMM YYYY"}}
Handlebars.registerHelper('dateFormat', function (context, block) {
  const f = block.hash.format || 'YYYY-MM-DD';
  return moment(context).format(f);
});
