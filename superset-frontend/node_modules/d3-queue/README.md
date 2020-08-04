# d3-queue

A **queue** evaluates zero or more *deferred* asynchronous tasks with configurable concurrency: you control how many tasks run at the same time. When all the tasks complete, or an error occurs, the queue passes the results to your *await* callback. This library is similar to [Async.js](https://github.com/caolan/async)’s [parallel](https://github.com/caolan/async#paralleltasks-callback) (when *concurrency* is infinite), [series](https://github.com/caolan/async#seriestasks-callback) (when *concurrency* is 1), and [queue](https://github.com/caolan/async#queue), but features a much smaller footprint: as of release 2, d3-queue is about 700 bytes gzipped, compared to 4,300 for Async.

Each task is defined as a function that takes a callback as its last argument. For example, here’s a task that says hello after a short delay:

```js
function delayedHello(callback) {
  setTimeout(function() {
    console.log("Hello!");
    callback(null);
  }, 250);
}
```

When a task completes, it must call the provided callback. The first argument to the callback should be null if the task is successfull, or the error if the task failed. The optional second argument to the callback is the return value of the task. (To return multiple values from a single callback, wrap the results in an object or array.)

To run multiple tasks simultaneously, create a queue, *defer* your tasks, and then register an *await* callback to be called when all of the tasks complete (or an error occurs):

```js
var q = d3.queue();
q.defer(delayedHello);
q.defer(delayedHello);
q.await(function(error) {
  if (error) throw error;
  console.log("Goodbye!");
});
```

Of course, you can also use a `for` loop to defer many tasks:

```js
var q = d3.queue();

for (var i = 0; i < 1000; ++i) {
  q.defer(delayedHello);
}

q.awaitAll(function(error) {
  if (error) throw error;
  console.log("Goodbye!");
});
```

Tasks can take optional arguments. For example, here’s how to configure the delay before hello and provide a name:

```js
function delayedHello(name, delay, callback) {
  setTimeout(function() {
    console.log("Hello, " + name + "!");
    callback(null);
  }, delay);
}
```

Any additional arguments provided to [*queue*.defer](#queue_defer) are automatically passed along to the task function before the callback argument. You can also use method chaining for conciseness, avoiding the need for a local variable:

```js
d3.queue()
    .defer(delayedHello, "Alice", 250)
    .defer(delayedHello, "Bob", 500)
    .defer(delayedHello, "Carol", 750)
    .await(function(error) {
      if (error) throw error;
      console.log("Goodbye!");
    });
```

The [asynchronous callback pattern](https://github.com/maxogden/art-of-node#callbacks) is very common in Node.js, so Queue works directly with many Node APIs. For example, to [stat two files](https://nodejs.org/dist/latest/docs/api/fs.html#fs_fs_stat_path_callback) concurrently:

```js
d3.queue()
    .defer(fs.stat, __dirname + "/../Makefile")
    .defer(fs.stat, __dirname + "/../package.json")
    .await(function(error, file1, file2) {
      if (error) throw error;
      console.log(file1, file2);
    });
```

You can also make abortable tasks: these tasks return an object with an *abort* method which terminates the task. So, if a task calls [setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/WindowTimers/setTimeout) on start, it can call [clearTimeout](https://developer.mozilla.org/en-US/docs/Web/API/WindowTimers/clearTimeout) on abort. For example:

```js
function delayedHello(name, delay, callback) {
  var id = setTimeout(function() {
    console.log("Hello, " + name + "!");
    callback(null);
  }, delay);
  return {
    abort: function() {
      clearTimeout(id);
    }
  };
}
```

When you call [*queue*.abort](#queue_abort), any in-progress tasks will be immediately aborted; in addition, any pending (not-yet-started) tasks not be started. Note that you can also use *queue*.abort *without* abortable tasks, in which case pending tasks will be cancelled, though active tasks will continue to run. Conveniently, the [d3-request](https://github.com/d3/d3-request) library implements abort atop XMLHttpRequest. For example:

```js
var q = d3.queue()
    .defer(d3.request, "http://www.google.com:81")
    .defer(d3.request, "http://www.google.com:81")
    .defer(d3.request, "http://www.google.com:81")
    .awaitAll(function(error, results) {
      if (error) throw error;
      console.log(results);
    });
```

To abort these requests, call `q.abort()`.

## Installing

If you use NPM, `npm install d3-queue`. If you use Bower, `bower install d3-queue`. Otherwise, download the [latest release](https://github.com/d3/d3-queue/releases/latest). You can also load directly from [d3js.org](https://d3js.org), either as a [standalone library](https://d3js.org/d3-queue.v2.min.js) or as part of [D3 4.0 alpha](https://github.com/mbostock/d3/tree/4). AMD, CommonJS, and vanilla environments are supported. In vanilla, a `d3_queue` global is exported:

```html
<script src="https://d3js.org/d3-queue.v2.min.js"></script>
<script>

var q = d3_queue.queue();

</script>
```

[Try d3-queue in your browser.](https://tonicdev.com/npm/d3-queue)

## API Reference

<a href="#queue" name="queue">#</a> d3.<b>queue</b>([<i>concurrency</i>])

Constructs a new queue with the specified *concurrency*. If *concurrency* is not specified, the queue has infinite concurrency. Otherwise, *concurrency* is a positive integer. For example, if *concurrency* is 1, then all tasks will be run in series. If *concurrency* is 3, then at most three tasks will be allowed to proceed concurrently; this is useful, for example, when loading resources in a web browser.

<a href="#queue_defer" name="queue_defer">#</a> <i>queue</i>.<b>defer</b>(<i>task</i>[, <i>arguments</i>…])

Adds the specified asynchronous *task* callback to the queue, with any optional *arguments*. The *task* is a function that will be called when the task should start. It is passed the specified optional *arguments* and an additional *callback* as the last argument; the callback must be invoked by the task when it finishes. The task must invoke the callback with two arguments: the *error*, if any, and the *result* of the task. To return multiple results from a single callback, wrap the results in an object or array.

For example, here’s a task which computes the answer to the ultimate question of life, the universe, and everything after a short delay:

```js
function simpleTask(callback) {
  setTimeout(function() {
    callback(null, {answer: 42});
  }, 250);
}
```

If the task calls back with an error, any tasks that were scheduled *but not yet started* will not run. For a serial queue (of *concurrency* 1), this means that a task will only run if all previous tasks succeed. For a queue with higher concurrency, only the first error that occurs is reported to the await callback, and tasks that were started before the error occurred will continue to run; note, however, that their results will not be reported to the await callback.

Tasks can only be deferred before [*queue*.await](#queue_await) or [*queue*.awaitAll](#queue_awaitAll) is called. If a task is deferred after then, an error is thrown. If the *task* is not a function, an error is thrown.

<a href="#queue_abort" name="queue_abort">#</a> <i>queue</i>.<b>abort</b>()

Aborts any active tasks, invoking each active task’s *task*.abort function, if any. Also prevents any new tasks from starting, and immediately invokes the [*queue*.await](#queue_await) or [*queue*.awaitAll](#queue_awaitAll) callback with an error indicating that the queue was aborted. See the [introduction](#d3-queue) for an example implementation of an abortable task. Note that if your tasks are not abortable, any running tasks will continue to run, even after the await callback has been invoked with the abort error. The await callback is invoked exactly once on abort, and so is not called when any running tasks subsequently succeed or fail.

<a href="#queue_await" name="queue_await">#</a> <i>queue</i>.<b>await</b>(<i>callback</i>)

Sets the *callback* to be invoked when all deferred tasks have finished. The first argument to the *callback* is the first error that occurred, or null if no error occurred. If an error occurred, there are no additional arguments to the callback. Otherwise, the *callback* is passed each result as an additional argument. For example:

```js
d3.queue()
    .defer(fs.stat, __dirname + "/../Makefile")
    .defer(fs.stat, __dirname + "/../package.json")
    .await(function(error, file1, file2) { console.log(file1, file2); });
```

If all [deferred](#queue_defer) tasks have already completed, the callback will be invoked immediately. This method may only be called once, after any tasks have been deferred. If this method is called multiple times, or if it is called after [*queue*.awaitAll](#queue_awaitAll), an error is thrown. If the *callback* is not a function, an error is thrown.

<a href="#queue_awaitAll" name="queue_awaitAll">#</a> <i>queue</i>.<b>awaitAll</b>(<i>callback</i>)

Sets the *callback* to be invoked when all deferred tasks have finished. The first argument to the *callback* is the first error that occurred, or null if no error occurred. If an error occurred, there are no additional arguments to the callback. Otherwise, the *callback* is also passed an array of results as the second argument. For example:

```js
d3.queue()
    .defer(fs.stat, __dirname + "/../Makefile")
    .defer(fs.stat, __dirname + "/../package.json")
    .awaitAll(function(error, files) { console.log(files); });
```

If all [deferred](#queue_defer) tasks have already completed, the callback will be invoked immediately. This method may only be called once, after any tasks have been deferred. If this method is called multiple times, or if it is called after [*queue*.await](#queue_await), an error is thrown. If the *callback* is not a function, an error is thrown.
