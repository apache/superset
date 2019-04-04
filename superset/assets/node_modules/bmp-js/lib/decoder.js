/**
 * @author shaozilee
 *
 * Bmp format decoder,support 1bit 4bit 8bit 24bit bmp
 *
 */

function BmpDecoder(buffer,is_with_alpha) {
  this.pos = 0;
  this.buffer = buffer;
  this.is_with_alpha = !!is_with_alpha;
  this.flag = this.buffer.toString("utf-8", 0, this.pos += 2);
  if (this.flag != "BM") throw new Error("Invalid BMP File");
  this.parseHeader();
  this.parseBGR();
}

BmpDecoder.prototype.parseHeader = function() {
  this.fileSize = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.reserved = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.offset = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.headerSize = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.width = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.height = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.planes = this.buffer.readUInt16LE(this.pos);
  this.pos += 2;
  this.bitPP = this.buffer.readUInt16LE(this.pos);
  this.pos += 2;
  this.compress = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.rawSize = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.hr = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.vr = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.colors = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;
  this.importantColors = this.buffer.readUInt32LE(this.pos);
  this.pos += 4;

  if(this.bitPP === 16 && this.is_with_alpha){
    this.bitPP = 15
  };
  if (this.bitPP < 15) {
    var len = this.colors === 0 ? 1 << this.bitPP : this.colors;
    this.palette = new Array(len);
    for (var i = 0; i < len; i++) {
      var blue = this.buffer.readUInt8(this.pos++);
      var green = this.buffer.readUInt8(this.pos++);
      var red = this.buffer.readUInt8(this.pos++);
      var quad = this.buffer.readUInt8(this.pos++);
      this.palette[i] = {
        red: red,
        green: green,
        blue: blue,
        quad: quad
      };
    }
  }

}

BmpDecoder.prototype.parseBGR = function() {
  this.pos = this.offset;
  try {
    var bitn = "bit" + this.bitPP;
    var len = this.width * this.height * 4;
    this.data = new Buffer(len);

    this[bitn]();
  } catch (e) {
    console.log("bit decode error:" + e);
  }

};

BmpDecoder.prototype.bit1 = function() {
  var xlen = Math.ceil(this.width / 8);
  var mode = xlen%4;
  for (var y = this.height - 1; y >= 0; y--) {
    for (var x = 0; x < xlen; x++) {
      var b = this.buffer.readUInt8(this.pos++);
      var location = y * this.width * 4 + x*8*4;
      for (var i = 0; i < 8; i++) {
        if(x*8+i<this.width){
          var rgb = this.palette[((b>>(7-i))&0x1)];
          this.data[location+i*4] = rgb.blue;
          this.data[location+i*4 + 1] = rgb.green;
          this.data[location+i*4 + 2] = rgb.red;
          this.data[location+i*4 + 3] = 0xFF;
        }else{
          break;
        }
      }
    }

    if (mode != 0){
      this.pos+=(4 - mode);
    }
  }
};

BmpDecoder.prototype.bit4 = function() {
  var xlen = Math.ceil(this.width/2);
  var mode = xlen%4;
  for (var y = this.height - 1; y >= 0; y--) {
    for (var x = 0; x < xlen; x++) {
      var b = this.buffer.readUInt8(this.pos++);
      var location = y * this.width * 4 + x*2*4;

      var before = b>>4;
      var after = b&0x0F;

      var rgb = this.palette[before];
      this.data[location] = rgb.blue;
      this.data[location + 1] = rgb.green;
      this.data[location + 2] = rgb.red;
      this.data[location + 3] = 0xFF;

      if(x*2+1>=this.width)break;

      rgb = this.palette[after];
      this.data[location+4] = rgb.blue;
      this.data[location+4 + 1] = rgb.green;
      this.data[location+4 + 2] = rgb.red;
      this.data[location+4 + 3] = 0xFF;
    }

    if (mode != 0){
      this.pos+=(4 - mode);
    }
  }

};

BmpDecoder.prototype.bit8 = function() {
  var mode = this.width%4;
  for (var y = this.height - 1; y >= 0; y--) {
    for (var x = 0; x < this.width; x++) {
      var b = this.buffer.readUInt8(this.pos++);
      var location = y * this.width * 4 + x*4;
      if(b < this.palette.length) {
        var rgb = this.palette[b];
        this.data[location] = rgb.blue;
        this.data[location + 1] = rgb.green;
        this.data[location + 2] = rgb.red;
        this.data[location + 3] = 0xFF;
      } else {
        this.data[location] = 0xFF;
        this.data[location + 1] = 0xFF;
        this.data[location + 2] = 0xFF;
        this.data[location + 3] = 0xFF;
      }
    }
    if (mode != 0){
      this.pos+=(4 - mode);
    }
  }
};

BmpDecoder.prototype.bit15 = function() {
  var dif_w =this.width % 3;
  var _11111 = parseInt("11111", 2),_1_5 = _11111;
  for (var y = this.height - 1; y >= 0; y--) {
    for (var x = 0; x < this.width; x++) {

      var B = this.buffer.readUInt16LE(this.pos);
      this.pos+=2;
      var blue = (B & _1_5) / _1_5 * 255 | 0;
      var green = (B >> 5 & _1_5 ) / _1_5 * 255 | 0;
      var red = (B >> 10 & _1_5) / _1_5 * 255 | 0;
      var alpha = (B>>15)?0xFF:0x00;

      var location = y * this.width * 4 + x * 4;
      this.data[location] = red;
      this.data[location + 1] = green;
      this.data[location + 2] = blue;
      this.data[location + 3] = alpha;
    }
    //skip extra bytes
    this.pos += dif_w;
  }
};

BmpDecoder.prototype.bit16 = function() {
  var dif_w =this.width % 3;
  var _11111 = parseInt("11111", 2),_1_5 = _11111;
  var _111111 = parseInt("111111", 2),_1_6 = _111111;
  for (var y = this.height - 1; y >= 0; y--) {
    for (var x = 0; x < this.width; x++) {

      var B = this.buffer.readUInt16LE(this.pos);
      this.pos+=2;
      var alpha = 0xFF;
      var blue = (B & _1_5) / _1_5 * 255 | 0;
      var green = (B >> 5 & _1_6 ) / _1_6 * 255 | 0;
      var red = (B >> 11) / _1_5 * 255 | 0;

      var location = y * this.width * 4 + x * 4;
      this.data[location] = red;
      this.data[location + 1] = green;
      this.data[location + 2] = blue;
      this.data[location + 3] = alpha;
    }
    //skip extra bytes
    this.pos += dif_w;
  }
};

BmpDecoder.prototype.bit24 = function() {
  //when height > 0
  for (var y = this.height - 1; y >= 0; y--) {
    for (var x = 0; x < this.width; x++) {
      var blue = this.buffer.readUInt8(this.pos++);
      var green = this.buffer.readUInt8(this.pos++);
      var red = this.buffer.readUInt8(this.pos++);
      var location = y * this.width * 4 + x * 4;
      this.data[location] = red;
      this.data[location + 1] = green;
      this.data[location + 2] = blue;
      this.data[location + 3] = 0xFF;
    }
    //skip extra bytes
    this.pos += (this.width % 4);
  }

};

/**
 * add 32bit decode func
 * @author soubok
 */
BmpDecoder.prototype.bit32 = function() {
  //when height > 0
  for (var y = this.height - 1; y >= 0; y--) {
    for (var x = 0; x < this.width; x++) {
      var blue = this.buffer.readUInt8(this.pos++);
      var green = this.buffer.readUInt8(this.pos++);
      var red = this.buffer.readUInt8(this.pos++);
      var alpha = this.buffer.readUInt8(this.pos++);
      var location = y * this.width * 4 + x * 4;
      this.data[location] = red;
      this.data[location + 1] = green;
      this.data[location + 2] = blue;
      this.data[location + 3] = alpha;
    }
    //skip extra bytes
    this.pos += (this.width % 4);
  }

};

BmpDecoder.prototype.getData = function() {
  return this.data;
};

module.exports = function(bmpData) {
  var decoder = new BmpDecoder(bmpData);
  return {
    data: decoder.getData(),
    width: decoder.width,
    height: decoder.height
  };
};
