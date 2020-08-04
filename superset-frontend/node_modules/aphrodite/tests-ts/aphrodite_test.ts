import { css, minify, StyleSheet, StyleSheetServer, StyleSheetTestUtils } from '../typings';

// StyleSheet
const withNumberOrString = StyleSheet.create({
  first: {
    height: '',
    width: 0,
  },
});

const withPseudo = StyleSheet.create({
  withHover: {
    ':hover': {
      height: '',
      width: 0,
    },
  },
});

const mapValue = new Map();
mapValue.set('position', 'absolute');
mapValue.set('width', 0);
const withMap = StyleSheet.create({ mapValue });

StyleSheet.rehydrate(['']);

StyleSheet.extend([{
  selectorHandler: (selector, baseSelector, callback) => {
    selector.toLowerCase();
    baseSelector.toLowerCase();
    callback('').toLowerCase();
    return '';
  },
}, {
  selectorHandler: () => null,
}]);

// css
const withCreateNumberOrString = css(withNumberOrString.first);
const withCreatePseudo = css(withPseudo.withHover);
const withCreateMap = css(withMap.mapValue);
const withObject = css({});
const withUndefinied = css(undefined);
const withNull = css(null);
const withFalse = css(false);
const withArray = css([{}]);

// StyleSheetTestUtils
StyleSheetTestUtils.suppressStyleInjection();
StyleSheetTestUtils.clearBufferAndResumeStyleInjection();
StyleSheetTestUtils.getBufferedStyles()[0].toLowerCase();

// StyleSheetServer
const serverResult = StyleSheetServer.renderStatic(() => '');
serverResult.css.content.toLowerCase();
serverResult.css.renderedClassNames[0].toLowerCase();
serverResult.html.toLowerCase();

// minify
minify(true);
minify(false);
