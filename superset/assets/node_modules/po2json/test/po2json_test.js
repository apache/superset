var po2json = require(".."),
    fs = require("fs"),
    Jed = require("jed");

module.exports["parse"] = {
  setUp: function(callback){
    this.po = fs.readFileSync(__dirname + "/fixtures/pl.po");
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/pl.json", "utf-8"));
    callback();
  },

  parse: function(test){
    var parsed = po2json.parse(this.po);
    test.deepEqual(parsed, this.json);
    test.done();
  }
}

module.exports["parse with Jed format"] = {
  setUp: function(callback){
    this.po = fs.readFileSync(__dirname + "/fixtures/pl.po");
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/pl-jed.json", "utf-8"));
    callback();
  },

  parse: function(test){
    var parsed = po2json.parse(this.po, { format: 'jed' });
    test.deepEqual(parsed, this.json);
    test.doesNotThrow(function() { new Jed(parsed) }, Error)
    test.done();
  }
};

module.exports["parse with Jed1.x format"] = {
  setUp: function(callback){
    this.po = fs.readFileSync(__dirname + "/fixtures/pl.po");
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/pl-jed1.x.json", "utf-8"));
    callback();
  },

  parse: function(test){
    var parsed = po2json.parse(this.po, { format: 'jed1.x' });
    test.deepEqual(parsed, this.json);
    test.doesNotThrow(function() { new Jed(parsed) }, Error)
    test.done();
  }
};

module.exports["parse with MessageFormatter format"] = {
  setUp: function(callback){
    this.po = fs.readFileSync(__dirname + "/fixtures/pl-mf.po");
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/pl-mf.json", "utf-8"));
    callback();
  },

  parse: function(test){
    var parsed = po2json.parse(this.po, { format: 'mf' });
    test.deepEqual(parsed, this.json);
    test.done();
  }
}

module.exports["parse with MessageFormatter format + fallback-to-msgid"] = {
  setUp: function(callback){
    this.po = fs.readFileSync(__dirname + "/fixtures/en-empty.po");
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/en-mf-fallback-to-msgid.json", "utf-8"));
    callback();
  },

  parse: function(test){
    var parsed = po2json.parse(this.po, { format: 'mf', 'fallback-to-msgid': true });
    test.deepEqual(parsed, this.json);
    test.done();
  }
}

module.exports["parse with fallback-to-msgid"] = {
  setUp: function(callback){
    this.po = fs.readFileSync(__dirname + "/fixtures/en-empty.po");
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/en-empty.json", "utf-8"));
    callback();
  },

  parse: function(test){
    var parsed = po2json.parse(this.po, { 'fallback-to-msgid': true });
    test.deepEqual(parsed, this.json);
    test.done();
  }
}
module.exports["parseFile"] = {
  setUp: function(callback){
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/pl.json", "utf-8"));
    callback();
  },

  parseFile: function(test){
    var self = this;
    po2json.parseFile(__dirname + "/fixtures/pl.po", null, function (err, parsed) {
      test.deepEqual(parsed, self.json);
      test.done();
    });
  }
}

module.exports["parseFileSync"] = {
  setUp: function(callback){
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/pl.json", "utf-8"));
    callback();
  },

  parseFileSync: function(test){
    var parsed = po2json.parseFileSync(__dirname + "/fixtures/pl.po");
    test.deepEqual(parsed, this.json);
    test.done();
  }
}

module.exports["parse with Plural-Forms == nplurals=1; plural=0;"] = {
  setUp: function(callback){
    this.po = fs.readFileSync(__dirname + "/fixtures/ja.po");
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/ja.json", "utf-8"));
    callback();
  },

  parse: function(test){
    var parsed = po2json.parse(this.po);
    test.deepEqual(parsed, this.json);
    test.done();
  }
}

module.exports["parse with Plural-Forms == nplurals=1; plural=0; and with Jed1.x format"] = {
  setUp: function(callback){
    this.po = fs.readFileSync(__dirname + "/fixtures/ja.po");
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/ja-jed1.x.json", "utf-8"));
    callback();
  },

  parse: function(test){
    var parsed = po2json.parse(this.po, { format: 'jed1.x' });
    test.deepEqual(parsed, this.json);
    test.done();
  }
}

module.exports["parse with no headers"] ={
  setUp: function(callback){
    this.po = fs.readFileSync(__dirname + "/fixtures/en-no-header.po");
    this.json = JSON.parse(fs.readFileSync(__dirname + "/fixtures/en-no-header.json", "utf-8"));
    callback();
  },

  parse: function(test){
    var parsed = po2json.parse(this.po);
    test.deepEqual(parsed, this.json);
    test.done();
  }
}
