## React Syntax Highlighter

[![CircleCI](https://circleci.com/gh/conorhastings/react-syntax-highlighter.svg?style=svg)](https://circleci.com/gh/conorhastings/react-syntax-highlighter)
[![codecov](https://codecov.io/gh/conorhastings/react-syntax-highlighter/branch/master/graph/badge.svg)](https://codecov.io/gh/conorhastings/react-syntax-highlighter)


Syntax highlighting component for `React` using the seriously super amazing <a href="https://github.com/wooorm/lowlight">lowlight</a> and <a href="https://github.com/wooorm/refractor">refractor</a> by <a href="https://github.com/wooorm">wooorm</a>

Check out a small demo <a href="http://conor.rodeo/react-syntax-highlighter/demo/">here</a> and see the component in action highlighting the generated test code <a href="http://conor.rodeo/redux-test-recorder/demo/">here</a>. 

For React Native you can use <a href='https://github.com/conorhastings/react-native-syntax-highlighter'>react-native-syntax-highlighter</a>

### Install

`npm install react-syntax-highlighter --save`

### Why This One?

There are other syntax highlighters for `React` out there so why use this one? The biggest reason is that all the others rely on triggering calls in `componentDidMount` and `componentDidUpdate` to highlight the code block and then insert it in the render function using `dangerouslySetInnerHTML` or just manually altering the DOM with native javascript. This utilizes a syntax tree to dynamically build the virtual dom which allows for  updating only the changing DOM instead of completely overwriting it on any change, and because of this it is also using more idiomatic `React` and allows the use of pure function components brought into `React` as of `0.14`. 

### Javascript Styles!
One of the biggest pain points for me trying to find a syntax highlighter for my own projects was the need to put a stylesheet tag on my page. I wanted to provide out of the box code styling with my modules without requiring awkward inclusion of another libs stylesheets. The styles in this module are all javascript based, and all styles supported by `highlight.js` have been ported! 

I do realize that javascript styles are not for everyone, so you can optionally choose to use css based styles with classNames added to elements by setting the prop `useInlineStyles` to `false` (it defaults to `true`).

### Use

#### props
* `language` - the language to highlight code in. Available options [here for hljs](./AVAILABLE_LANGUAGES_HLJS.MD) and [here for prism](./AVAILABLE_LANGUAGES_PRISM.MD). (pass text to just render plain monospaced text)
* `style` - style object required from styles/hljs or styles/prism directory depending on whether or not you are importing from `react-syntax-highlighter` or `react-syntax-highlighter/prism`  directory [here for hljs](./AVAILABLE_STYLES_HLJS.MD). and [here for prism](./AVAILABLE_STYLES_PRISM.MD). `import { style } from 'react-syntax-highlighter/styles/{hljs|prism}'` . Will use default if style is not included.
* `children` - the code to highlight.
* `customStyle` - prop that will be combined with the top level style on the pre tag, styles here will overwrite earlier styles. 
* `codeTagProps` - props that will be spread into the `<code>` tag that is the direct parent of the highlighted code elements. Useful for styling/assigning classNames.
* `useInlineStyles` - if this prop is passed in as false, react syntax highlighter will not add style objects to elements, and will instead append classNames. You can then style the code block by using one of the CSS files provided by highlight.js.
* `showLineNumbers` - if this is enabled line numbers will be shown next to the code block.
* `startingLineNumber` - if `showLineNumbers` is enabled the line numbering will start from here.
* `lineNumberContainerStyle` - the line numbers container default to appearing to the left with 10px of right padding. You can use this to override those styles.
* `lineNumberStyle` - inline style to be passed to the span wrapping each number. Can be either an object or a function that recieves current line number as argument and returns style object.
* `wrapLines` - a boolean value that determines whether or not each line of code should be wrapped in a parent element. defaults to false, when false one can not take action on an element on the line level. You can see an example of what this enables <a href="http://conor.rodeo/react-syntax-highlighter/demo/diff.html">here</a>
* `lineProps` - props to be passed to the span wrapping each line if wrapLines is true. Can be either an object or a function that recieves current line number as argument and returns props object.
* `renderer` - an optional custom renderer for rendering lines of code. See <a href="https://github.com/conorhastings/react-syntax-highlighter-virtualized-renderer">here</a> for an example.
* `PreTag` - the element or custom react component to use in place of the default pre tag, the outermost tag of the component (useful for custom renderer not targeting DOM).
* `CodeTag` - the element or custom react component to use in place of the default code tag, the second tag of the component tree (useful for custom renderer not targeting DOM).
* `spread props` pass arbitrary props to pre tag wrapping code. 

```js
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/styles/hljs';
const Component = () => {
  const codeString = '(num) => num + 1';
  return <SyntaxHighlighter language='javascript' style={docco}>{codeString}</SyntaxHighlighter>;  
}
```

### Prism

Using <a href="https://github.com/wooorm/refractor">refractor</a> we can use an ast built on languages from Prism.js instead of highlight.js. This is beneficial especially when highlighting jsx, a problem long unsolved by this module. The semantics of use are basically the same although a light mode is not yet supported (though is coming in the future). You can see a demo(with jsx) using Prism(refractor) <a href="http://conor.rodeo/react-syntax-highlighter/demo/prism.html">here</a>.

```js
import SyntaxHighlighter from 'react-syntax-highlighter/prism';
import { dark } from 'react-syntax-highlighter/styles/prism';
const Component = () => {
  const codeString = '(num) => num + 1';
  return <SyntaxHighlighter language='javascript' style={dark}>{codeString}</SyntaxHighlighter>;  
}
```

### Light Build

React Syntax Highlighter used in the way described above can have a fairly large footprint. For those that desire more control over what exactly they need, there is an option to import a light build. If you choose to use this you will need to specifically import desired languages and register them using the registerLanguage export from the light build. There is also no default style provided. 

```js
import SyntaxHighlighter, { registerLanguage } from "react-syntax-highlighter/light";
import js from 'react-syntax-highlighter/languages/hljs/javascript';
import docco from 'react-syntax-highlighter/styles/hljs/docco'; 

registerLanguage('javascript', js);
```

You can require `react-syntax-highlighter/prism-light` to use the prism light build instead of the standard light build. 
```jsx
import SyntaxHighlighter, { registerLanguage } from "react-syntax-highlighter/prism-light";
import jsx from 'react-syntax-highlighter/languages/prism/jsx';
import prism from 'react-syntax-highlighter/styles/prism/prism'; 

registerLanguage('jsx', jsx);
```

### Built with React Syntax Highlighter

- [DBGlass](https://github.com/web-pal/DBGlass) - PostgreSQL client built with Electron.
- [Spectacle Editor](https://github.com/FormidableLabs/spectacle-editor) - An Electron based app for creating, editing, saving, and publishing Spectacle presentations. With integrated Plotly support.
- [Superset](https://github.com/airbnb/superset) - Superset is a data exploration platform designed to be visual, intuitive, and interactive.
- [Daydream](https://github.com/segmentio/daydream) - A chrome extension to record your actions into a [nightmare](https://github.com/segmentio/nightmare) script 
- [CodeDoc](https://github.com/B1naryStudio/CodeDoc) - Electron based application build with React for creating project documentations
- [React Component Demo](https://github.com/conorhastings/react-component-demo) - A React Component To make live editable demos of other React Components.
- [Redux Test Recorder](https://github.com/conorhastings/redux-test-recorder) - a redux middleware to automatically generate tests for reducers through ui interaction. Syntax highlighter used by react plugin.
- [GitPoint](https://github.com/gitpoint/git-point) - GitHub for iOS. Built with React Native. (built using react-native-syntax-highlighter)
- [vscodethemes](https://vscodethemes.com/) - A website for viewing vscode themes online using react-syntax-highlighter
- [Yoga Layout Playground](https://yogalayout.com/playground) - generate code for yoga layout in multiple languages
### License

MIT
