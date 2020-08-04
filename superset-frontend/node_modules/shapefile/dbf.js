var file = require("./file"),
    iconv = require("iconv-lite");

exports.read = require("./read")(reader);
exports.reader = reader;

function reader(filename, encoding) {
  var fileReader = file.reader(filename),
      decode = utf8.test(encoding) ? decodeUtf8 : decoder(encoding || "ISO-8859-1"),
      fieldDescriptors = [],
      recordBytes;

  function readHeader(callback) {
    fileReader.read(32, function(error, fileHeader) {
      if (fileHeader === end) error = new Error("unexpected EOF");
      if (error) return void callback(error);
      var fileType = fileHeader.readUInt8(0), // TODO verify 3
          fileDate = new Date(1900 + fileHeader.readUInt8(1), fileHeader.readUInt8(2) - 1, fileHeader.readUInt8(3)),
          recordCount = fileHeader.readUInt32LE(4);
      recordBytes = fileHeader.readUInt16LE(10);
      fileReader.read(fileHeader.readUInt16LE(8) - 32, function readFields(error, fields) {
        var n = 0;
        while (fields.readUInt8(n) != 0x0d) {
          fieldDescriptors.push({
            name: fieldName(decode(fields, n, n + 11)),
            type: fields.toString("ascii", n + 11, n + 12),
            length: fields.readUInt8(n + 16)
          });
          n += 32;
        }
        callback(null, {
          version: fileType,
          date: fileDate,
          count: recordCount,
          fields: fieldDescriptors
        });
      });
    });
    return this;
  }

  function readRecord(callback) {
    if (!recordBytes) return callback(new Error("must read header before reading records")), this;
    fileReader.read(recordBytes, function readRecord(error, record) {
      if (record === end) return callback(null, end);
      if (error) return void callback(error);
      var i = 1;
      callback(null, fieldDescriptors.map(function(field) {
        return fieldTypes[field.type](decode(record, i, i += field.length));
      }));
    });
    return this;
  }

  function close(callback) {
    fileReader.close(callback);
    return this;
  }

  return {
    readHeader: readHeader,
    readRecord: readRecord,
    close: close
  };
}

var end = exports.end = file.end;

var utf8 = /^utf[-]?8$/i;

function decoder(encoding) {
  return function(buffer, i, j) {
    return iconv.decode(buffer.slice(i, j), encoding);
  };
}

function decodeUtf8(buffer, i, j) {
  return buffer.toString("utf8", i, j);
}

var fieldTypes = {
  B: fieldNumber,
  C: fieldString,
  D: fieldDate,
  F: fieldNumber,
  L: fieldBoolean,
  M: fieldNumber,
  N: fieldNumber
};

function fieldNumber(d) {
  return isNaN(d = +d) ? null : d;
}

function fieldString(d) {
  return d.trim() || null;
}

function fieldDate(d) {
  return new Date(+d.substring(0, 4), d.substring(4, 6) - 1, +d.substring(6, 8));
}

function fieldBoolean(d) {
  return /^[nf]$/i.test(d) ? false
      : /^[yt]$/i.test(d) ? true
      : null;
}

function fieldName(string) {
  var i = string.indexOf("\0");
  return i < 0 ? string : string.substring(0, i);
}
