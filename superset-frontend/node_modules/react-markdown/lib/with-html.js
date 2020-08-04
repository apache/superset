'use strict';

var xtend = require('xtend');

var ReactMarkdown = require('./react-markdown');

var htmlParser = require('./plugins/html-parser');

var parseHtml = htmlParser();

function ReactMarkdownWithHtml(props) {
  var astPlugins = [parseHtml].concat(props.astPlugins || []);
  return ReactMarkdown(xtend(props, {
    astPlugins: astPlugins
  }));
}

ReactMarkdownWithHtml.defaultProps = ReactMarkdown.defaultProps;
ReactMarkdownWithHtml.propTypes = ReactMarkdown.propTypes;
ReactMarkdownWithHtml.types = ReactMarkdown.types;
ReactMarkdownWithHtml.renderers = ReactMarkdown.renderers;
ReactMarkdownWithHtml.uriTransformer = ReactMarkdown.uriTransformer;
module.exports = ReactMarkdownWithHtml;