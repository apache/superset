import { expect } from 'chai';
import React from 'react';
import sinon from 'sinon';
import ace from 'brace';
import Enzyme, { mount } from 'enzyme';
import SplitEditor from '../../src/split.js';
import brace from 'brace'; // eslint-disable-line no-unused-vars
import Adapter from 'enzyme-adapter-react-16';

Enzyme.configure({ adapter: new Adapter() });

describe('Split Component', () => {

  // Required for the document.getElementById used by Ace can work in the test environment
  const domElement = document.getElementById('app');
  const mountOptions = {
    attachTo: domElement,
  };

  describe('General', () => {
    it('should render without problems with defaults properties', () => {
      const wrapper = mount(<SplitEditor />, mountOptions);
      expect(wrapper).to.exist;
    });
    it('should get the ace library from the onBeforeLoad callback', () => {
      const beforeLoadCallback = sinon.spy();
      mount(<SplitEditor onBeforeLoad={beforeLoadCallback}/>, mountOptions);

      expect(beforeLoadCallback.callCount).to.equal(1);
      expect(beforeLoadCallback.getCall(0).args[0]).to.deep.equal(ace);
    });

    it('should trigger console warn if editorOption is called', () => {
      const stub = sinon.stub(console, 'warn');
      const wrapper = mount(<SplitEditor enableBasicAutocompletion={true} />, mountOptions);
      expect(wrapper).to.exist;
      expect(console.warn.calledWith('ReaceAce: editor option enableBasicAutocompletion was activated but not found. Did you need to import a related tool or did you possibly mispell the option?') ).to.be.true;
      stub.restore();
    });

    it('should set the editor props to the Ace element', () => {
      const editorProperties = {
        react: 'setFromReact',
        test: 'setFromTest',
      };
      const wrapper = mount(<SplitEditor editorProps={editorProperties}/>, mountOptions);

      const editor = wrapper.instance().splitEditor;

      expect(editor.react).to.equal(editorProperties.react);
      expect(editor.test).to.equal(editorProperties.test);
    });

    it('should update the orientation on componentWillReceiveProps', () => {
      let orientation = 'below';
      const wrapper = mount(<SplitEditor orientation={orientation} splits={2}/>, mountOptions);

      // Read set value
      let editor = wrapper.instance().split;
      expect(editor.getOrientation()).to.equal(editor.BELOW);

      // Now trigger the componentWillReceiveProps
      orientation = 'beside';
      wrapper.setProps({orientation});
      editor = wrapper.instance().split;
      expect(editor.getOrientation()).to.equal(editor.BESIDE);
    });

    it('should update the orientation on componentWillReceiveProps', () => {
      const wrapper = mount(<SplitEditor  splits={2}/>, mountOptions);

      // Read set value
      let editor = wrapper.instance().split;
      expect(editor.getSplits()).to.equal(2);

      // Now trigger the componentWillReceiveProps
      wrapper.setProps({splits: 4});
      editor = wrapper.instance().split;
      expect(editor.getSplits()).to.equal(4);
    });

    it('should set the command for the Ace element', () => {
      const commandsMock = [
        {
          name: 'myReactAceTest',
          bindKey: {win: 'Ctrl-M', mac: 'Command-M'},
          exec: () => {
          },
          readOnly: true
        },
        {
          name: 'myTestCommand',
          bindKey: {win: 'Ctrl-W', mac: 'Command-W'},
          exec: () => {
          },
          readOnly: true
        }
      ];
      const wrapper = mount(<SplitEditor commands={commandsMock}/>, mountOptions);

      const editor = wrapper.instance().splitEditor;
      expect(editor.commands.commands.myReactAceTest).to.deep.equal(commandsMock[0]);
      expect(editor.commands.commands.myTestCommand).to.deep.equal(commandsMock[1]);
    });

    it('should change the command binding for the Ace element', () => {
      const commandsMock = [
        {
          bindKey: {win: 'ctrl-d', mac: 'command-d'},
          name: 'selectMoreAfter',
          exec: 'selectMoreAfter'
        }
      ];
      const wrapper = mount(<SplitEditor commands={commandsMock}/>, mountOptions);

      const editor = wrapper.instance().splitEditor;
      const expected = [editor.commands.commands.removeline, "selectMoreAfter"]
      expect(editor.commands.commandKeyBinding['ctrl-d']).to.deep.equal(expected);
    });

    it('should get the editor from the onLoad callback', () => {
      const loadCallback = sinon.spy();
      const wrapper = mount(<SplitEditor onLoad={loadCallback}/>, mountOptions);

      // Get the editor
      const editor = wrapper.instance().split;

      expect(loadCallback.callCount).to.equal(1);
      expect(loadCallback.getCall(0).args[0]).to.deep.equal(editor);
    });

    it('should trigger the focus on mount', () => {
      const onFocusCallback = sinon.spy();
      mount(<SplitEditor focus={true} onFocus={onFocusCallback}/>, mountOptions);

      // Read the focus
      expect(onFocusCallback.callCount).to.equal(1);
    });


    it('should set editor to null on componentWillUnmount', () => {
      const wrapper = mount(<SplitEditor />, mountOptions);
      expect(wrapper.getElement().editor).to.not.equal(null);

      // Check the editor is null after the Unmount
      wrapper.unmount();
      expect(wrapper.getElement()).to.equal(null);
    });



  });

  describe('Events', () => {

    it('should call the onChange method callback', () => {
      const onChangeCallback = sinon.spy();
      const wrapper = mount(<SplitEditor onChange={onChangeCallback}/>, mountOptions);

      // Check is not previously called
      expect(onChangeCallback.callCount).to.equal(0);

      // Trigger the change event
      const expectText = 'React Ace Test';
      wrapper.instance().splitEditor.setValue(expectText, 1);

      expect(onChangeCallback.callCount).to.equal(1);
      expect(onChangeCallback.getCall(0).args[0]).to.deep.equal([expectText, '']);
      expect(onChangeCallback.getCall(0).args[1].action).to.eq('insert')
    });

    it('should call the onCopy method', () => {
      const onCopyCallback = sinon.spy();
      const wrapper = mount(<SplitEditor onCopy={onCopyCallback}/>, mountOptions);

      // Check is not previously called
      expect(onCopyCallback.callCount).to.equal(0);

      // Trigger the copy event
      const expectText = 'React Ace Test';
      wrapper.instance().onCopy(expectText);

      expect(onCopyCallback.callCount).to.equal(1);
      expect(onCopyCallback.getCall(0).args[0]).to.equal(expectText);
    });

    it('should call the onPaste method', () => {
      const onPasteCallback = sinon.spy();
      const wrapper = mount(<SplitEditor onPaste={onPasteCallback}/>, mountOptions);

      // Check is not previously called
      expect(onPasteCallback.callCount).to.equal(0);

      // Trigger the Paste event
      const expectText = 'React Ace Test';
      wrapper.instance().onPaste(expectText);

      expect(onPasteCallback.callCount).to.equal(1);
      expect(onPasteCallback.getCall(0).args[0]).to.equal(expectText);
    });

    it('should call the onFocus method callback', () => {
      const onFocusCallback = sinon.spy();
      const wrapper = mount(<SplitEditor onFocus={onFocusCallback}/>, mountOptions);

      // Check is not previously called
      expect(onFocusCallback.callCount).to.equal(0);

      // Trigger the focus event
      wrapper.instance().split.focus();

      expect(onFocusCallback.callCount).to.equal(1);
    });

    it('should call the onSelectionChange method callback', () => {
      const onSelectionChangeCallback = sinon.spy();
      const wrapper = mount(<SplitEditor onSelectionChange={onSelectionChangeCallback}/>, mountOptions);

      // Check is not previously called
      expect(onSelectionChangeCallback.callCount).to.equal(0);

      // Trigger the focus event
      wrapper.instance().splitEditor.getSession().selection.selectAll()

      expect(onSelectionChangeCallback.callCount).to.equal(1);
    });

    it('should call the onCursorChange method callback', () => {
      const onCursorChangeCallback = sinon.spy();

      const wrapper = mount(<SplitEditor value="a" onCursorChange={onCursorChangeCallback}/>, mountOptions) 

      // The changeCursor event is called when the initial value is set
      expect(onCursorChangeCallback.callCount).to.equal(1);

      // Trigger the changeCursor event
      wrapper.instance().splitEditor.getSession().selection.moveCursorTo(0, 0);
      
      expect(onCursorChangeCallback.callCount).to.equal(2);
    });

    it('should call the onBlur method callback', () => {
      const onBlurCallback = sinon.spy();
      const wrapper = mount(<SplitEditor onBlur={onBlurCallback}/>, mountOptions);

      // Check is not previously called
      expect(onBlurCallback.callCount).to.equal(0);

      // Trigger the blur event
      wrapper.instance().onBlur();

      expect(onBlurCallback.callCount).to.equal(1);
    });

    it('should not trigger a component error to call the events without setting the props', () => {
      const wrapper = mount(<SplitEditor />, mountOptions);

      // Check the if statement is checking if the property is set.
      wrapper.instance().onChange();
      wrapper.instance().onCopy('copy');
      wrapper.instance().onPaste('paste');
      wrapper.instance().onFocus();
      wrapper.instance().onBlur();
    });

  });
  describe('ComponentWillReceiveProps', () => {

    it('should update the editorOptions on componentWillReceiveProps', () => {
      const options = {
        printMargin: 80
      };
      const wrapper = mount(<SplitEditor setOptions={options}/>, mountOptions);

      // Read set value
      const editor = wrapper.instance().splitEditor;
      expect(editor.getOption('printMargin')).to.equal(options.printMargin);

      // Now trigger the componentWillReceiveProps
      const newOptions = {
        printMargin: 200,
        animatedScroll: true,
      };
      wrapper.setProps({setOptions: newOptions});
      expect(editor.getOption('printMargin')).to.equal(newOptions.printMargin);
      expect(editor.getOption('animatedScroll')).to.equal(newOptions.animatedScroll);
    });
    it('should update the editorOptions on componentWillReceiveProps', () => {

      const wrapper = mount(<SplitEditor minLines={1} />, mountOptions);

      // Read set value
      const editor = wrapper.instance().splitEditor;
      expect(editor.getOption('minLines')).to.equal(1);


      wrapper.setProps({minLines: 2});
      expect(editor.getOption('minLines')).to.equal(2);
    });


    it('should update the mode on componentWillReceiveProps', () => {

      const wrapper = mount(<SplitEditor mode="javascript" />, mountOptions);

      // Read set value
      const oldMode =  wrapper.first('SplitEditor').props()

      wrapper.setProps({mode: 'elixir'});
      const newMode =  wrapper.first('SplitEditor').props()
      expect(oldMode).to.not.deep.equal(newMode);
    });




    it('should update many props on componentWillReceiveProps', () => {

      const wrapper = mount((
        <SplitEditor
          theme="github"
          keyboardHandler="vim"
          fontSize={14}
          wrapEnabled={true}
          showPrintMargin={true}
          showGutter={false}
          height="100px"
          width="200px"
        />), mountOptions);

      // Read set value
      const oldMode =  wrapper.first('SplitEditor').props()

      wrapper.setProps({
        theme: 'solarized',
        keyboardHandler: 'emacs',
        fontSize: 18,
        wrapEnabled: false,
        showPrintMargin: false,
        showGutter: true,
        height: '120px',
        width: '220px',
      });
      const newMode =  wrapper.first('SplitEditor').props()
      expect(oldMode).to.not.deep.equal(newMode);
    });



    it('should update the className on componentWillReceiveProps', () => {
      const className = 'old-class';
      const wrapper = mount(<SplitEditor className={className}/>, mountOptions);

      // Read set value
      let editor = wrapper.instance().refEditor;
      expect(editor.className).to.equal(' ace_editor ace-tm old-class');

      // Now trigger the componentWillReceiveProps
      const newClassName = 'new-class';
      wrapper.setProps({className: newClassName});
      editor = wrapper.instance().refEditor;
      expect(editor.className).to.equal(' new-class ace_editor ace-tm');
    });


    it('should update the value on componentWillReceiveProps', () => {
      const startValue = 'start value';
      const anotherStartValue = 'another start value';
      const wrapper = mount(<SplitEditor value={[startValue, anotherStartValue]}/>, mountOptions);

      // Read set value
      let editor = wrapper.instance().split.getEditor(0);
      let editor2 = wrapper.instance().split.getEditor(1);
      expect(editor.getValue()).to.equal(startValue);
      expect(editor2.getValue()).to.equal(anotherStartValue);

      // Now trigger the componentWillReceiveProps
      const newValue = 'updated value';
      const anotherNewValue = 'another updated value';
      wrapper.setProps({value: [newValue, anotherNewValue]});
      editor = wrapper.instance().splitEditor;
      editor2 = wrapper.instance().split.getEditor(1);
      expect(editor.getValue()).to.equal(newValue);
      expect(editor2.getValue()).to.equal(anotherNewValue);
    });
   it('should set up the markers', () => {
      const markers = [[{
        startRow: 3,
        type: 'text',
        className: 'test-marker'
      }]];
      const wrapper = mount(<SplitEditor markers={markers}/>, mountOptions);

      // Read the markers
      const editor = wrapper.instance().splitEditor;
      expect(editor.getSession().getMarkers()['3'].clazz).to.equal('test-marker');
      expect(editor.getSession().getMarkers()['3'].type).to.equal('text');
    });

    it('should update the markers', () => {
      const oldMarkers = [[
        {
          startRow: 4,
          type: 'text',
          className: 'test-marker-old'
        },
        {
          startRow: 7,
          type: 'foo',
          className: 'test-marker-old',
          inFront: true
        }
      ]];
      const markers = [[{
        startRow: 3,
        type: 'text',
        className: 'test-marker-new',
        inFront: true,
      },{
        startRow: 5,
        type: 'text',
        className: 'test-marker-new'
      }]];
      const wrapper = mount(<SplitEditor markers={oldMarkers}/>, mountOptions);

      // Read the markers
      const editor = wrapper.instance().splitEditor;
      expect(editor.getSession().getMarkers()['3'].clazz).to.equal('test-marker-old');
      expect(editor.getSession().getMarkers()['3'].type).to.equal('text');
      wrapper.setProps({markers: markers});
      const editorB = wrapper.instance().splitEditor;
      expect(editorB.getSession().getMarkers()['6'].clazz).to.equal('test-marker-new');
      expect(editorB.getSession().getMarkers()['6'].type).to.equal('text');
    });

  it('should update the markers', () => {
      const oldMarkers = [[
        {
          startRow: 4,
          type: 'text',
          className: 'test-marker-old'
        },
        {
          startRow: 7,
          type: 'foo',
          className: 'test-marker-old',
          inFront: true
        }
      ]];
      const markers = [[]];
      const wrapper = mount(<SplitEditor markers={oldMarkers}/>, mountOptions);

      // Read the markers
      const editor = wrapper.instance().splitEditor;
      expect(editor.getSession().getMarkers()['3'].clazz).to.equal('test-marker-old');
      expect(editor.getSession().getMarkers()['3'].type).to.equal('text');
      wrapper.setProps({markers: markers});
      const editorB = wrapper.instance().splitEditor;
      expect(editorB.getSession().getMarkers()).to.deep.equal({});
    });

    it('should add annotations', () => {
      const annotations = [{
        row: 3, // must be 0 based
        column: 4,  // must be 0 based
        text: 'error.message',  // text to show in tooltip
        type: 'error'
      }]
      const wrapper = mount(<SplitEditor/>, mountOptions);
      const editor = wrapper.instance().splitEditor;
      wrapper.setProps({annotations: [annotations]});
      expect(editor.getSession().getAnnotations()).to.deep.equal(annotations);
      wrapper.setProps({annotations: null});
      expect(editor.getSession().getAnnotations()).to.deep.equal([]);
    })

    it('should trigger the focus on componentWillReceiveProps', () => {
      const onFocusCallback = sinon.spy();
      const wrapper = mount(<SplitEditor onFocus={onFocusCallback}/>, mountOptions);

      // Read the focus
      expect(onFocusCallback.callCount).to.equal(0);

      // Now trigger the componentWillReceiveProps
      wrapper.setProps({focus: true});
      expect(onFocusCallback.callCount).to.equal(1);
    });

  });
});
