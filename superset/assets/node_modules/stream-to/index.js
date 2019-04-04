exports.array = toArray
exports.buffer = toBuffer

function toArray(stream, callback) {
  var arr = []

  stream.on('data', onData)
  stream.once('end', onEnd)
  stream.once('error', callback)
  stream.once('error', cleanup)
  stream.once('close', cleanup)

  function onData(doc) {
    arr.push(doc)
  }

  function onEnd() {
    callback(null, arr)
    cleanup()
  }

  function cleanup() {
    arr = null
    stream.removeListener('data', onData)
    stream.removeListener('end', onEnd)
    stream.removeListener('error', callback)
    stream.removeListener('error', cleanup)
    stream.removeListener('close', cleanup)
  }

  return stream
}

function toBuffer(stream, callback) {
  toArray(stream, function (err, arr) {
    if (err || !arr)
      callback(err)
    else
      callback(null, Buffer.concat(arr))
  })

  return stream
}