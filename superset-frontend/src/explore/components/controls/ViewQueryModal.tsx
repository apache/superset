import React, { useEffect, useState } from 'react';
import { styled, t } from '@superset-ui/core';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import CopyToClipboard from 'src/components/CopyToClipboard';
import Loading from 'src/components/Loading';
import { CopyButton } from 'src/explore/components/DataTableControl';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { getChartDataRequest } from 'src/chart/chartAction';
import markdownSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/markdown';
import htmlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/htmlbars';
import sqlSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import jsonSyntax from 'react-syntax-highlighter/dist/cjs/languages/hljs/json';

const CopyButtonViewQuery = styled(CopyButton)`
  && {
    margin: 0 0 ${({ theme }) => theme.gridUnit}px;
  }
`;

SyntaxHighlighter.registerLanguage('markdown', markdownSyntax);
SyntaxHighlighter.registerLanguage('html', htmlSyntax);
SyntaxHighlighter.registerLanguage('sql', sqlSyntax);
SyntaxHighlighter.registerLanguage('json', jsonSyntax);

interface Props {
  latestQueryFormData: object;
}

const ViewQueryModal: React.FC<Props> = props => {
  const [language, setLanguage] = useState(null);
  const [query, setQuery] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChartData = (resultType: string) => {
    setIsLoading(true);
    getChartDataRequest({
      formData: props.latestQueryFormData,
      resultFormat: 'json',
      resultType,
    })
      .then(response => {
        // Only displaying the first query is currently supported
        const result = response.result[0];
        setLanguage(result.language);
        setQuery(result.query);
        setIsLoading(false);
        setError(null);
      })
      .catch(response => {
        getClientErrorObject(response).then(({ error, message }) => {
          setError(
            error ||
              message ||
              response.statusText ||
              t('Sorry, An error occurred'),
          );
          setIsLoading(false);
        });
      });
  };
  useEffect(() => {
    loadChartData('query');
  }, [props.latestQueryFormData]);

  if (isLoading) {
    return <Loading />;
  }
  if (error) {
    return <pre>{error}</pre>;
  }
  if (query) {
    return (
      <div>
        <CopyToClipboard
          text={query}
          shouldShowText={false}
          copyNode={
            <CopyButtonViewQuery buttonSize="xsmall">
              <i className="fa fa-clipboard" />
            </CopyButtonViewQuery>
          }
        />
        <SyntaxHighlighter language={language || undefined} style={github}>
          {query}
        </SyntaxHighlighter>
      </div>
    );
  }
  return null;
};

export default ViewQueryModal;
