# NOT ACTIVELY MAINTAINED

>**This project works fine but is not actively maintained.**  
>**For the new code, you might want to try the new official [rx.disposables](https://github.com/Reactive-Extensions/rx.disposables) package instead.**

# disposables [![npm package](https://img.shields.io/npm/v/disposables.svg?style=flat-square)](https://www.npmjs.org/package/disposables)

Disposables let you safely compose resource disposal semantics.  
Think DOM nodes, event handlers, socket connections.

**This implementation of disposables is extracted from [RxJS](https://github.com/Reactive-Extensions/RxJS/blob/master/src/core/disposables).**  
I took the liberty to tweak the code style to my liking and provide this as a standalone package.

This tiny package includes several disposables:

* [`Disposable`](https://github.com/gaearon/disposables/blob/master/src/Disposable.js) ensures its `dispose` action runs only once;
* [`CompositeDisposable`](https://github.com/gaearon/disposables/blob/master/src/CompositeDisposable.js) ensures a group of disposables are disposed together;
* [`SerialDisposable`](https://github.com/gaearon/disposables/blob/master/src/SerialDisposable.js) switches underlying disposables on the fly and disposes them.

The API is *mostly* the same as RxJS except stricter in a few places.  
It does not strive for 100% API compatibility with RxJS, but generally behavior is the same.

It's best if you consult the [source](https://github.com/gaearon/disposables/tree/master/src/) and [tests](https://github.com/gaearon/disposables/tree/master/src/__tests__), as classes are small and few.

### Usage

```js
import { Disposable, CompositeDisposable, SerialDisposable } from 'disposables';

// or you can import just the ones you need to keep it even tinier
// import SerialDisposable from 'disposables/modules/SerialDisposable';

function attachHandlers(node) {
	let someHandler = ...;
	node.addEventHandler(someHandler);

	// use Disposable to guarantee single execution
	return new Disposable(() => {
	  node.removeEventHandler(someHandler);
	});
}

// CompositeDisposable lets you compose several disposables...
let nodes = ...;
let compositeDisp = new CompositeDisposable(nodes.map(attachHandlers));

// and more later...
let moreNodes = ...
moreNodes.map(attachHandlers).forEach(d => compositeDisp.add(d));

// and dispose them at once!
function goodbye() {
	compositeDisp.dispose();
}

// ... or replace with a bunch of new ones ...
let serialDisp = new SerialDisposable();
serialDisp.setDisposable(compositeDisp);

function replaceNodes(newNodes) {
	let nextCompositeDisp = new CompositeDisposable(newNodes.map(attachHandlers));

	// release all the previous disposables:
	serialDisp.setDisposable(nextCompositeDisp);
}

// with a guarantee of each dispose() called only once.
```

### License

Like the original RxJS code, it is licensed under Apache 2.0.
