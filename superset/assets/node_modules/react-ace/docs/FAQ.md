# Frequently Asked Questions

## How do I use it with `preact`? `webpack`? `create-react-app`?

Check out the example applications

* [create-react-app](https://github.com/securingsincity/react-ace-create-react-app-example)
* [preact](https://github.com/securingsincity/react-ace-preact-example)
* [webpack](https://github.com/securingsincity/react-ace-webpack-example)


## How do call methods on the editor? How do I call Undo or Redo?

`ReactAce` has an editor property, which is the wrapped editor. You can use refs to get to the component, and then you should be able to use the editor on the component to run the function you need:

```javascript
const reactAceComponent = parent.refs.reactAceComponent;
const editor = reactAceComponent.editor
editor.find(searchRegex, {
   backwards: false,
   wrap: true,
   caseSensitive: false,
   wholeWord: false,
   regExp: true,
});
```

Similarly, if you want to redo or undo, you can reference the editor from the refs

```jsx
<button onClick={()=> {this.refs.editor.editor.undo()}}>Undo</button>
<button onClick={()=> {this.refs.editor.editor.redo()}}>Redo</button>
```

## How do I set editor options like setting block scrolling to infinity?

```javascript
<ReactAce
  editorProps={{
    $blockScrolling: Infinity
  }}
/>
```

## How do I add language snippets?

You can import the snippets and mode directly through `brace` along with the language_tools. Here is an example below


```javascript
import React from 'react';
import { render } from 'react-dom';
import brace from 'brace';
import AceEditor from 'react-ace';

import 'brace/mode/python';
import 'brace/snippets/python';
import 'brace/ext/language_tools';
import 'brace/theme/github';

function onChange(newValue) {
  console.log('change',newValue);
}

// Render editor
render(
  <AceEditor
    mode="python"
    theme="github"
    onChange={onChange}
    name="UNIQUE_ID_OF_DIV"
    editorProps={{$blockScrolling: true}}
    enableBasicAutocompletion={true}
    enableLiveAutocompletion={true}
    enableSnippets={true}
    />,
  document.getElementById('example')
);
```

## How do I get selected text `onSelectionChange`?

How you extract the text from the editor is based on how to call methods on the editor.

Your `onSelectionChange` should look like this:

```javascript
onSelectionChange(selection) {
  const content = this.refs.aceEditor.editor.session.getTextRange(selection.getRange());
  // use content
}
```

## How do I get selected text ?
```javascript
  const selectedText = this.refs.aceEditor.editor.getSelectedText();
  // selectedText contains the selected text.
}
```

## How do I add markers?
```javascript
      const markers = [{
        startRow: 3,
        type: 'text',
        className: 'test-marker'
      }];
      const wrapper = (<AceEditor markers={markers}/>);
```

## How do I add annotations?
```javascript
  const annotations = [{
    row: 3, // must be 0 based
    column: 4,  // must be 0 based
    text: 'error.message',  // text to show in tooltip
    type: 'error'
  }]
  const editor = (
    <AceEditor
      annotations={annotations}
    />
  )
```
## How do I add key-bindings?
```javascript

render() {
  return <div>
    <AceEditor
      ref="aceEditor"
      mode="sql"     // Default value since this props must be set.
      theme="chrome" // Default value since this props must be set.
      commands={[{   // commands is array of key bindings.
        name: 'commandName', //name for the key binding.
        bindKey: {win: 'Ctrl-Alt-h', mac: 'Command-Alt-h'}, //key combination used for the command.
        exec: () => { console.log('key-binding used')}  //function to execute when keys are pressed.
      }]}
    />
  </div>;
}
```
## How do I change key-bindings for an existing command?
Same syntax as above, where `exec` is given the name of the command to rebind.
```javascript

render() {
  return <div>
    <AceEditor
      ref="aceEditor"
      mode="sql"     // Default value since this props must be set.
      theme="chrome" // Default value since this props must be set.
      commands={[{   // commands is array of key bindings.
        name: 'removeline', //name for the key binding.
        bindKey: {win: 'Ctrl-X', mac: 'Command-X'}, //key combination used for the command.
        exec: () => 'removeline'  // name of the command to rebind
      }]}
    />
  </div>;
}
```

## How do I add the search box?
Add the following line

`import 'brace/ext/searchbox';`

before introducing the component and it will add the search box.

## How do I add a custom mode?

1. Create my custom mode class (pure ES6 code)
2. Initialize the component with an existing mode name (such as "sql")
3. Use the `componentDidMount` function and call `session.setMode` with an instance of my custom mode.

My custom mode is:
```javascript
export default class CustomSqlMode extends ace.acequire('ace/mode/text').Mode {
	constructor(){
		super();
		// Your code goes here
	}
}
```

And my react-ace code looks like:
```javascript
render() {
  return <div>
    <AceEditor
      ref="aceEditor"
      mode="sql"     // Default value since this props must be set.
      theme="chrome" // Default value since this props must be set.
    />
  </div>;
}

componentDidMount() {
  const customMode = new CustomSqlMode();
  this.refs.aceEditor.editor.getSession().setMode(customMode);
}
```

