//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));


/* ======================= core.js ======================= */
"use strict";
/* =====================================================================
   CaisMed — núcleo do front-end
   Dados ficam no localStorage só para demonstração.
   TODO(back-end): trocar cada DB.* por chamadas à API (rotas sugeridas no README).
   ===================================================================== */

// ---------- Utilitários ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const uid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isoLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hojeISO = () => isoLocal();
const partes = (iso) => iso.split("-").map(Number);
const addDias = (iso, n) => { const [y, m, d] = partes(iso); return isoLocal(new Date(y, m - 1, d + n)); };
const diaSemana = (iso) => { const [y, m, d] = partes(iso); return new Date(y, m - 1, d).getDay(); };
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtData = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const fmtDataLonga = (iso) => { if (!iso) return "—"; const [, m, d] = partes(iso); return `${DIAS[diaSemana(iso)]}, ${d} de ${MESES[m - 1]}`; };
const fmtHora = (ts) => new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const rotuloDia = (iso) => (iso === hojeISO() ? "Hoje" : iso === addDias(hojeISO(), 1) ? "Amanhã" : `${DIAS[diaSemana(iso)].slice(0, 3)}, ${fmtData(iso).slice(0, 5)}`);
const hm = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const hmStr = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const agoraMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const horasAte = (iso, h) => (new Date(`${iso}T${h || "00:00"}`) - new Date()) / 36e5;
const soDigitos = (s) => String(s || "").replace(/\D/g, "");
const fmtCPF = (c) => { const d = soDigitos(c); return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : c || "—"; };
const iniciais = (n) => String(n || "?").replace(/^(Dr\.|Dra\.)\s*/, "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const idade = (iso) => { if (!iso) return ""; const [y, m, d] = partes(iso); const h = new Date(); let a = h.getFullYear() - y; if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) a--; return a; };

// ---------- Ícones e logo ----------
const LOGO_SVG = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M38 14 h24 a6 6 0 0 1 6 6 v14 h14 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 H68 v14 a6 6 0 0 1 -6 6 H38 a6 6 0 0 1 -6 -6 V56 H18 a6 6 0 0 1 -6 -6 V40 a6 6 0 0 1 6 -6 h14 V20 a6 6 0 0 1 6 -6 Z" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round" fill="none"/><path class="heart" d="M58 30 c3.5-4 10-4 12.5 0.5 c2.5 4.5 -1 9 -12.5 17 c-11.5-8-15-12.5-12.5-17 c2.5-4.5 9-4.5 12.5-0.5Z"/></svg>`;
const ICONS = {
  home: "M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z",
  calendar: "M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M8 2v4M16 2v4",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  card: "M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M7 15h4",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 5-6 8-6s6.5 2 8 6",
  users: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c1-4 4-6 7-6s6 2 7 6M17 3.5a4 4 0 010 7.5M19 15c2 .8 3 3 3.5 6",
  file: "M6 2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zM14 2v6h6M8 13h8M8 17h5",
  wallet: "M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14h2",
  shield: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zM9 12l2 2 4-4",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 018 0v4",
  help: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 114 2c-.8.6-1.5 1-1.5 2M12 17h.01",
  bell: "M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4",
  chat: "M4 5h16v11H9l-5 4zM8 10h8",
  video: "M3 7h12v10H3zM15 11l6-4v10l-6-4",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  pin: "M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l5 5 9-10",
  x: "M6 6l12 12M18 6L6 18",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  settings: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  building: "M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 10h4a1 1 0 011 1v10M2 21h20M8 8h3M8 12h3M8 16h3",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6",
  download: "M12 3v12M7 10l5 5 5-5M4 21h16",
  print: "M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z",
  mic: "M9 3h6v12H9zM5 11a7 7 0 0014 0M12 18v3",
  send: "M5 12h14M13 6l6 6-6 6",
  right: "M9 6l6 6-6 6",
  back: "M15 18l-6-6 6-6",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14",
  alert: "M12 3l10 18H2zM12 10v5M12 18h.01",
  wrench: "M14.7 6.3a4 4 0 005 5L21 13l-8 8-4-4 8-8zM3 21l4-4",
  doc: "M7 3h10a2 2 0 012 2v16l-4-3-3 3-3-3-4 3V5a2 2 0 012-2zM9 8h6M9 12h6",
  a11y: "M12 6.3a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM5 8.5l7 1.5 7-1.5M12 10v4.5M12 14.5l-3.5 6M12 14.5l3.5 6",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  heart: "M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z",
};
const ico = (n, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${ICONS[n] || ""}"/></svg>`;

// ---------- Banco de dados (localStorage) ----------
const DB = {
  get(n, def = []) { try { const v = localStorage.getItem(n); return v ? JSON.parse(v) : structuredClone(def); } catch (e) { return structuredClone(def); } },
  set(n, v) { localStorage.setItem(n, JSON.stringify(v)); return v; },
  add(n, o) { const l = this.get(n); if (o.id == null) o.id = uid(); l.push(o); this.set(n, l); return o; },
  upd(n, id, p) { const l = this.get(n); const i = l.findIndex((x) => String(x.id) === String(id)); if (i < 0) return null; Object.assign(l[i], typeof p === "function" ? p(l[i]) : p); this.set(n, l); return l[i]; },
  del(n, id) { this.set(n, this.get(n).filter((x) => String(x.id) !== String(id))); },
  find(n, id) { return this.get(n).find((x) => String(x.id) === String(id)); },
};

// ---------- Dados padrão (demonstração) ----------
const ESP_PADRAO = [
  { id: "clinico_geral", nome: "Clínico Geral", valor: 180, duracao: 30 },
  { id: "pediatria", nome: "Pediatria", valor: 200, duracao: 30 },
  { id: "cardiologia", nome: "Cardiologia", valor: 260, duracao: 30 },
  { id: "dermatologia", nome: "Dermatologia", valor: 240, duracao: 30 },
  { id: "ortopedia", nome: "Ortopedia", valor: 250, duracao: 30 },
  { id: "ginecologia", nome: "Ginecologia", valor: 230, duracao: 30 },
];
const EXAMES_PADRAO = [
  { id: "hemograma", nome: "Hemograma Completo", valor: 45, preparo: "Jejum de 8 horas." },
  { id: "glicemia", nome: "Glicemia em Jejum", valor: 25, preparo: "Jejum de 8 horas." },
  { id: "lipidico", nome: "Perfil Lipídico", valor: 60, preparo: "Jejum de 12 horas." },
  { id: "ecg", nome: "Eletrocardiograma", valor: 90, preparo: "Sem preparo. Evite cremes no peito." },
  { id: "ultrassom", nome: "Ultrassom de Abdômen", valor: 160, preparo: "Jejum de 6 horas e bexiga cheia." },
  { id: "raiox", nome: "Raio-X de Tórax", valor: 110, preparo: "Sem preparo. Retire objetos de metal." },
];
const PLANOS_PADRAO = {
  essencial: { nome: "Plano Essencial", valor: 89.9, desc: "Consultas básicas e telemedicina", copart: 40 },
  conforto: { nome: "Plano Conforto", valor: 149.9, desc: "Essencial + exames simples e especialistas", copart: 30 },
  premium: { nome: "Plano Premium", valor: 249.9, desc: "Conforto + exames de imagem e check-up anual", copart: 20 },
  familia: { nome: "Plano Família", valor: 399.9, desc: "Cobertura Premium para até 4 pessoas", copart: 20 },
};
const UNIDADES_PADRAO = [
  { id: "u1", nome: "CaisMed Olinda", bairro: "Casa Caiada", cidade: "Olinda", endereco: "Av. Presidente Kennedy, 1200", fone: "(81) 3000-1001", horario: "Seg a Sex, 7h às 19h. Sáb, 8h às 12h", salas: 6, lat: -7.9855, lng: -34.8456, especialidades: ["clinico_geral", "pediatria", "dermatologia"], ativa: true },
  { id: "u2", nome: "CaisMed Recife", bairro: "Boa Viagem", cidade: "Recife", endereco: "Av. Domingos Ferreira, 850", fone: "(81) 3000-1002", horario: "Seg a Sex, 7h às 20h. Sáb, 8h às 13h", salas: 8, lat: -8.1189, lng: -34.9003, especialidades: ["clinico_geral", "cardiologia", "ortopedia"], ativa: true },
  { id: "u3", nome: "CaisMed Paulista", bairro: "Centro", cidade: "Paulista", endereco: "Av. Duque de Caxias, 430", fone: "(81) 3000-1003", horario: "Seg a Sex, 7h às 18h", salas: 4, lat: -7.9408, lng: -34.8731, especialidades: ["clinico_geral", "pediatria", "ginecologia"], ativa: true },
];
const blk = (unidadeId, dias, inicio, fim, duracao = 30) => ({ unidadeId, dias, inicio, fim, duracao });
const USUARIOS_PADRAO = [
  { id: "a1", perfil: "atendente", nome: "Marina Souza", matricula: "1001", senha: "caismed123", unidades: ["u1", "u2"], ativo: true },
  { id: "ad1", perfil: "admin", nome: "Administração CaisMed", matricula: "9001", senha: "caismed123", unidades: ["u1", "u2", "u3"], ativo: true },
  { id: "m1", perfil: "medico", nome: "Dra. Helena Cavalcanti", matricula: "2001", senha: "caismed123", crm: "CRM-PE 12345", especialidades: ["clinico_geral"], unidades: ["u1", "u2"], tele: true, nota: 4.9, bio: "Clínica geral com foco em prevenção e acompanhamento de doenças crônicas.", ativo: true, disp: [blk("u1", [1, 3, 5], "08:00", "12:00"), blk("u2", [2, 4], "13:00", "17:00")] },
  { id: "m2", perfil: "medico", nome: "Dr. Rafael Albuquerque", matricula: "2002", senha: "caismed123", crm: "CRM-PE 23456", especialidades: ["pediatria"], unidades: ["u1", "u3"], tele: true, nota: 4.8, bio: "Pediatra, atende de recém-nascidos a adolescentes.", ativo: true, disp: [blk("u1", [1, 2, 3, 4], "08:00", "12:00"), blk("u3", [5], "08:00", "12:00")] },
  { id: "m3", perfil: "medico", nome: "Dra. Camila Torres", matricula: "2003", senha: "caismed123", crm: "CRM-PE 34567", especialidades: ["dermatologia"], unidades: ["u1"], tele: false, nota: 4.7, bio: "Dermatologista clínica e estética.", ativo: true, disp: [blk("u1", [2, 4], "13:00", "17:00")] },
  { id: "m4", perfil: "medico", nome: "Dr. Bruno Teixeira", matricula: "2004", senha: "caismed123", crm: "CRM-PE 45678", especialidades: ["cardiologia"], unidades: ["u2"], tele: true, nota: 4.9, bio: "Cardiologista, check-up e risco cardiovascular.", ativo: true, disp: [blk("u2", [1, 2, 3], "08:00", "12:00")] },
  { id: "m5", perfil: "medico", nome: "Dr. André Lacerda", matricula: "2005", senha: "caismed123", crm: "CRM-PE 56789", especialidades: ["ortopedia"], unidades: ["u2"], tele: false, nota: 4.6, bio: "Ortopedista, lesões esportivas e coluna.", ativo: true, disp: [blk("u2", [4, 5], "08:00", "12:00")] },
  { id: "m6", perfil: "medico", nome: "Dra. Luíza Barros", matricula: "2006", senha: "caismed123", crm: "CRM-PE 67890", especialidades: ["ginecologia"], unidades: ["u3"], tele: true, nota: 4.8, bio: "Ginecologista e obstetra.", ativo: true, disp: [blk("u3", [1, 3], "13:00", "17:00")] },
  { id: "m7", perfil: "medico", nome: "Dr. Tiago Menezes", matricula: "2007", senha: "caismed123", crm: "CRM-PE 78901", especialidades: ["clinico_geral"], unidades: ["u3"], tele: true, nota: 4.5, bio: "Clínico geral, atendimento de rotina e urgências leves.", ativo: true, disp: [blk("u3", [1, 2, 3, 4, 5], "08:00", "12:00")] },
];
const CONFIG_PADRAO = { cancelarAteHoras: 24, lembreteHoras: 24, doisPassos: false, msgConfirmacao: "Sua consulta está confirmada. Chegue 10 minutos antes." };

let PLANOS = PLANOS_PADRAO;
const espLista = () => DB.get("especialidades", ESP_PADRAO);
const espNome = (k) => (espLista().find((e) => e.id === k) || {}).nome || k || "—";
const ESPECIALIDADES = new Proxy({}, { get: (_, k) => espNome(k) }); // compatível com o código antigo: ESPECIALIDADES[chave]
const proximoDiaSemana = (dias, de) => { for (let i = 0; i < 21; i++) { const d = addDias(de, i); if (dias.includes(diaSemana(d))) return d; } return de; };

function criarClienteDemo() {
    if (!DB.find("clientes", "c-demo")) {
      const cid = "c-demo";
      DB.add("clientes", { id: cid, nome: "Maria Oliveira", cpf: "39053344705", nascimento: "1988-04-12", telefone: "(81) 99999-0000", email: "maria@exemplo.com", cidade: "Olinda", plano: "conforto", pagamento: "Pix", senha: "123456", criadoEm: new Date().toISOString(), demo: true,
        dependentes: [{ id: "d1", nome: "Pedro Oliveira", nascimento: "2016-09-03", parentesco: "Filho", acesso: true }, { id: "d2", nome: "José Oliveira", nascimento: "1960-02-20", parentesco: "Pai", acesso: false }],
        consentimentos: { termos: true, lgpd: true, notificacoes: true, marketing: false, aceitoEm: new Date().toISOString() } });
      const hoje = hojeISO();
      const m1 = USUARIOS_PADRAO.find((u) => u.id === "m1");
      const prox = proximoDiaSemana([1, 3, 5], addDias(hoje, 1));
      DB.add("consultas", { id: uid(), pacienteId: cid, paciente: "Maria Oliveira", tipo: "consulta", especialidade: "clinico_geral", unidadeId: "u1", medicoId: m1.id, data: prox, horario: "09:00", status: "agendada", valor: 54, pago: false, origem: "app", criadoEm: new Date().toISOString(), historico: [{ quando: new Date().toISOString(), texto: "Agendada pelo aplicativo" }] });
      const passada = addDias(hoje, -9);
      const fid = uid();
      DB.add("consultas", { id: fid, pacienteId: cid, paciente: "Maria Oliveira", tipo: "consulta", especialidade: "clinico_geral", unidadeId: "u1", medicoId: m1.id, data: passada, horario: "10:00", status: "finalizada", valor: 54, pago: true, origem: "app", criadoEm: new Date().toISOString(), atendida: true,
        anamnese: "Dor de cabeça frequente há duas semanas, piora no fim do dia. Sem febre.", evolucao: "Quadro compatível com cefaleia tensional. Orientada sobre hidratação, sono e pausas durante o trabalho.", cid: "G44.2 - Cefaleia tensional", historico: [{ quando: new Date().toISOString(), texto: "Atendimento finalizado" }] });
      DB.add("documentos", { id: uid(), clienteId: cid, consultaId: fid, tipo: "receita", titulo: "Receita Médica", medicoId: m1.id, data: passada, itens: [{ nome: "Dipirona 500 mg", posologia: "1 comprimido a cada 6 horas se houver dor, por até 3 dias" }], visto: true });
      DB.add("documentos", { id: uid(), clienteId: cid, consultaId: fid, tipo: "exame_pedido", titulo: "Pedido de Exame: Hemograma Completo", medicoId: m1.id, data: passada, itens: [{ nome: "Hemograma Completo", posologia: "Justificativa: investigação de cefaleia" }], visto: true });
      DB.add("documentos", { id: uid(), clienteId: cid, tipo: "resultado", titulo: "Resultado: Hemograma Completo", medicoId: m1.id, data: addDias(hoje, -5), laudo: "Hemácias, leucócitos e plaquetas dentro dos valores de referência. Sem alterações.", itens: [], visto: false });
      DB.add("autorizacoes", { id: uid(), clienteId: cid, titulo: "Ultrassom de Abdômen", guiaNome: "guia-ultrassom.pdf", status: "em_analise", obs: "", criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() });
      notificar("cliente:" + cid, "Bem-vindo ao CaisMed", "Sua conta está pronta. Agende consultas, veja seus documentos e use a carteirinha digital.", "home.html");
    }
}

// Garante que as contas de demonstração existam e funcionem (mesmo com dados antigos no navegador)
function garantirDemo() {
  const us = DB.get("usuarios");
  USUARIOS_PADRAO.forEach((d) => { const u = us.find((x) => x.id === d.id); if (u) Object.assign(u, { matricula: d.matricula, senha: d.senha, ativo: true, perfil: d.perfil }); else us.push(structuredClone(d)); });
  DB.set("usuarios", us);
  criarClienteDemo();
  DB.upd("clientes", "c-demo", { cpf: "39053344705", senha: "123456" });
  PLANOS = DB.get("planos", PLANOS_PADRAO);
}

function seed() {
  const L = localStorage;
  if (L.getItem("caismed_seed") !== "3") {
    if (!L.getItem("unidades")) DB.set("unidades", UNIDADES_PADRAO);
    if (!L.getItem("usuarios")) DB.set("usuarios", USUARIOS_PADRAO);
    if (!L.getItem("especialidades")) DB.set("especialidades", ESP_PADRAO);
    if (!L.getItem("exames")) DB.set("exames", EXAMES_PADRAO);
    if (!L.getItem("planos")) DB.set("planos", PLANOS_PADRAO);
    if (!L.getItem("config")) DB.set("config", CONFIG_PADRAO);
    criarClienteDemo();
    migrar();
    L.setItem("caismed_seed", "3");
  }
  PLANOS = DB.get("planos", PLANOS_PADRAO);
}

// Atualiza dados criados pela versão anterior do app
function migrar() {
  const cls = DB.get("clientes");
  cls.forEach((c) => { c.dependentes ??= []; c.consentimentos ??= { termos: true, lgpd: true, notificacoes: true, marketing: false, aceitoEm: c.criadoEm }; });
  DB.set("clientes", cls);
  const cons = DB.get("consultas");
  const meds = DB.get("usuarios").filter((u) => u.perfil === "medico");
  cons.forEach((c) => {
    c.tipo ??= "consulta";
    if (!c.status) c.status = c.atendida ? "finalizada" : c.data ? "agendada" : "sugerida";
    if (!c.pacienteId) { const cl = cls.find((x) => x.nome === c.paciente); if (cl) c.pacienteId = cl.id; }
    if (!c.medicoId && c.data) { const m = meds.find((x) => (x.especialidades || []).includes(c.especialidade)); if (m) { c.medicoId = m.id; c.unidadeId ??= (m.unidades || [])[0]; } }
    c.historico ??= [];
  });
  DB.set("consultas", cons);
}

// ---------- Sessão e permissões ----------
const Sessao = {
  get perfil() { return sessionStorage.getItem("sessao"); },
  get id() { return sessionStorage.getItem("sessaoId"); },
  entrar(perfil, id) { sessionStorage.setItem("sessao", perfil); sessionStorage.setItem("sessaoId", id); },
  sair() { ["sessao", "sessaoId", "unidadeAtiva"].forEach((k) => sessionStorage.removeItem(k)); },
};
const HOME = { cliente: "home.html", atendente: "atendente-painel.html", medico: "medico-painel.html", admin: "admin-painel.html" };
const PERFIL_NOME = { cliente: "Paciente", atendente: "Atendente", medico: "Médico", admin: "Administrador" };
const eu = () => (Sessao.perfil === "cliente" ? DB.find("clientes", Sessao.id) : DB.find("usuarios", Sessao.id));
const unidadesDoUsuario = () => { const u = eu(); return DB.get("unidades").filter((x) => (u?.unidades || []).includes(x.id) && x.ativa !== false); };
const unidadeAtiva = () => { const sel = sessionStorage.getItem("unidadeAtiva"); if (sel === "") return ""; const ls = unidadesDoUsuario(); return ls.find((u) => u.id === sel)?.id || (Sessao.perfil === "medico" ? "" : ls[0]?.id || ""); };
const sair = () => { audit("Saiu do sistema"); Sessao.sair(); location.href = "login.html"; };

// ---------- Notificações e auditoria ----------
function notificar(para, titulo, texto, link) { DB.add("notificacoes", { para, titulo, texto, link: link || "", quando: new Date().toISOString(), lida: false }); }
function minhasNotifs() {
  const p = Sessao.perfil, id = Sessao.id;
  const chaves = p === "cliente" ? ["cliente:" + id] : p === "atendente" ? ["atendente", "atendente:" + id] : p === "medico" ? ["medico:" + id] : ["admin"];
  return DB.get("notificacoes").filter((n) => chaves.includes(n.para)).sort((a, b) => b.quando.localeCompare(a.quando));
}
function audit(acao, alvo = "") {
  const u = Sessao.perfil ? eu() : null;
  DB.add("auditoria", { quando: new Date().toISOString(), perfil: Sessao.perfil || "visitante", quem: u?.nome || "Visitante", acao, alvo });
}

// ---------- Regras de agenda ----------
const medicosAtivos = () => DB.get("usuarios").filter((u) => u.perfil === "medico" && u.ativo !== false);
const medicoPorId = (id) => DB.find("usuarios", id);
const unidadePorId = (id) => DB.find("unidades", id);
const nomeUnidade = (id) => (id === "online" ? "Teleconsulta (Online)" : unidadePorId(id)?.nome || "—");
const STATUS = { sugerida: ["Aguardando Horário", "warn"], agendada: ["Agendada", "info"], aguardando: ["Na Recepção", "warn"], em_atendimento: ["Em Atendimento", "info"], finalizada: ["Finalizada", "ok"], cancelada: ["Cancelada", "err"], faltou: ["Faltou", "err"] };
const badgeStatus = (s) => `<span class="badge ${(STATUS[s] || ["", "mute"])[1]}">${(STATUS[s] || [s])[0]}</span>`;
const TIPOS = { consulta: "Consulta", exame: "Exame", teleconsulta: "Teleconsulta" };

function slotsDoMedico(m, iso, unidadeId) {
  if ((m.folgas || []).some((f) => iso >= f.inicio && iso <= f.fim)) return [];
  const dow = diaSemana(iso);
  const base = new Map();
  (m.disp || []).filter((b) => b.dias.includes(dow) && (!unidadeId || unidadeId === "online" || b.unidadeId === unidadeId)).forEach((b) => {
    for (let t = hm(b.inicio); t + b.duracao <= hm(b.fim); t += b.duracao) base.set(hmStr(t), b.unidadeId);
  });
  const todas = DB.get("consultas").filter((c) => c.medicoId === m.id && c.data === iso && c.status !== "cancelada");
  const ocupados = new Set(todas.map((c) => c.horario));
  const bloq = new Set(DB.get("bloqueios").filter((b) => b.medicoId === m.id && b.data === iso).map((b) => b.horario));
  const passado = iso < hojeISO() ? 1e6 : iso === hojeISO() ? agoraMin() : -1;
  return [...base.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([h, u]) => ({ h, unidadeId: u, ocupado: ocupados.has(h), bloqueado: bloq.has(h), livre: !ocupados.has(h) && !bloq.has(h) && hm(h) > passado }));
}
function proximoLivre(m, unidadeId) {
  for (let i = 0; i < 45; i++) { const d = addDias(hojeISO(), i); const s = slotsDoMedico(m, d, unidadeId).find((x) => x.livre); if (s) return { data: d, h: s.h, unidadeId: s.unidadeId }; }
  return null;
}
function slotsExame(unidadeId, iso) {
  if (diaSemana(iso) === 0) return [];
  const usados = DB.get("consultas").filter((c) => c.tipo === "exame" && c.unidadeId === unidadeId && c.data === iso && c.status !== "cancelada");
  const passado = iso < hojeISO() ? 1e6 : iso === hojeISO() ? agoraMin() : -1;
  const out = [];
  for (let t = hm("07:00"); t <= hm("11:40"); t += 20) { const h = hmStr(t); out.push({ h, unidadeId, livre: usados.filter((c) => c.horario === h).length < 2 && t > passado }); }
  return out;
}
function valorCliente(cliente, tipo, chave) {
  const base = tipo === "exame" ? (DB.find("exames", chave) || {}).valor || 0 : (DB.find("especialidades", chave) || {}).valor || 0;
  const pl = cliente && PLANOS[cliente.plano];
  const pct = pl ? pl.copart ?? 100 : 100;
  return { base, pct, valor: Math.round(base * pct) / 100, plano: !!pl };
}
const cfg = () => DB.get("config", CONFIG_PADRAO);
const mapaURL = (u) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${u.endereco}, ${u.bairro}, ${u.cidade} PE`)}`;
const nomeServico = (c) => (c.tipo === "exame" ? (DB.find("exames", c.exame) || {}).nome || "Exame" : espNome(c.especialidade));

// Cria ou completa um agendamento, sem permitir horário repetido
function agendar(d) {
  const ehExame = d.tipo === "exame";
  const m = ehExame ? null : medicoPorId(d.medicoId);
  const livres = ehExame ? slotsExame(d.unidadeId, d.data) : m ? slotsDoMedico(m, d.data, d.tipo === "teleconsulta" ? "online" : d.unidadeId) : [];
  const alvo = livres.find((s) => s.h === d.horario);
  const mesmo = d.idExistente && DB.find("consultas", d.idExistente);
  if (!alvo || (!alvo.livre && !(mesmo && mesmo.data === d.data && mesmo.horario === d.horario))) return { ok: false, erro: "Esse horário acabou de ser ocupado. Escolha outro." };
  const cliente = DB.find("clientes", d.clienteId);
  const dep = d.dependenteId ? (cliente?.dependentes || []).find((x) => x.id === d.dependenteId) : null;
  const val = valorCliente(cliente, d.tipo, ehExame ? d.exame : d.especialidade);
  const base = { pacienteId: d.clienteId, dependenteId: d.dependenteId || null, paciente: dep ? `${dep.nome} (dependente)` : cliente?.nome || "Paciente", tipo: d.tipo, especialidade: ehExame ? "" : d.especialidade, exame: d.exame || "", unidadeId: d.tipo === "teleconsulta" ? "online" : d.unidadeId, medicoId: ehExame ? null : d.medicoId, data: d.data, horario: d.horario, valor: val.valor, pedidoNome: d.pedidoNome || "" };
  let c;
  if (d.idExistente) {
    c = DB.upd("consultas", d.idExistente, (x) => ({ ...base, status: "agendada", historico: [...(x.historico || []), { quando: new Date().toISOString(), texto: `${x.data ? "Remarcada" : "Horário marcado"} para ${fmtData(d.data)} às ${d.horario} por ${d.por || "paciente"}` }] }));
  } else {
    c = DB.add("consultas", { ...base, status: "agendada", pago: false, origem: d.origem || "app", criadoEm: new Date().toISOString(), historico: [{ quando: new Date().toISOString(), texto: `Agendada por ${d.por || "paciente"}` }] });
  }
  const quando = `${fmtData(d.data)} às ${d.horario}`;
  notificar("cliente:" + d.clienteId, "Consulta Confirmada", `${nomeServico(c)} em ${quando}, ${nomeUnidade(c.unidadeId)}${m ? " com " + m.nome : ""}.`, "consulta.html?id=" + c.id);
  notificar("atendente", "Novo Agendamento", `${base.paciente}: ${nomeServico(c)} em ${quando}.`, "agenda.html");
  if (m) notificar("medico:" + m.id, "Novo Paciente na Agenda", `${base.paciente} em ${quando}.`, "medico-painel.html");
  audit(d.idExistente ? "Remarcou consulta" : "Criou agendamento", `${base.paciente} - ${quando}`);
  return { ok: true, consulta: c };
}
function cancelarConsulta(id, motivo, por) {
  const c = DB.find("consultas", id);
  if (!c) return { ok: false, erro: "Consulta não encontrada." };
  if (por === "cliente" && c.data && horasAte(c.data, c.horario) < cfg().cancelarAteHoras) return { ok: false, erro: `O cancelamento online só é possível com ${cfg().cancelarAteHoras} horas de antecedência. Ligue para a clínica.` };
  DB.upd("consultas", id, (x) => ({ status: "cancelada", motivoCancelamento: motivo, historico: [...(x.historico || []), { quando: new Date().toISOString(), texto: `Cancelada por ${por}. Motivo: ${motivo}` }] }));
  notificar("cliente:" + c.pacienteId, "Consulta Cancelada", `${nomeServico(c)} de ${fmtData(c.data)} às ${c.horario} foi cancelada.`, "consultas.html");
  if (c.medicoId) notificar("medico:" + c.medicoId, "Consulta Cancelada", `${c.paciente} cancelou ${fmtData(c.data)} às ${c.horario}.`, "medico-painel.html");
  avisarEspera(c);
  audit("Cancelou consulta", `${c.paciente} - ${fmtData(c.data)} ${c.horario}`);
  return { ok: true };
}
function avisarEspera(c) {
  const fila = DB.get("espera").filter((e) => e.especialidade === c.especialidade && !e.avisado);
  fila.forEach((e) => { notificar("cliente:" + e.clienteId, "Abriu um Horário", `Abriu vaga de ${espNome(c.especialidade)} em ${fmtData(c.data)} às ${c.horario}. Corra para agendar.`, "agendamento.html?especialidade=" + c.especialidade); DB.upd("espera", e.id, { avisado: true }); });
}

// ---------- Máscaras e validação ----------
function cpfValido(c) {
  c = soDigitos(c);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || "");
function ligarMascaras(raiz = document) {
  $$('input[name="cpf"],input[data-mask="cpf"]', raiz).forEach((el) => {
    el.maxLength = 14; el.inputMode = "numeric"; el.autocomplete = "off";
    const f = () => { const d = soDigitos(el.value).slice(0, 11); el.value = d.length > 9 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d.length > 6 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}` : d.length > 3 ? `${d.slice(0, 3)}.${d.slice(3)}` : d; };
    el.addEventListener("input", f); f();
  });
  $$('input[type="tel"]', raiz).forEach((el) => {
    el.placeholder ||= "(81) 99999-9999"; el.inputMode = "tel";
    const f = () => { const d = soDigitos(el.value).slice(0, 11); el.value = d.length > 7 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d; };
    el.addEventListener("input", f); f();
  });
  // validação em tempo real (ao sair do campo)
  $$("input[data-valida]", raiz).forEach((el) => {
    const msg = document.createElement("span"); msg.className = "err-msg"; msg.setAttribute("role", "alert"); msg.hidden = true; el.insertAdjacentElement("afterend", msg);
    const v = () => {
      const t = el.dataset.valida, val = el.value.trim(); let erro = "";
      if (val) { if (t === "cpf" && !cpfValido(val)) erro = "CPF inválido. Confira os 11 números."; if (t === "email" && !emailValido(val)) erro = "E-mail inválido. Exemplo: nome@email.com"; if (t === "tel" && soDigitos(val).length < 10) erro = "Telefone incompleto. Inclua o DDD."; }
      el.setAttribute("aria-invalid", erro ? "true" : "false"); msg.textContent = erro; msg.hidden = !erro; return !erro;
    };
    el.addEventListener("blur", v); el.addEventListener("input", () => el.getAttribute("aria-invalid") === "true" && v());
    el._valida = v;
  });
}
const formularioValido = (form) => { let ok = true; $$("input[data-valida]", form).forEach((el) => { if (el._valida && !el._valida()) { ok = false; } }); const ruim = $('input[aria-invalid="true"]', form); if (ruim) ruim.focus(); return ok; };

// ---------- Interface: avisos, janelas, arquivos ----------
function toast(msg, tipo = "") {
  let a = $(".toast-area"); if (!a) { a = document.createElement("div"); a.className = "toast-area"; a.setAttribute("role", "status"); a.setAttribute("aria-live", "polite"); document.body.appendChild(a); }
  const t = document.createElement("div"); t.className = "toast " + tipo; t.textContent = msg; a.appendChild(t); setTimeout(() => t.remove(), 4200);
}
function abrirModal({ titulo, corpo = "", botoes = [], lateral = false, aoAbrir }) {
  const ov = document.createElement("div"); ov.className = "overlay open" + (lateral ? " side" : "");
  ov.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="modal-top"><h2>${esc(titulo)}</h2><button type="button" class="x-btn" aria-label="Fechar">${ico("x")}</button></div><div class="modal-body"></div><div class="actions"></div></div>`;
  const body = $(".modal-body", ov); typeof corpo === "string" ? (body.innerHTML = corpo) : body.appendChild(corpo);
  const acoes = $(".actions", ov); if (!botoes.length) acoes.remove();
  const anterior = document.activeElement;
  const fechar = () => { ov.remove(); document.removeEventListener("keydown", tecla); anterior && anterior.focus && anterior.focus(); };
  const tecla = (e) => { if (e.key === "Escape") fechar(); };
  document.addEventListener("keydown", tecla);
  botoes.forEach((b) => { const el = document.createElement("button"); el.type = "button"; el.className = "btn " + (b.classe || ""); el.textContent = b.rotulo; el.addEventListener("click", async () => { const r = b.aoClicar ? await b.aoClicar(el, ov) : undefined; if (r !== false) fechar(); }); acoes.appendChild(el); });
  $(".x-btn", ov).addEventListener("click", fechar);
  ov.addEventListener("click", (e) => { if (e.target === ov) fechar(); });
  document.body.appendChild(ov);
  (body.querySelector("input,select,textarea,button") || $(".x-btn", ov)).focus();
  aoAbrir && aoAbrir(ov, fechar);
  return { fechar, el: ov };
}
const confirmar = (msg, { ok = "Confirmar", perigo = false, titulo = "Confirmar Ação" } = {}) => new Promise((res) => {
  let r = false;
  const m = abrirModal({ titulo, corpo: `<p>${esc(msg)}</p>`, botoes: [{ rotulo: "Voltar", classe: "outline", aoClicar: () => { r = false; } }, { rotulo: ok, classe: perigo ? "danger" : "", aoClicar: () => { r = true; } }] });
  const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); res(r); } }); obs.observe(document.body, { childList: true });
});
function baixarArquivo(nome, conteudo, tipo = "text/plain") {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo + ";charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const baixarCSV = (nome, linhas) => baixarArquivo(nome, "\ufeff" + linhas.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv");
function imprimirDoc(titulo, corpo) {
  const w = window.open("", "_blank"); if (!w) return toast("Libere as janelas pop-up para imprimir.", "err");
  w.document.write(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:32px auto;padding:0 20px;color:#000;line-height:1.5}h1{font-size:22px;color:#132C77;border-bottom:3px solid #132C77;padding-bottom:8px}.m{color:#444;font-size:14px}li{margin:6px 0}.sig{margin-top:56px;border-top:1px solid #000;width:280px;padding-top:4px;font-size:14px}</style></head><body>${corpo}<script>window.onload=()=>setTimeout(()=>print(),200)<\/script></body></html>`);
  w.document.close();
}
function qrSVG(texto) { const q = qrcode(0, "M"); q.addData(texto); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
const vazio = (titulo, texto = "", acao = "") => `<div class="empty"><b>${esc(titulo)}</b>${esc(texto)}${acao ? `<div style="margin-top:12px">${acao}</div>` : ""}</div>`;

// ---------- Navegação por perfil ----------
const NAV = {
  cliente: {
    principal: [["home.html", "Início", "home"], ["consultas.html", "Consultas", "calendar", ["consulta.html", "agendamento.html", "agendamento-confirmado.html", "teleconsulta.html"]], ["documentos.html", "Exames", "file"], ["carteirinha.html", "Carteirinha", "card"], ["perfil.html", "Perfil", "user", ["perfil-editar.html", "privacidade.html", "dependentes.html"]]],
    mais: [["triagem.html", "Triagem", "chat"], ["pagamento.html", "Pagamentos", "wallet"], ["autorizacoes.html", "Autorizações", "shield"], ["dependentes.html", "Dependentes", "users"], ["privacidade.html", "Privacidade", "lock"], ["ajuda.html", "Ajuda e Ouvidoria", "help"]],
  },
  atendente: {
    principal: [["atendente-painel.html", "Painel", "home"], ["agenda.html", "Agenda", "calendar", ["agendar-paciente.html"]], ["fila.html", "Fila", "clock"], ["pacientes.html", "Pacientes", "users", ["cliente-form.html", "paciente.html"]], ["caixa.html", "Caixa", "wallet"]],
    mais: [["autorizacoes.html", "Autorizações", "shield"], ["ajuda.html", "Ajuda", "help"]],
  },
  medico: {
    principal: [["medico-painel.html", "Agenda", "calendar", ["atendimento.html"]], ["meus-pacientes.html", "Pacientes", "users", ["prontuario.html"]], ["horarios.html", "Horários", "clock"], ["medico-perfil.html", "Perfil", "user"]],
    mais: [["ajuda.html", "Ajuda", "help"]],
  },
  admin: {
    principal: [["admin-painel.html", "Painel", "chart"], ["admin-unidades.html", "Unidades", "building"], ["admin-usuarios.html", "Usuários", "users"], ["admin-servicos.html", "Serviços", "list"], ["admin-financeiro.html", "Financeiro", "wallet"]],
    mais: [["admin-auditoria.html", "Auditoria", "shield"], ["admin-ouvidoria.html", "Ouvidoria", "chat"], ["admin-config.html", "Configurações", "settings"]],
  },
};

// ---------- Estrutura das telas (cabeçalho, menu, acessibilidade) ----------
const Pagina = { ok: true };
const arquivoAtual = () => location.pathname.split("/").pop() || "index.html";
function guarda() {
  const perfis = (document.body.dataset.perfis || "").split(",").filter(Boolean);
  if (!perfis.length || perfis[0] === "*") return;
  if (!Sessao.perfil || !eu()) { Pagina.ok = false; location.replace(`login.html?expirada=1&volta=${encodeURIComponent(arquivoAtual() + location.search)}`); return; }
  if (!perfis.includes(Sessao.perfil)) { Pagina.ok = false; location.replace("estado.html?tipo=sem-permissao"); }
}
function painelAcessibilidade() {
  const TEMAS = [{ id: "claro", nome: "Claro", desc: "Fundo claro, padrão do app" }, { id: "escuro", nome: "Escuro", desc: "Fundo escuro, melhor à noite" }];
  const aplicar = (id) => { document.documentElement.setAttribute("data-tema", id); try { localStorage.setItem("tema", id); } catch (e) {} $$(".a11y-opt").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tema === id))); };
  const fonte = (n) => { document.documentElement.classList.remove("fonte-1", "fonte-2"); if (n) document.documentElement.classList.add("fonte-" + n); try { localStorage.setItem("fonte", n || ""); } catch (e) {} };
  const abrir = () => abrirModal({
    titulo: "Acessibilidade",
    corpo: `<p class="muted">Escolha o tema e o tamanho do texto. As cores do app continuam as mesmas.</p><div class="stack" style="margin-top:10px">${TEMAS.map((t) => `<button type="button" class="a11y-opt" data-tema="${t.id}" aria-pressed="false"><span class="a11y-swatch sw-${t.id}"></span><span><b>${t.nome}</b><small>${t.desc}</small></span></button>`).join("")}
      <div><span class="label">Tamanho do texto</span><div class="fonte-ctl" style="margin-top:6px"><button type="button" class="btn outline sm" data-f="">Normal</button><button type="button" class="btn outline sm" data-f="1">Grande</button><button type="button" class="btn outline sm" data-f="2">Muito Grande</button></div></div></div>`,
    aoAbrir: (ov) => { aplicar(document.documentElement.getAttribute("data-tema") || "claro"); $$(".a11y-opt", ov).forEach((b) => b.addEventListener("click", () => aplicar(b.dataset.tema))); $$("[data-f]", ov).forEach((b) => b.addEventListener("click", () => fonte(b.dataset.f))); },
  });
  $$('[data-slot="a11y"]').forEach((slot) => { const b = document.createElement("button"); b.type = "button"; b.className = "ibtn"; b.setAttribute("aria-label", "Acessibilidade"); b.title = "Acessibilidade"; b.innerHTML = ico("a11y"); b.addEventListener("click", abrir); slot.replaceWith(b); });
}
function montarShell() {
  $$(".logo-icon").forEach((el) => (el.innerHTML = LOGO_SVG));
  const perfil = Sessao.perfil, b = document.body;
  const pf = b.dataset.perfis || "";
  if (!pf.length || (pf === "*" && !(perfil && eu()))) {
    if (pf === "*") { const h = document.createElement("header"); h.className = "site-header"; h.innerHTML = `<a class="brand" href="index.html"><span class="logo-icon"></span><span>CaisMed</span></a><span class="grow"></span><span data-slot="a11y"></span><a class="btn outline" href="login.html">Entrar</a>`; $(".app").insertBefore(h, $(".app").firstChild); $$(".logo-icon", h).forEach((el) => (el.innerHTML = LOGO_SVG)); }
    painelAcessibilidade(); return;
  }
  const app = $(".app"), nav = NAV[perfil], u = eu();
  const atual = arquivoAtual();
  // cabeçalho
  const h = document.createElement("header"); h.className = "app-header";
  const voltar = b.dataset.voltar;
  const nUnid = unidadesDoUsuario();
  const seletor = (perfil === "atendente" || perfil === "medico") && nUnid.length ? `<label class="unit-pick"><span class="sr">Unidade ativa</span><select id="unidade-ativa">${perfil === "medico" ? `<option value="">Todas as Unidades</option>` : ""}${nUnid.map((x) => `<option value="${x.id}" ${x.id === unidadeAtiva() ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></label>` : "";
  const naoLidas = minhasNotifs().filter((n) => !n.lida).length;
  h.innerHTML = `${voltar ? `<a href="${voltar}" class="ibtn" aria-label="Voltar">${ico("back")}</a>` : ""}<a class="brand" href="${HOME[perfil]}"><span class="logo-icon"></span><span>CaisMed</span></a><span class="top-date">${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span><span class="grow"></span>${seletor}<span data-slot="a11y"></span><a class="ibtn" href="notificacoes.html" aria-label="Notificações${naoLidas ? `, ${naoLidas} novas` : ""}">${ico("bell")}${naoLidas ? `<span class="dot">${naoLidas > 9 ? "9+" : naoLidas}</span>` : ""}</a><button type="button" class="ibtn" id="btn-user" aria-haspopup="true" aria-expanded="false" aria-label="Menu da conta"><b>${esc(iniciais(u.nome))}</b></button>
    <div class="user-menu" id="user-menu"><div class="who"><b>${esc(u.nome)}</b><small>${PERFIL_NOME[perfil]}</small></div>${perfil === "cliente" ? `<a href="perfil.html">${ico("user")} Meu Perfil</a>` : ""}${perfil === "medico" ? `<a href="medico-perfil.html">${ico("user")} Meu Perfil</a>` : ""}<a href="notificacoes.html">${ico("bell")} Notificações</a><a href="ajuda.html">${ico("help")} Ajuda</a><button type="button" id="btn-sair">${ico("logout")} Sair da Conta</button></div>`;
  app.insertBefore(h, app.firstChild);
  $$(".logo-icon", h).forEach((el) => (el.innerHTML = LOGO_SVG));
  // menu
  const item = ([href, rot, ic, also = []], extra = "") => `<a href="${href}" class="${[href, ...also].includes(atual) ? "on" : ""} ${extra}" ${[href, ...also].includes(atual) ? 'aria-current="page"' : ""}><span class="ni">${ico(ic)}</span><span>${rot}</span></a>`;
  const n = document.createElement("nav"); n.className = "nav"; n.setAttribute("aria-label", "Menu principal");
  n.innerHTML = `<a class="nav-brand" href="${HOME[perfil]}"><span class="logo-icon"></span><span>CaisMed</span></a>${nav.principal.map((i) => item(i)).join("")}${nav.mais.length ? `<span class="nav-sec">Mais Opções</span>` + nav.mais.map((i) => item(i, "only-wide")).join("") : ""}<div class="nav-foot"><b>${esc(u.nome)}</b><br>${PERFIL_NOME[perfil]}</div>`;
  document.body.appendChild(n);
  document.body.classList.add("com-nav");
  $$(".logo-icon", n).forEach((el) => (el.innerHTML = LOGO_SVG));
  // eventos
  const menu = $("#user-menu"), bu = $("#btn-user");
  bu.addEventListener("click", (e) => { e.stopPropagation(); const a = menu.classList.toggle("open"); bu.setAttribute("aria-expanded", a); });
  document.addEventListener("click", (e) => { if (!menu.contains(e.target)) { menu.classList.remove("open"); bu.setAttribute("aria-expanded", "false"); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") menu.classList.remove("open"); });
  $("#btn-sair").addEventListener("click", sair);
  $("#unidade-ativa")?.addEventListener("change", (e) => { sessionStorage.setItem("unidadeAtiva", e.target.value); location.reload(); });
  painelAcessibilidade();
}

// ---------- Abas, pagamentos e pendências (usados por várias telas) ----------
function ligarAbas(raiz = document) {
  const bs = $$(".tab-btn", raiz);
  bs.forEach((b) => b.addEventListener("click", () => { bs.forEach((x) => x.classList.remove("active")); $$(".tab-panel", raiz).forEach((p) => p.classList.remove("active")); b.classList.add("active"); $("#" + b.dataset.tab).classList.add("active"); }));
}
function pendencias(c) {
  const mes = hojeISO().slice(0, 7), pl = PLANOS[c.plano], pags = DB.get("pagamentos").filter((p) => p.clienteId === c.id), out = [];
  if (pl && !pags.some((p) => p.tipo === "mensalidade" && p.mes === mes)) out.push({ tipo: "mensalidade", descricao: `${pl.nome}, ${mes.slice(5)}/${mes.slice(0, 4)}`, valor: pl.valor, mes });
  DB.get("consultas").filter((x) => x.pacienteId === c.id && x.status === "finalizada" && !x.pago && x.valor > 0).forEach((x) => out.push({ tipo: "consulta", consultaId: x.id, descricao: `${nomeServico(x)} de ${fmtData(x.data)}`, valor: x.valor }));
  return out;
}
function registrarPagamento(c, pend, metodo, por, unidadeId) {
  // TODO: trocar por POST /faturas/:id/pagamento (back-end)
  const p = DB.add("pagamentos", { clienteId: c.id, tipo: pend.tipo, consultaId: pend.consultaId || null, mes: pend.mes || null, descricao: pend.descricao, valor: pend.valor, metodo, data: hojeISO(), quando: new Date().toISOString(), por, unidadeId: unidadeId || null });
  if (pend.consultaId) DB.upd("consultas", pend.consultaId, { pago: true });
  notificar("cliente:" + c.id, "Pagamento Confirmado", `${pend.descricao}: ${brl(pend.valor)} (${metodo}).`, "pagamento.html");
  audit("Registrou pagamento", `${c.nome} - ${pend.descricao} - ${brl(pend.valor)}`);
  return p;
}
function fazerCheckin(id, aoFim) {
  const c = DB.find("consultas", id); if (!c) return;
  DB.upd("consultas", id, (x) => ({ status: "aguardando", chegouEm: new Date().toISOString(), historico: [...(x.historico || []), { quando: new Date().toISOString(), texto: `Check-in feito (${Sessao.perfil === "cliente" ? "online" : "recepção"})` }] }));
  notificar("atendente", "Paciente Chegou", `${c.paciente} fez check-in para ${c.horario}.`, "fila.html");
  if (c.medicoId) notificar("medico:" + c.medicoId, "Paciente Chegou", `${c.paciente} está aguardando (${c.horario}).`, "medico-painel.html");
  audit("Check-in", `${c.paciente} - ${c.horario}`);
  toast("Check-in feito! Aguarde ser chamado.", "ok"); aoFim && aoFim();
}

// Executa o código da página só quando o acesso está liberado
const ready = (fn) => { if (Pagina.ok) fn(); };

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
seed();
guarda();
if (Pagina.ok) montarShell();
ligarMascaras();


/* ======================= agendar.js ======================= */
"use strict";
/* C02 / C03 / A03: agendamento em etapas. Serve o paciente (agendamento.html) e o atendente (agendar-paciente.html). */

const kmEntre = (a, b) => { const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(x)); };
const ROT_ETAPA = { paciente: "Paciente", tipo: "Tipo de Atendimento", esp: "Especialidade", exame: "Exame", unidade: "Unidade", medico: "Médico", horario: "Dia e Horário", revisar: "Revisar e Confirmar" };

function iniciarWizard(modo) {
  const q = new URLSearchParams(location.search);
  const raiz = $("#etapa");
  const S = { tipo: q.get("tipo") || "consulta", especialidade: q.get("especialidade") || "", exame: q.get("exame") || "", unidadeId: q.get("unidade") || "", qualquer: false, medicoId: q.get("medico") || "", data: q.get("data") || "", horario: q.get("horario") || "", dependenteId: "", clienteId: modo === "cliente" ? Sessao.id : q.get("cliente") || "", idExistente: "", pedidoNome: "", i: 0, pos: null };
  const idRem = q.get("remarcar") || q.get("consultaId");
  let preset = ["especialidade", "medico", "unidade", "exame", "data", "cliente"].some((k) => q.get(k)) || q.get("tipo");
  if (idRem) {
    const c = DB.find("consultas", idRem);
    if (c) { Object.assign(S, { tipo: c.tipo, especialidade: c.especialidade, exame: c.exame, unidadeId: c.tipo === "teleconsulta" || !c.data ? "" : c.unidadeId, medicoId: c.medicoId || "", clienteId: c.pacienteId, dependenteId: c.dependenteId || "", idExistente: c.id, data: "", horario: "" }); S.remarcando = !!c.data; preset = true; if (c.data) S.unidadeId = c.unidadeId; if (!c.data) S.medicoId = ""; }
  }
  if (S.medicoId && !S.especialidade) S.especialidade = (medicoPorId(S.medicoId)?.especialidades || [])[0] || "";
  if (S.unidadeId && S.especialidade === "" && S.tipo === "exame") S.especialidade = "";
  const cliente = () => DB.find("clientes", S.clienteId);
  const passos = () => (modo === "atendente" ? ["paciente"] : []).concat(["tipo"], S.tipo === "exame" ? ["exame", "unidade", "horario", "revisar"] : S.tipo === "teleconsulta" ? ["esp", "medico", "horario", "revisar"] : ["esp", "unidade", "medico", "horario", "revisar"]);
  const completo = (p) => ({ paciente: !!S.clienteId, tipo: !!preset, esp: !!S.especialidade, exame: !!S.exame, unidade: !!(S.unidadeId || S.qualquer), medico: !!S.medicoId, horario: !!(S.data && S.horario), revisar: false })[p];
  const primeiroIncompleto = () => { const ps = passos(); const i = ps.findIndex((p) => !completo(p)); return i < 0 ? ps.length - 1 : i; };
  if (idRem && S.remarcando) { S.i = passos().indexOf("horario"); } else S.i = primeiroIncompleto();
  const ir = (p) => { S.i = Math.max(0, passos().indexOf(p)); desenhar(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const proximo = () => { const ps = passos(); S.i = Math.min(S.i + 1, ps.length - 1); while (S.i < ps.length - 1 && completo(ps[S.i]) && ps[S.i] !== "horario" && ps[S.i] !== "revisar" && ps[S.i] !== "tipo" && ps[S.i] !== "paciente") S.i++; desenhar(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const opt = (id, ic, titulo, sub, sel, extra = "") => `<button type="button" class="opt" data-id="${esc(id)}" aria-pressed="${sel}">${ico(ic)}<span class="grow"><b>${titulo}</b><small>${sub}</small></span>${extra}</button>`;
  const unidadeId = () => (S.tipo === "teleconsulta" ? "online" : S.qualquer ? null : S.unidadeId || null);

  const E = {
    paciente() {
      raiz.innerHTML = `<div class="field"><label for="busca-pac">Buscar paciente por nome ou CPF</label><input id="busca-pac" type="search" placeholder="Digite pelo menos 3 letras ou números" autocomplete="off"></div><div class="stack" id="res-pac"></div><div id="dep-box"></div>`;
      const lista = () => {
        const t = $("#busca-pac").value.trim().toLowerCase(), d = soDigitos(t);
        const sel = DB.find("clientes", S.clienteId);
        const itens = DB.get("clientes").filter((c) => (t.length >= 3 && (c.nome.toLowerCase().includes(t) || (d.length >= 3 && c.cpf.includes(d)))) || c.id === S.clienteId);
        $("#res-pac").innerHTML = itens.length ? itens.slice(0, 8).map((c) => opt(c.id, "user", esc(c.nome), `CPF ${fmtCPF(c.cpf)}`, c.id === S.clienteId)).join("") : t.length >= 3 ? vazio("Paciente Não Encontrado", "Cadastre o paciente antes de agendar.", `<a class="btn sm" href="cliente-form.html">Cadastrar Paciente</a>`) : "";
        $$("#res-pac .opt").forEach((b) => b.addEventListener("click", () => { S.clienteId = b.dataset.id; S.dependenteId = ""; lista(); }));
        const deps = (sel?.dependentes || []).filter((x) => idade(x.nascimento) < 18 || x.acesso);
        $("#dep-box").innerHTML = sel ? `<div class="field" style="margin-top:14px"><label for="dep">Atendimento para</label><select id="dep"><option value="">${esc(sel.nome)} (titular)</option>${deps.map((x) => `<option value="${x.id}" ${x.id === S.dependenteId ? "selected" : ""}>${esc(x.nome)} (${esc(x.parentesco)})</option>`).join("")}</select></div><button class="btn block" type="button" id="seguir">Continuar</button>` : "";
        $("#dep")?.addEventListener("change", (e) => (S.dependenteId = e.target.value));
        $("#seguir")?.addEventListener("click", proximo);
      };
      $("#busca-pac").addEventListener("input", lista); lista();
    },
    tipo() {
      const deps = (cliente()?.dependentes || []).filter((x) => idade(x.nascimento) < 18 || x.acesso);
      raiz.innerHTML = `${deps.length && modo === "cliente" ? `<div class="field"><label for="dep">Para quem é o atendimento?</label><select id="dep"><option value="">Para mim</option>${deps.map((x) => `<option value="${x.id}" ${x.id === S.dependenteId ? "selected" : ""}>${esc(x.nome)} (${esc(x.parentesco)})</option>`).join("")}</select></div>` : ""}
      <div class="stack">${opt("consulta", "calendar", "Consulta Presencial", "Escolha a unidade, o médico e o horário", S.tipo === "consulta")}${opt("exame", "file", "Exame", "Laboratório e imagem, com orientação de preparo", S.tipo === "exame")}${opt("teleconsulta", "video", "Teleconsulta", "Atendimento por vídeo, sem sair de casa", S.tipo === "teleconsulta")}</div>`;
      $("#dep")?.addEventListener("change", (e) => (S.dependenteId = e.target.value));
      $$(".opt", raiz).forEach((b) => b.addEventListener("click", () => { if (S.tipo !== b.dataset.id) Object.assign(S, { medicoId: "", unidadeId: "", qualquer: false, data: "", horario: "", especialidade: "", exame: "" }); S.tipo = b.dataset.id; preset = true; proximo(); }));
    },
    esp() {
      const meds = medicosAtivos().filter((m) => (S.tipo !== "teleconsulta" || m.tele) && (!S.unidadeId || m.unidades.includes(S.unidadeId)));
      const ids = new Set(meds.flatMap((m) => m.especialidades));
      const l = espLista().filter((e) => ids.has(e.id));
      raiz.innerHTML = `<div class="stack">${l.map((e) => { const v = valorCliente(cliente(), "consulta", e.id); return opt(e.id, "heart", esc(e.nome), `${v.plano ? `Seu valor: ${brl(v.valor)} (coparticipação de ${v.pct}%)` : `Particular: ${brl(v.base)}`}`, e.id === S.especialidade); }).join("") || vazio("Sem Médicos Disponíveis", "Não há médicos para esse tipo de atendimento no momento.")}</div>`;
      $$(".opt", raiz).forEach((b) => b.addEventListener("click", () => { if (S.especialidade !== b.dataset.id) Object.assign(S, { medicoId: "", data: "", horario: "" }); S.especialidade = b.dataset.id; proximo(); }));
    },
    exame() {
      const pend = DB.get("documentos").filter((d) => d.clienteId === S.clienteId && d.tipo === "exame_pedido");
      raiz.innerHTML = `${pend.length ? `<p class="muted" style="margin-bottom:8px">Você tem pedidos de exame feitos pelo seu médico. Toque em um exame abaixo para agendar.</p>` : ""}
      <div class="stack">${DB.get("exames", EXAMES_PADRAO).map((x) => { const v = valorCliente(cliente(), "exame", x.id); return opt(x.id, "file", esc(x.nome), `${esc(x.preparo)} · ${v.plano ? `Seu valor: ${brl(v.valor)}` : brl(v.base)}`, x.id === S.exame); }).join("")}</div><div id="exame-det"></div>`;
      const det = () => { const x = DB.find("exames", S.exame); $("#exame-det").innerHTML = x ? `<div class="card pale stack" style="margin-top:14px"><b>Preparo: ${esc(x.preparo)}</b><div class="field" style="margin:0"><label for="pedido">Pedido médico (foto ou PDF)</label><input id="pedido" type="file" accept="image/*,application/pdf"><span class="hint">Leve o pedido original no dia do exame.</span></div><button type="button" class="btn block" id="seguir">Continuar</button></div>` : ""; $("#pedido")?.addEventListener("change", (e) => (S.pedidoNome = e.target.files[0]?.name || "")); $("#seguir")?.addEventListener("click", proximo); };
      $$(".opt", raiz).forEach((b) => b.addEventListener("click", () => { S.exame = b.dataset.id; $$(".opt", raiz).forEach((o) => o.setAttribute("aria-pressed", String(o === b))); det(); $("#exame-det").scrollIntoView({ behavior: "smooth", block: "nearest" }); }));
      det();
    },
    unidade() {
      let us = DB.get("unidades").filter((u) => u.ativa !== false && (S.tipo === "exame" || u.especialidades.includes(S.especialidade)));
      if (S.pos) us = us.map((u) => ({ ...u, km: u.lat ? kmEntre(S.pos, u) : 999 })).sort((a, b) => a.km - b.km);
      raiz.innerHTML = `<div class="stack">${S.tipo !== "exame" ? opt("qualquer", "pin", "Qualquer Unidade", "Mostra o primeiro horário livre em toda a rede", S.qualquer) : ""}${us.map((u) => opt(u.id, "building", esc(u.nome), `${esc(u.endereco)}, ${esc(u.bairro)}${u.km != null ? ` · a ${u.km.toFixed(1).replace(".", ",")} km de você` : ""}`, u.id === S.unidadeId && !S.qualquer)).join("")}</div>
      <button type="button" class="link" id="loc">${ico("pin", 'style="width:18px;height:18px;vertical-align:-3px"')} Usar minha localização para ver a distância</button>`;
      $("#loc").addEventListener("click", () => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => { S.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; E.unidade(); }, () => toast("Não foi possível pegar sua localização.", "err")) : toast("Seu navegador não permite localização.", "err"));
      $$(".opt", raiz).forEach((b) => b.addEventListener("click", () => { const id = b.dataset.id; Object.assign(S, { medicoId: S.tipo === "exame" ? "" : "", data: "", horario: "" }); S.qualquer = id === "qualquer"; S.unidadeId = S.qualquer ? "" : id; proximo(); }));
    },
    medico() {
      const ms = medicosAtivos().filter((m) => m.especialidades.includes(S.especialidade) && (S.tipo !== "teleconsulta" || m.tele) && (!S.unidadeId || S.tipo === "teleconsulta" || m.unidades.includes(S.unidadeId)));
      raiz.innerHTML = ms.length ? `<div class="stack">${ms.map((m) => { const p = proximoLivre(m, unidadeId()); return `<button type="button" class="doc-card" data-id="${m.id}" aria-pressed="${m.id === S.medicoId}"><span class="avatar lg">${esc(iniciais(m.nome))}</span><span class="grow"><b>${esc(m.nome)}</b><small>${esc(m.crm)} · <span class="rating">★ ${m.nota.toFixed(1)}</span></small><small>${p ? `Próximo horário livre: <b>${rotuloDia(p.data)} às ${p.h}</b>` : "Sem horários nos próximos dias"}</small></span></button>`; }).join("")}</div>`
        : vazio("Sem Médicos Para Essa Escolha", "Você pode entrar na lista de espera e avisamos quando abrir um horário.", `<button class="btn sm" id="espera" type="button">Entrar na Lista de Espera</button>`);
      $("#espera")?.addEventListener("click", () => { DB.add("espera", { clienteId: S.clienteId, especialidade: S.especialidade, unidadeId: S.unidadeId, criadoEm: new Date().toISOString(), avisado: false }); notificar("atendente", "Lista de Espera", `${cliente()?.nome} aguarda vaga de ${espNome(S.especialidade)}.`, "espera.html"); toast("Você está na lista de espera. Vamos avisar quando abrir um horário.", "ok"); });
      $$(".doc-card", raiz).forEach((b) => b.addEventListener("click", () => { if (S.medicoId !== b.dataset.id) Object.assign(S, { data: "", horario: "" }); S.medicoId = b.dataset.id; proximo(); }));
    },
    horario() {
      const m = medicoPorId(S.medicoId), exame = S.tipo === "exame";
      const slotsDia = (iso) => (exame ? slotsExame(S.unidadeId, iso) : m ? slotsDoMedico(m, iso, unidadeId()) : []);
      const dias = Array.from({ length: 21 }, (_, i) => addDias(hojeISO(), i));
      const livres = (iso) => slotsDia(iso).filter((s) => s.livre).length;
      if (!S.data || livres(S.data) === 0) { const d = dias.find((x) => livres(x) > 0); if (d && !(S.data && S.horario && livres(S.data))) S.data = d; }
      raiz.innerHTML = `<div class="card pale row" style="margin-bottom:14px">${m ? `<span class="avatar">${esc(iniciais(m.nome))}</span><span><b>${esc(m.nome)}</b><br><small class="muted">${esc(espNome(S.especialidade))}</small></span>` : `<span class="avatar">${ico("file", 'style="width:22px"')}</span><span><b>${esc((DB.find("exames", S.exame) || {}).nome || "Exame")}</b><br><small class="muted">${esc(nomeUnidade(S.unidadeId))}</small></span>`}</div>
      <div class="label" style="margin-bottom:6px">Escolha o dia</div><div class="date-strip" id="datas">${dias.map((d) => { const n = livres(d); return `<button type="button" data-d="${d}" ${n ? "" : "disabled"} aria-pressed="${d === S.data}" aria-label="${fmtDataLonga(d)}${n ? "" : ", sem horários"}"><small>${DIAS[diaSemana(d)].slice(0, 3)}</small><b>${d.slice(8)}</b><small>${MESES[+d.slice(5, 7) - 1]}</small></button>`; }).join("")}</div>
      <div class="label" style="margin:10px 0 6px">Escolha o horário em ${fmtDataLonga(S.data)}</div><div id="slots"></div>
      <div class="actions"><button type="button" class="btn" id="seguir" disabled>Continuar</button></div>`;
      const slots = () => {
        const l = slotsDia(S.data); const grupos = {}; l.forEach((s) => (grupos[s.unidadeId] ||= []).push(s));
        const multi = Object.keys(grupos).length > 1;
        $("#slots").innerHTML = l.length ? Object.entries(grupos).map(([u, ss]) => `${multi ? `<div class="muted" style="margin:10px 0 6px"><b>${esc(nomeUnidade(u))}</b></div>` : ""}<div class="slot-grid">${ss.map((s) => `<button type="button" class="slot" data-h="${s.h}" data-u="${s.unidadeId}" ${s.livre ? "" : "disabled"} aria-pressed="${s.h === S.horario && (!multi || s.unidadeId === S.unidadeId)}">${s.h}</button>`).join("")}</div>`).join("") : vazio("Sem Horários Neste Dia", "Escolha outro dia na lista acima.");
        $$(".slot", raiz).forEach((b) => b.addEventListener("click", () => { S.horario = b.dataset.h; if (S.tipo !== "teleconsulta") S.unidadeId = b.dataset.u; S.qualquer = false; $$(".slot", raiz).forEach((o) => o.setAttribute("aria-pressed", String(o === b))); $("#seguir").disabled = false; }));
        $("#seguir").disabled = !(S.horario && l.some((s) => s.h === S.horario && s.livre));
      };
      $$("#datas button", raiz).forEach((b) => b.addEventListener("click", () => { S.data = b.dataset.d; S.horario = ""; $$("#datas button").forEach((o) => o.setAttribute("aria-pressed", String(o === b))); desenhar(); }));
      $("#seguir").addEventListener("click", proximo);
      slots();
      $("#datas [aria-pressed=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
    },
    revisar() {
      const m = medicoPorId(S.medicoId), c = cliente(), exame = S.tipo === "exame";
      const v = valorCliente(c, exame ? "exame" : "consulta", exame ? S.exame : S.especialidade);
      const un = unidadePorId(S.unidadeId), dep = (c?.dependentes || []).find((x) => x.id === S.dependenteId);
      raiz.innerHTML = `<div class="review"><div class="kv"><span>Paciente</span><span>${esc(dep ? dep.nome : c?.nome)}</span></div><div class="kv"><span>Atendimento</span><span>${TIPOS[S.tipo]}: ${esc(exame ? (DB.find("exames", S.exame) || {}).nome : espNome(S.especialidade))}</span></div>${m ? `<div class="kv"><span>Médico</span><span>${esc(m.nome)}</span></div>` : ""}<div class="kv"><span>Local</span><span>${S.tipo === "teleconsulta" ? "Online (link na hora)" : esc(un ? `${un.nome}, ${un.endereco}` : "—")}</span></div><div class="kv"><span>Data e hora</span><span>${fmtDataLonga(S.data)} às ${S.horario}</span></div>${S.pedidoNome ? `<div class="kv"><span>Pedido médico</span><span>${esc(S.pedidoNome)}</span></div>` : ""}<div class="kv"><span>Valor</span><span><b>${brl(v.valor)}</b>${v.plano ? `<br><small class="muted">Coparticipação de ${v.pct}% sobre ${brl(v.base)}</small>` : '<br><small class="muted">Atendimento particular</small>'}</span></div></div>
      <p class="muted" style="margin-top:12px">${exame ? "Siga o preparo do exame e chegue 15 minutos antes. " : ""}Cancelamento ou remarcação grátis até ${cfg().cancelarAteHoras} horas antes.</p>
      ${modo === "atendente" ? `<label class="check"><input type="checkbox" id="zap" checked> Enviar confirmação por WhatsApp/SMS ao paciente</label>` : ""}
      <div class="actions"><button type="button" class="btn outline" id="trocar">Alterar Horário</button><button type="button" class="btn" id="confirmar">${S.idExistente && S.remarcando ? "Confirmar Remarcação" : "Confirmar Agendamento"}</button></div>`;
      $("#trocar").addEventListener("click", () => ir("horario"));
      $("#confirmar").addEventListener("click", (e) => {
        e.target.disabled = true;
        const por = modo === "cliente" ? "paciente" : `atendente ${eu().nome}`;
        // TODO: trocar por POST /consultas (ou PATCH /consultas/:id ao remarcar)
        if (S.idExistente && S.remarcando && modo === "cliente") { const c0 = DB.find("consultas", S.idExistente); if (c0?.data && horasAte(c0.data, c0.horario) < cfg().cancelarAteHoras) { e.target.disabled = false; return toast(`A remarcação online só é possível com ${cfg().cancelarAteHoras} horas de antecedência. Ligue para a clínica.`, "err"); } }
        const r = agendar({ clienteId: S.clienteId, dependenteId: S.dependenteId, tipo: S.tipo, especialidade: S.especialidade, exame: S.exame, unidadeId: S.unidadeId, medicoId: S.medicoId, data: S.data, horario: S.horario, por, origem: modo === "cliente" ? "app" : "recepção", idExistente: S.idExistente, pedidoNome: S.pedidoNome });
        if (!r.ok) { e.target.disabled = false; toast(r.erro, "err"); return ir("horario"); }
        if (modo === "atendente") { if ($("#zap")?.checked) toast("Confirmação enviada ao paciente (simulada).", "ok"); sessionStorage.setItem("agendaData", S.data); setTimeout(() => (location.href = "agenda.html?ok=1"), 600); }
        else location.href = `agendamento-confirmado.html?id=${r.consulta.id}`;
      });
    },
  };
  function desenhar() {
    const ps = passos(); S.i = Math.min(S.i, ps.length - 1); const p = ps[S.i];
    $("#steps").innerHTML = ps.map((_, k) => `<li class="${k < S.i ? "done" : k === S.i ? "now" : ""}"></li>`).join("");
    $("#step-label").textContent = `Etapa ${S.i + 1} de ${ps.length}: ${ROT_ETAPA[p]}`;
    $("#wiz-voltar").hidden = S.i === 0;
    E[p]();
  }
  $("#wiz-voltar").addEventListener("click", () => { S.i = Math.max(0, S.i - 1); const ps = passos(); if (ps[S.i] === "tipo" && modo === "cliente" && S.i === 0) { /* primeira */ } desenhar(); });
  desenhar();
}


/* ======================= cliente.js ======================= */
"use strict";
/* Portal do Paciente (C01 a C18) e telas compartilhadas (notificações, ajuda, autorizações) */

const raizPag = () => $("#conteudo");
const iconeTipo = (t) => (t === "exame" ? "file" : t === "teleconsulta" ? "video" : "calendar");
const nomeMedico = (c) => (c.medicoId ? medicoPorId(c.medicoId)?.nome || "" : "");
const minhasConsultas = () => DB.get("consultas").filter((c) => c.pacienteId === Sessao.id);
function itemConsulta(c, href) {
  const quando = c.data ? `${rotuloDia(c.data)} às ${c.horario}` : "Escolha o dia e o horário";
  return `<a class="item" href="${href}"><span class="avatar">${ico(iconeTipo(c.tipo))}</span><span class="grow"><b>${esc(nomeServico(c))}</b><small>${esc(quando)}${nomeMedico(c) ? ` com ${esc(nomeMedico(c))}` : ""}</small><small>${esc(c.paciente || "")}${c.unidadeId ? `, ${esc(nomeUnidade(c.unidadeId))}` : ""}</small></span>${badgeStatus(c.status)}</a>`;
}

// ---------- C01 Início ----------
function home() {
  const c = eu(), hoje = hojeISO(), mine = minhasConsultas();
  const prox = mine.filter((x) => x.data && ["agendada", "aguardando"].includes(x.status) && x.data >= hoje).sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario))[0];
  const avisos = [];
  mine.filter((x) => x.status === "sugerida").forEach((x) => avisos.push(["chat", "A triagem sugeriu " + espNome(x.especialidade), "Toque para escolher o dia e o horário.", `agendamento.html?remarcar=${x.id}`]));
  DB.get("documentos").filter((d) => d.clienteId === c.id && d.tipo === "resultado" && !d.visto).forEach((d) => avisos.push(["file", "Resultado disponível", d.titulo.replace("Resultado: ", ""), "documentos.html"]));
  const pend = pendencias(c); if (pend.length) avisos.push(["wallet", `Você tem ${brl(pend.reduce((s, p) => s + p.valor, 0))} em aberto`, `${pend.length} cobrança(s) pendente(s).`, "pagamento.html"]);
  DB.get("autorizacoes").filter((a) => a.clienteId === c.id && a.status !== "em_analise" && !a.visto).forEach((a) => avisos.push(["shield", `Autorização ${a.status === "aprovada" ? "aprovada" : "negada"}`, a.titulo, "autorizacoes.html"]));
  const hero = prox
    ? `<div class="hero-card"><span>Sua próxima consulta</span><div class="when">${rotuloDia(prox.data)} às ${prox.horario}</div><div>${esc(nomeServico(prox))}${nomeMedico(prox) ? ` com ${esc(nomeMedico(prox))}` : ""}<br><small>${esc(nomeUnidade(prox.unidadeId))}</small></div><div class="row"><a class="btn" href="consulta.html?id=${prox.id}">Ver Detalhes</a>${prox.data === hoje && prox.status === "agendada" ? `<button class="btn outline" id="home-checkin" type="button">Fazer Check-in</button>` : ""}${prox.tipo === "teleconsulta" && prox.data === hoje ? `<a class="btn outline" href="teleconsulta.html?id=${prox.id}">Entrar na Sala</a>` : ""}</div></div>`
    : `<div class="card pale stack"><h2>Nenhuma Consulta Marcada</h2><p class="lead">Agende em poucos passos ou converse com a triagem para descobrir a especialidade ideal.</p><div class="row"><a class="btn" href="agendamento.html">Agendar Consulta</a><a class="btn outline" href="triagem.html">Fazer Triagem</a></div></div>`;
  const tile = (href, ic, small, titulo, cls = "") => `<a class="tile ${cls}" href="${href}"><span class="ti">${ico(ic)}</span><small>${small}</small><b>${titulo}</b></a>`;
  raizPag().innerHTML = `<div class="page-head"><div><h1>Olá, ${esc(c.nome.split(" ")[0])}!</h1><p class="lead">Como podemos ajudar hoje?</p></div></div>
  <div class="two-col"><div class="stack">${hero}
    <div class="tile-grid">${tile("triagem.html", "chat", "Conversar", "Triagem", "main")}${tile("agendamento.html", "calendar", "Agendar", "Nova Consulta")}${tile("consultas.html", "clock", "Acompanhar", "Minhas Consultas")}${tile("documentos.html", "file", "Receitas e exames", "Documentos")}${tile("pagamento.html", "wallet", "Pagar", "Pagamentos", "alt")}${tile("autorizacoes.html", "shield", "Guias", "Autorizações")}</div>
    <h2 class="sec-title" style="margin-bottom:0">Agendar por especialidade</h2><div class="chips">${espLista().map((e) => `<a class="chip" href="agendamento.html?especialidade=${e.id}">${esc(e.nome)}</a>`).join("")}</div></div>
  <div class="stack"><div class="card stack"><div class="card-h"><h2>Avisos</h2><a class="link" href="notificacoes.html">Ver todos</a></div>${avisos.length ? avisos.slice(0, 4).map(([i, t, d, h]) => `<a class="item" href="${h}">${ico(i)}<span class="grow"><b>${esc(t)}</b><small>${esc(d)}</small></span></a>`).join("") : '<p class="muted">Tudo em dia por aqui.</p>'}</div>
  <a class="banner" href="carteirinha.html"><span><b>Sua Carteirinha Digital</b><br><small>Mostre o QR Code na recepção.</small></span><span class="btn sm">Ver Cartão</span></a></div></div>`;
  $("#home-checkin")?.addEventListener("click", () => abrirCheckin(prox.id));
}

// ---------- C06 Check-in online ----------
function abrirCheckin(id) {
  const c = eu();
  abrirModal({ titulo: "Check-in Online", corpo: `<p>Confirme sua presença e confira seus dados antes de chegar.</p><div class="field" style="margin-top:12px"><label for="ck-tel">Telefone para contato</label><input id="ck-tel" type="tel" value="${esc(c.telefone || "")}"></div><div class="field"><label for="ck-doc">Anexar documento (opcional)</label><input id="ck-doc" type="file" accept="image/*,application/pdf"></div><label class="check"><input type="checkbox" id="ck-ok"> Confirmo que estou a caminho e meus dados estão corretos</label>`,
    botoes: [{ rotulo: "Voltar", classe: "outline" }, { rotulo: "Fazer Check-in", aoClicar: () => { if (!$("#ck-ok").checked) { toast("Marque a confirmação para continuar.", "err"); return false; } DB.upd("clientes", c.id, { telefone: $("#ck-tel").value }); fazerCheckin(id, () => setTimeout(() => location.reload(), 500)); } }] });
  ligarMascaras($(".modal"));
}

// ---------- C04 Minhas consultas ----------
function consultas() {
  const mine = minhasConsultas(), hoje = hojeISO();
  const prox = mine.filter((c) => ["sugerida", "agendada", "aguardando", "em_atendimento"].includes(c.status) && (!c.data || c.data >= hoje)).sort((a, b) => (a.data || "9").localeCompare(b.data || "9") || (a.horario || "").localeCompare(b.horario || ""));
  const hist = mine.filter((c) => !prox.includes(c)).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const lista = (l, msg) => (l.length ? l.map((c) => itemConsulta(c, c.status === "sugerida" ? `agendamento.html?remarcar=${c.id}` : `consulta.html?id=${c.id}`)).join("") : vazio(msg));
  raizPag().innerHTML = `<div class="page-head"><h1>Minhas Consultas</h1><a class="btn" href="agendamento.html">${ico("plus")} Marcar Nova Consulta</a></div>
  <div class="tabs" id="abas"><button class="tab-btn active" data-tab="p-prox" type="button">Próximas (${prox.length})</button><button class="tab-btn" data-tab="p-hist" type="button">Histórico (${hist.length})</button></div>
  <div class="tab-panel active g2 grid" id="p-prox">${lista(prox, "Você não tem consultas marcadas.")}</div><div class="tab-panel g2 grid" id="p-hist">${lista(hist, "Ainda não há consultas no histórico.")}</div>`;
  ligarAbas(raizPag());
}

// ---------- C04/C05/C06/C17 Detalhe da consulta ----------
function consultaDetalhe() {
  const id = new URLSearchParams(location.search).get("id"); const c = DB.find("consultas", id);
  if (!c || c.pacienteId !== Sessao.id) { raizPag().innerHTML = vazio("Consulta Não Encontrada", "Ela pode ter sido removida.", '<a class="btn sm" href="consultas.html">Voltar às Consultas</a>'); return; }
  const m = c.medicoId ? medicoPorId(c.medicoId) : null, un = unidadePorId(c.unidadeId), hoje = hojeISO();
  const ativa = ["agendada", "aguardando"].includes(c.status);
  const exame = c.tipo === "exame" ? DB.find("exames", c.exame) : null;
  const docs = DB.get("documentos").filter((d) => d.consultaId === c.id);
  raizPag().innerHTML = `<div class="page-head"><div><h1>${esc(nomeServico(c))}</h1><p class="lead">${esc(c.paciente)}</p></div>${badgeStatus(c.status)}</div>
  <div class="two-col"><div class="stack"><div class="card"><div class="kv"><span>Data</span><span>${fmtDataLonga(c.data)}</span></div><div class="kv"><span>Horário</span><span>${esc(c.horario)}</span></div>${m ? `<div class="kv"><span>Médico</span><span>${esc(m.nome)}</span></div>` : ""}<div class="kv"><span>Local</span><span>${c.tipo === "teleconsulta" ? "Online" : esc(un ? `${un.nome}, ${un.endereco}` : "—")}</span></div><div class="kv"><span>Valor</span><span>${brl(c.valor)} ${c.pago ? '<span class="badge ok">Pago</span>' : '<span class="badge warn">A pagar</span>'}</span></div>${exame ? `<div class="kv"><span>Preparo</span><span>${esc(exame.preparo)}</span></div>` : ""}</div>
  <div class="actions" style="margin:0">${c.status === "agendada" && c.data === hoje ? `<button class="btn" id="b-ck" type="button">Fazer Check-in</button>` : ""}${c.tipo === "teleconsulta" && ativa ? `<a class="btn ${c.data === hoje ? "" : "outline"}" href="teleconsulta.html?id=${c.id}">Entrar na Sala</a>` : ""}${ativa ? `<a class="btn outline" href="agendamento.html?remarcar=${c.id}">Remarcar</a><button class="btn danger outline" id="b-cancel" type="button">Cancelar</button>` : ""}${un ? `<a class="btn outline" target="_blank" rel="noopener" href="${mapaURL(un)}">${ico("pin")} Ver Local</a>` : ""}${c.status === "finalizada" && !c.avaliacao ? `<button class="btn" id="b-aval" type="button">${ico("star")} Avaliar Atendimento</button>` : ""}</div>
  ${c.avaliacao ? `<div class="card pale"><b>Sua avaliação: ${"★".repeat(c.avaliacao.nota)}${"☆".repeat(5 - c.avaliacao.nota)}</b><p class="muted">${esc(c.avaliacao.comentario || "")}</p></div>` : ""}</div>
  <div class="stack">${docs.length ? `<div class="card stack"><h2>Documentos desta consulta</h2>${docs.map((d) => `<a class="item" href="documentos.html">${ico("file")}<span class="grow"><b>${esc(d.titulo)}</b></span></a>`).join("")}</div>` : ""}<div class="card"><h2 style="margin-bottom:8px">Histórico</h2>${(c.historico || []).slice().reverse().map((h) => `<div class="kv"><span class="small">${fmtHora(h.quando)}</span><span class="small">${esc(h.texto)}</span></div>`).join("") || '<p class="muted">Sem registros.</p>'}</div></div></div>`;
  $("#b-ck")?.addEventListener("click", () => abrirCheckin(c.id));
  $("#b-cancel")?.addEventListener("click", () => {
    abrirModal({ titulo: "Cancelar Consulta", corpo: `<p class="muted">O cancelamento online é permitido até ${cfg().cancelarAteHoras} horas antes do horário.</p><div class="field" style="margin-top:12px"><label for="motivo">Motivo</label><select id="motivo"><option>Imprevisto pessoal</option><option>Problema de saúde</option><option>Conflito de horário</option><option>Vou remarcar para outro dia</option><option>Outro motivo</option></select></div>`,
      botoes: [{ rotulo: "Voltar", classe: "outline" }, { rotulo: "Cancelar Consulta", classe: "danger", aoClicar: () => { const r = cancelarConsulta(c.id, $("#motivo").value, "cliente"); if (!r.ok) { toast(r.erro, "err"); return false; } toast("Consulta cancelada.", "ok"); setTimeout(() => (location.href = "consultas.html"), 600); } }] });
  });
  $("#b-aval")?.addEventListener("click", () => {
    let nota = 0;
    abrirModal({ titulo: "Avaliar Atendimento", corpo: `<p>Como foi sua consulta com ${esc(m?.nome || "a equipe")}?</p><div class="chips" id="estrelas" style="margin:12px 0">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip" data-n="${n}" aria-pressed="false" aria-label="${n} estrela(s)">${ico("star", 'style="width:20px;height:20px"')} ${n}</button>`).join("")}</div><div class="field"><label for="coment">Comentário (opcional)</label><textarea id="coment"></textarea></div>`,
      aoAbrir: (ov) => $$("#estrelas .chip", ov).forEach((b) => b.addEventListener("click", () => { nota = +b.dataset.n; $$("#estrelas .chip", ov).forEach((o) => o.setAttribute("aria-pressed", String(+o.dataset.n <= nota))); })),
      botoes: [{ rotulo: "Enviar Avaliação", aoClicar: () => { if (!nota) { toast("Escolha de 1 a 5 estrelas.", "err"); return false; } DB.upd("consultas", c.id, { avaliacao: { nota, comentario: $("#coment").value, quando: new Date().toISOString() } }); toast("Obrigado pela avaliação!", "ok"); setTimeout(() => location.reload(), 500); } }] });
  });
}

// ---------- Confirmação do agendamento (C02 passo 7) ----------
function agendamentoConfirmado() {
  const c = DB.find("consultas", new URLSearchParams(location.search).get("id")); if (!c) { location.replace("consultas.html"); return; }
  const un = unidadePorId(c.unidadeId), m = c.medicoId ? medicoPorId(c.medicoId) : null;
  raizPag().innerHTML = `<div class="state-box" style="margin-top:2vh"><span class="big" style="background:var(--ok-bg);color:var(--ok)">${ico("check")}</span><h1>Agendamento Confirmado</h1><p class="lead">Enviamos um aviso para a sua central de notificações.</p></div>
  <div class="card" style="max-width:560px;margin:0 auto"><div class="kv"><span>Atendimento</span><span>${esc(nomeServico(c))}</span></div><div class="kv"><span>Data</span><span>${fmtDataLonga(c.data)} às ${esc(c.horario)}</span></div>${m ? `<div class="kv"><span>Médico</span><span>${esc(m.nome)}</span></div>` : ""}<div class="kv"><span>Local</span><span>${c.tipo === "teleconsulta" ? "Online" : esc(un ? un.nome + ", " + un.endereco : "—")}</span></div><div class="kv"><span>Valor</span><span>${brl(c.valor)}</span></div></div>
  <div class="actions" style="max-width:560px;margin:18px auto 0"><button class="btn" id="ics" type="button">${ico("calendar")} Adicionar ao Calendário</button>${un ? `<a class="btn outline" target="_blank" rel="noopener" href="${mapaURL(un)}">${ico("pin")} Como Chegar</a>` : ""}<a class="btn outline" href="consultas.html">Minhas Consultas</a><a class="btn outline" href="home.html">Voltar ao Início</a></div>`;
  $("#ics").addEventListener("click", () => {
    const ini = c.data.replace(/-/g, "") + "T" + c.horario.replace(":", "") + "00", fim = c.data.replace(/-/g, "") + "T" + hmStr(hm(c.horario) + 30).replace(":", "") + "00";
    baixarArquivo("consulta-caismed.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CaisMed//PT", "BEGIN:VEVENT", `UID:${c.id}@caismed`, `DTSTAMP:${ini}`, `DTSTART:${ini}`, `DTEND:${fim}`, `SUMMARY:${nomeServico(c)} - CaisMed`, `LOCATION:${un ? un.endereco + ", " + un.cidade : "Online"}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n"), "text/calendar");
  });
}

// ---------- C07 Teleconsulta (sala) ----------
function teleconsulta() {
  const c = DB.find("consultas", new URLSearchParams(location.search).get("id")); if (!c || c.pacienteId !== Sessao.id) { raizPag().innerHTML = vazio("Teleconsulta Não Encontrada"); return; }
  const m = medicoPorId(c.medicoId); let stream = null, poll = null;
  const parar = () => { stream?.getTracks().forEach((t) => t.stop()); clearInterval(poll); };
  const etapa = (html) => (raizPag().innerHTML = `<div class="page-head"><div><h1>Sala de Teleconsulta</h1><p class="lead">${esc(m?.nome || "")}, ${fmtDataLonga(c.data)} às ${esc(c.horario)}</p></div></div><div style="max-width:720px">${html}</div>`);
  const teste = () => {
    etapa(`<div class="card stack"><h2>Teste sua câmera e microfone</h2><video id="v" autoplay muted playsinline style="width:100%;border-radius:14px;background:#000;aspect-ratio:16/9"></video><div><span class="label">Microfone</span><div style="height:10px;background:var(--pale2);border-radius:99px;overflow:hidden;margin-top:6px"><div id="nivel" style="height:100%;width:0;background:var(--blue)"></div></div></div><p class="muted" id="msg-cam">Permita o acesso quando o navegador pedir.</p><div class="actions"><button class="btn outline" id="b-teste" type="button">Ligar Câmera e Microfone</button><button class="btn" id="b-entrar" type="button">Entrar na Sala de Espera</button></div></div>`);
    $("#b-teste").addEventListener("click", async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); $("#v").srcObject = stream; $("#msg-cam").textContent = "Tudo certo. Fale algo e veja a barra mexer.";
        const ac = new (window.AudioContext || window.webkitAudioContext)(), an = ac.createAnalyser(), src = ac.createMediaStreamSource(stream); src.connect(an); const d = new Uint8Array(an.frequencyBinCount);
        const loop = () => { if (!$("#nivel")) return; an.getByteFrequencyData(d); $("#nivel").style.width = Math.min(100, d.reduce((a, b) => a + b, 0) / d.length * 2) + "%"; requestAnimationFrame(loop); }; loop();
      } catch (e) { $("#msg-cam").textContent = "Não foi possível acessar câmera ou microfone. Libere a permissão no navegador e tente de novo."; }
    });
    $("#b-entrar").addEventListener("click", espera);
  };
  const espera = () => {
    DB.upd("consultas", c.id, { status: "aguardando", chegouEm: new Date().toISOString() });
    if (c.medicoId) notificar("medico:" + c.medicoId, "Paciente na Sala de Espera", `${c.paciente} aguarda a teleconsulta.`, "medico-painel.html");
    etapa(`<div class="card stack" style="text-align:center"><h2>Sala de espera</h2><p class="lead">Aguarde. ${esc(m?.nome || "O médico")} vai iniciar o atendimento em instantes.</p><div class="skel" style="height:90px"></div><button class="btn outline" id="b-sair" type="button">Sair da Sala</button></div>`);
    $("#b-sair").addEventListener("click", () => { parar(); location.href = "consulta.html?id=" + c.id; });
    poll = setInterval(() => { const x = DB.find("consultas", c.id); if (x?.teleIniciada) { clearInterval(poll); sala(); } }, 1500);
  };
  const sala = async () => {
    etapa(`<div class="card stack"><h2>Em atendimento com ${esc(m?.nome || "")}</h2><video id="v" autoplay muted playsinline style="width:100%;border-radius:14px;background:#000;aspect-ratio:16/9"></video><p class="muted">O vídeo do médico chega pelo serviço de videochamada do back-end. Aqui aparece só a sua câmera.</p><button class="btn danger" id="b-fim" type="button">Encerrar Chamada</button></div>`);
    try { stream = stream || await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); $("#v").srcObject = stream; } catch (e) {}
    $("#b-fim").addEventListener("click", () => { parar(); location.href = "consulta.html?id=" + c.id; });
  };
  if (c.teleIniciada) sala(); else teste();
  window.addEventListener("pagehide", parar);
}

// ---------- C08/C09 Exames e receitas ----------
const TIPO_DOC = { receita: "Receitas", exame_pedido: "Pedidos de Exame", resultado: "Resultados", atestado: "Atestados" };
function documentos() {
  let filtro = "";
  const desenhar = () => {
    const l = DB.get("documentos").filter((d) => d.clienteId === Sessao.id && (!filtro || d.tipo === filtro)).sort((a, b) => b.data.localeCompare(a.data));
    $("#lista-docs").innerHTML = l.length ? l.map((d) => `<button type="button" class="item" data-id="${d.id}">${ico("file")}<span class="grow"><b>${esc(d.titulo)}</b><small>${fmtData(d.data)}${d.medicoId ? `, ${esc(medicoPorId(d.medicoId)?.nome || "")}` : ""}</small></span>${d.tipo === "resultado" && !d.visto ? '<span class="badge warn">Novo</span>' : `<span class="badge info">${esc((TIPO_DOC[d.tipo] || "").replace(/s$/, ""))}</span>`}</button>`).join("") : vazio("Nenhum Documento", "Receitas, pedidos e resultados aparecem aqui depois das consultas.");
    $$("#lista-docs .item").forEach((b) => b.addEventListener("click", () => abrirDoc(DB.find("documentos", b.dataset.id))));
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Exames e Receitas</h1></div><div class="chips" id="filtros" style="margin-bottom:14px"><button class="chip" type="button" data-t="" aria-pressed="true">Todos</button>${Object.entries(TIPO_DOC).map(([k, v]) => `<button class="chip" type="button" data-t="${k}" aria-pressed="false">${v}</button>`).join("")}</div><div class="grid g2" id="lista-docs"></div>`;
  $$("#filtros .chip").forEach((b) => b.addEventListener("click", () => { filtro = b.dataset.t; $$("#filtros .chip").forEach((o) => o.setAttribute("aria-pressed", String(o === b))); desenhar(); }));
  desenhar();
  function abrirDoc(d) {
    if (d.tipo === "resultado" && !d.visto) { DB.upd("documentos", d.id, { visto: true }); }
    const m = d.medicoId ? medicoPorId(d.medicoId) : null, c = eu();
    const corpo = `<h1>${esc(d.titulo)}</h1><p class="m">Paciente: ${esc(c.nome)} (CPF ${fmtCPF(c.cpf)})<br>Data: ${fmtData(d.data)}${m ? `<br>${esc(m.nome)}, ${esc(m.crm)}` : ""}</p>${d.laudo ? `<h3>Laudo</h3><p>${esc(d.laudo)}</p>` : ""}${(d.itens || []).length ? `<ul>${d.itens.map((i) => `<li><b>${esc(i.nome)}</b>${i.posologia ? `<br>${esc(i.posologia)}` : ""}</li>`).join("")}</ul>` : ""}${d.texto ? `<p>${esc(d.texto)}</p>` : ""}${m ? `<div class="sig">${esc(m.nome)}<br>${esc(m.crm)}<br>Assinatura digital (simulada)</div>` : ""}`;
    abrirModal({ titulo: d.titulo, corpo: `<div class="stack"><p class="muted">${fmtData(d.data)}${m ? `, ${esc(m.nome)}` : ""}</p>${d.laudo ? `<div class="card pale"><b>Laudo</b><p>${esc(d.laudo)}</p></div>` : ""}${(d.itens || []).map((i) => `<div class="card"><b>${esc(i.nome)}</b><p class="muted">${esc(i.posologia || "")}</p></div>`).join("")}${d.texto ? `<p>${esc(d.texto)}</p>` : ""}</div>`,
      botoes: [{ rotulo: "Baixar ou Imprimir PDF", aoClicar: () => { imprimirDoc(d.titulo, corpo); return false; } }, { rotulo: "Compartilhar", classe: "outline", aoClicar: async () => { const t = `${d.titulo} - ${fmtData(d.data)}`; try { navigator.share ? await navigator.share({ title: t, text: t }) : (await navigator.clipboard.writeText(t), toast("Texto copiado.", "ok")); } catch (e) {} return false; } }, ...(d.tipo === "exame_pedido" ? [{ rotulo: "Agendar Este Exame", classe: "outline", aoClicar: () => { const x = DB.get("exames", EXAMES_PADRAO).find((e) => (d.titulo || "").includes(e.nome)); location.href = "agendamento.html?tipo=exame" + (x ? "&exame=" + x.id : ""); } }] : [])] });
    desenhar();
  }
}

// ---------- C10 Carteirinha digital ----------
function carteirinha() {
  const c = eu(); const pessoas = [{ id: "", nome: c.nome, rot: "Titular" }, ...(c.dependentes || []).filter((x) => idade(x.nascimento) < 18 || x.acesso).map((d) => ({ id: d.id, nome: d.nome, rot: d.parentesco }))];
  let sel = pessoas[0];
  const num = (cpf) => ("0000" + soDigitos(cpf).slice(-9)).replace(/(\d{4})(\d{4})(\d{5})/, "$1 $2 $3");
  const desenhar = () => {
    $("#cart").innerHTML = `<div class="cart"><div class="info"><div class="top"><b class="display" style="font-size:1.3rem">CaisMed</b><span class="plano">${esc((PLANOS[c.plano] || {}).nome || "Sem Plano")}</span></div><div class="num">${num(c.cpf + sel.id)}</div><div><div class="nome">${esc(sel.nome)}</div><small>${sel.rot}</small></div></div><div class="qr" aria-label="QR Code da carteirinha">${qrSVG(`CAISMED:${sel.id ? "DEP" : "CLI"}:${c.id}:${sel.id || soDigitos(c.cpf)}`)}</div></div>`;
    $$("#pick .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === sel.id)));
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Minha Carteirinha</h1><a class="btn outline" href="dependentes.html">${ico("users")} Gerenciar Dependentes</a></div>${pessoas.length > 1 ? `<div class="chips" id="pick" style="margin-bottom:14px">${pessoas.map((p) => `<button class="chip" type="button" data-id="${p.id}" aria-pressed="false">${esc(p.nome.split(" ")[0])} (${esc(p.rot)})</button>`).join("")}</div>` : ""}<div id="cart" style="max-width:640px"></div><p class="aviso" style="max-width:640px;margin-top:12px">Apresente este cartão na recepção. O atendente lê o QR Code para fazer seu check-in.</p>`;
  $$("#pick .chip").forEach((b) => b.addEventListener("click", () => { sel = pessoas.find((p) => p.id === b.dataset.id); desenhar(); }));
  desenhar();
}

// ---------- C15 Dependentes ----------
function dependentes() {
  const desenhar = () => {
    const c = eu();
    $("#lista-dep").innerHTML = (c.dependentes || []).length ? c.dependentes.map((d) => { const adulto = idade(d.nascimento) >= 18; return `<div class="card stack sm"><div class="row between"><b>${esc(d.nome)}</b><span class="badge info">${esc(d.parentesco)}, ${idade(d.nascimento)} anos</span></div>${adulto ? `<label class="check"><input type="checkbox" data-acesso="${d.id}" ${d.acesso ? "checked" : ""}> Tenho autorização deste dependente adulto para ver e agendar consultas dele</label>` : '<p class="muted">Menor de idade: você, como titular, acompanha as consultas.</p>'}<div class="row"><button class="btn outline sm" data-edit="${d.id}" type="button">${ico("edit")} Editar</button><button class="btn danger outline sm" data-del="${d.id}" type="button">${ico("trash")} Remover</button></div></div>`; }).join("") : vazio("Nenhum Dependente", "Adicione familiares para agendar e usar a carteirinha por eles.");
    $$("[data-acesso]").forEach((el) => el.addEventListener("change", () => { DB.upd("clientes", c.id, (x) => ({ dependentes: x.dependentes.map((d) => (d.id === el.dataset.acesso ? { ...d, acesso: el.checked } : d)) })); audit(el.checked ? "Concedeu acesso a dependente adulto" : "Revogou acesso a dependente adulto"); toast(el.checked ? "Acesso concedido." : "Acesso revogado.", "ok"); }));
    $$("[data-edit]").forEach((b) => b.addEventListener("click", () => form(c.dependentes.find((d) => d.id === b.dataset.edit))));
    $$("[data-del]").forEach((b) => b.addEventListener("click", async () => { if (await confirmar("Remover este dependente? As consultas já feitas continuam no histórico.", { perigo: true, ok: "Remover" })) { DB.upd("clientes", c.id, (x) => ({ dependentes: x.dependentes.filter((d) => d.id !== b.dataset.del) })); desenhar(); } }));
  };
  const form = (d) => abrirModal({ titulo: d ? "Editar Dependente" : "Adicionar Dependente", corpo: `<div class="field"><label for="d-nome">Nome completo</label><input id="d-nome" value="${esc(d?.nome || "")}" required></div><div class="field"><label for="d-nasc">Data de nascimento</label><input id="d-nasc" type="date" max="${hojeISO()}" value="${d?.nascimento || ""}"></div><div class="field"><label for="d-par">Parentesco</label><select id="d-par">${["Filho", "Filha", "Cônjuge", "Pai", "Mãe", "Outro"].map((p) => `<option ${d?.parentesco === p ? "selected" : ""}>${p}</option>`).join("")}</select></div><p class="hint">O Plano Família cobre até 4 pessoas.</p>`,
    botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Salvar", aoClicar: () => { const nome = $("#d-nome").value.trim(), nasc = $("#d-nasc").value; if (!nome || !nasc) { toast("Preencha nome e data de nascimento.", "err"); return false; } const c = eu(); const novo = { id: d?.id || "d" + uid(), nome, nascimento: nasc, parentesco: $("#d-par").value, acesso: d?.acesso ?? false }; DB.upd("clientes", c.id, (x) => ({ dependentes: d ? x.dependentes.map((y) => (y.id === d.id ? novo : y)) : [...x.dependentes, novo] })); audit(d ? "Editou dependente" : "Adicionou dependente"); setTimeout(desenhar, 0); } }] });
  raizPag().innerHTML = `<div class="page-head"><h1>Dependentes</h1><button class="btn" id="add" type="button">${ico("plus")} Adicionar Dependente</button></div><div class="grid g2" id="lista-dep"></div>`;
  $("#add").addEventListener("click", () => form()); desenhar();
}

// ---------- C11 / A10 Autorizações ----------
const STATUS_AUT = { em_analise: ["Em Análise", "warn"], aprovada: ["Aprovada", "ok"], negada: ["Negada", "err"] };
function autorizacoes() {
  const staff = Sessao.perfil !== "cliente";
  const desenhar = () => {
    let l = DB.get("autorizacoes").sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)); if (!staff) l = l.filter((a) => a.clienteId === Sessao.id);
    $("#lista-aut").innerHTML = l.length ? l.map((a) => { const cl = DB.find("clientes", a.clienteId); return `<div class="card stack sm"><div class="row between"><b>${esc(a.titulo)}</b><span class="badge ${STATUS_AUT[a.status][1]}">${STATUS_AUT[a.status][0]}</span></div>${staff ? `<p>${esc(cl?.nome || "—")}</p>` : ""}<p class="muted">Guia: ${esc(a.guiaNome || "não anexada")}, enviada em ${fmtHora(a.criadoEm)}</p>${a.obs ? `<p class="small"><b>Observação da clínica:</b> ${esc(a.obs)}</p>` : ""}${staff && a.status === "em_analise" ? `<div class="row"><button class="btn sm" data-ap="${a.id}" type="button">Aprovar</button><button class="btn danger outline sm" data-ng="${a.id}" type="button">Negar</button></div>` : ""}</div>`; }).join("") : vazio("Nenhuma Autorização", staff ? "Quando um paciente enviar uma guia, ela aparece aqui." : "Envie a guia do seu convênio ou pedido para a clínica analisar.");
    if (!staff) l.forEach((a) => !a.visto && a.status !== "em_analise" && DB.upd("autorizacoes", a.id, { visto: true }));
    const mudar = (id, status) => abrirModal({ titulo: status === "aprovada" ? "Aprovar Autorização" : "Negar Autorização", corpo: `<div class="field"><label for="obs">Observação para o paciente</label><textarea id="obs"></textarea></div>`, botoes: [{ rotulo: "Voltar", classe: "outline" }, { rotulo: "Confirmar", aoClicar: () => { const a = DB.upd("autorizacoes", id, { status, obs: $("#obs").value, atualizadoEm: new Date().toISOString() }); notificar("cliente:" + a.clienteId, "Autorização " + (status === "aprovada" ? "Aprovada" : "Negada"), a.titulo, "autorizacoes.html"); audit("Atualizou autorização", a.titulo); setTimeout(desenhar, 0); } }] });
    $$("[data-ap]").forEach((b) => b.addEventListener("click", () => mudar(b.dataset.ap, "aprovada"))); $$("[data-ng]").forEach((b) => b.addEventListener("click", () => mudar(b.dataset.ng, "negada")));
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Autorizações</h1>${staff ? "" : `<button class="btn" id="nova" type="button">${ico("plus")} Solicitar Autorização</button>`}</div><div class="grid g2" id="lista-aut"></div>`;
  $("#nova")?.addEventListener("click", () => abrirModal({ titulo: "Solicitar Autorização", corpo: `<div class="field"><label for="a-tit">Exame ou procedimento</label><select id="a-tit">${DB.get("exames", EXAMES_PADRAO).map((e) => `<option>${esc(e.nome)}</option>`).join("")}<option>Outro procedimento</option></select></div><div class="field"><label for="a-guia">Foto ou PDF da guia</label><input id="a-guia" type="file" accept="image/*,application/pdf"></div>`,
    botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Enviar Solicitação", aoClicar: () => { const f = $("#a-guia").files[0]; if (!f) { toast("Anexe a guia para enviar.", "err"); return false; } DB.add("autorizacoes", { clienteId: Sessao.id, titulo: $("#a-tit").value, guiaNome: f.name, status: "em_analise", obs: "", criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() }); notificar("atendente", "Nova Autorização", `${eu().nome} enviou uma guia: ${$("#a-tit").value}.`, "autorizacoes.html"); toast("Solicitação enviada.", "ok"); setTimeout(desenhar, 0); } }] }));
  desenhar();
}

// ---------- C12 Financeiro ----------
function pagamento() {
  const c = eu();
  const desenhar = () => {
    const pend = pendencias(c), pags = DB.get("pagamentos").filter((p) => p.clienteId === c.id).sort((a, b) => b.quando.localeCompare(a.quando));
    const fin = DB.get("consultas").filter((x) => x.pacienteId === c.id && x.status === "finalizada").sort((a, b) => b.data.localeCompare(a.data));
    const pl = PLANOS[c.plano];
    raizPag().innerHTML = `<div class="page-head"><h1>Pagamentos</h1></div><div class="two-col"><div class="stack">
    <div class="card stack"><h2>Em aberto</h2>${pend.length ? pend.map((p, i) => `<div class="item" style="cursor:default"><span class="grow"><b>${esc(p.descricao)}</b><small>${p.tipo === "mensalidade" ? "Mensalidade do plano" : "Coparticipação"}</small></span><b>${brl(p.valor)}</b><button class="btn sm" data-pagar="${i}" type="button">Pagar</button></div>`).join("") : '<p class="muted">Nada em aberto. Obrigado!</p>'}</div>
    <div class="card stack"><h2>Histórico de pagamentos</h2>${pags.length ? pags.map((p) => `<div class="item" style="cursor:default"><span class="grow"><b>${esc(p.descricao)}</b><small>${fmtData(p.data)}, ${esc(p.metodo)}</small></span><b>${brl(p.valor)}</b><span class="badge ok">Pago</span></div>`).join("") : '<p class="muted">Nenhum pagamento ainda.</p>'}</div></div>
    <div class="stack"><div class="card"><h2 style="margin-bottom:8px">Meu plano</h2>${pl ? `<div class="kv"><span>Plano</span><span>${esc(pl.nome)}</span></div><div class="kv"><span>Mensalidade</span><span>${brl(pl.valor)}</span></div><div class="kv"><span>Coparticipação</span><span>${pl.copart}% por atendimento</span></div>` : '<p class="muted">Você não tem plano. Os atendimentos são particulares.</p>'}</div>
    <div class="card"><h2 style="margin-bottom:8px">Extrato de utilização</h2>${fin.length ? `<div class="table-wrap" style="border:0"><table style="min-width:0"><thead><tr><th>Data</th><th>Serviço</th><th>Valor</th></tr></thead><tbody>${fin.map((x) => `<tr><td>${fmtData(x.data)}</td><td>${esc(nomeServico(x))}</td><td>${brl(x.valor)} ${x.pago ? "" : '<span class="badge warn">Aberto</span>'}</td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">Sem atendimentos finalizados.</p>'}</div></div></div>`;
    $$("[data-pagar]").forEach((b) => b.addEventListener("click", () => pagar(pend[+b.dataset.pagar])));
  };
  function pagar(p) {
    abrirModal({ titulo: "Pagar " + brl(p.valor), corpo: `<p class="muted">${esc(p.descricao)}</p><div class="field" style="margin-top:12px"><label for="met">Forma de pagamento</label><select id="met"><option>Pix</option><option>Cartão de Crédito</option><option>Boleto</option></select></div><div id="met-box"></div>`,
      aoAbrir: (ov) => { const box = $("#met-box", ov), met = $("#met", ov); const mostra = () => { box.innerHTML = met.value === "Pix" ? `<div class="stack" style="align-items:center;text-align:center"><div style="background:#fff;padding:10px;border-radius:12px;width:180px">${qrSVG("00020126CAISMED-PIX-SIMULADO-" + p.valor)}</div><code class="small" style="word-break:break-all">00020126CAISMED-PIX-SIMULADO</code><p class="hint">QR Code ilustrativo. A cobrança real vem do back-end.</p></div>` : met.value === "Boleto" ? `<div class="card pale"><b>Linha digitável (simulada)</b><p class="small" style="word-break:break-all">23790.00000 00000.000000 00000.000000 0 00000000000000</p></div>` : `<div class="field"><label for="cn">Número do cartão</label><input id="cn" inputmode="numeric" maxlength="19" autocomplete="cc-number"></div><div class="form-grid"><div class="field"><label for="cv">Validade</label><input id="cv" placeholder="MM/AA" maxlength="5" autocomplete="cc-exp"></div><div class="field"><label for="cc">CVV</label><input id="cc" maxlength="4" inputmode="numeric" autocomplete="cc-csc"></div></div><p class="hint">Os dados do cartão não ficam salvos neste app.</p>`; }; met.addEventListener("change", mostra); mostra(); },
      botoes: [{ rotulo: "Voltar", classe: "outline" }, { rotulo: "Confirmar Pagamento", aoClicar: () => { if ($("#met").value === "Cartão de Crédito" && (soDigitos($("#cn").value).length < 13 || !/^\d{2}\/\d{2}$/.test($("#cv").value) || soDigitos($("#cc").value).length < 3)) { toast("Confira os dados do cartão.", "err"); return false; } registrarPagamento(c, p, $("#met").value, "paciente"); toast("Pagamento confirmado! Obrigado.", "ok"); setTimeout(desenhar, 0); } }] });
  }
  desenhar();
}

// ---------- C14 Perfil ----------
function perfil() {
  const c = eu();
  raizPag().innerHTML = `<div class="page-head"><h1>Meu Perfil</h1><a class="btn outline" href="perfil-editar.html">${ico("edit")} Editar Dados</a></div><div class="two-col"><div class="card"><div class="row" style="margin-bottom:10px"><span class="avatar lg">${esc(iniciais(c.nome))}</span><div><b>${esc(c.nome)}</b><br><span class="muted">${esc((PLANOS[c.plano] || {}).nome || "Sem plano")}</span></div></div><div class="kv"><span>CPF</span><span>${fmtCPF(c.cpf)}</span></div><div class="kv"><span>Nascimento</span><span>${fmtData(c.nascimento)}</span></div><div class="kv"><span>Telefone</span><span>${esc(c.telefone || "—")}</span></div><div class="kv"><span>E-mail</span><span>${esc(c.email || "—")}</span></div><div class="kv"><span>Cidade</span><span>${esc(c.cidade || "—")}</span></div></div>
  <div class="stack"><a class="item" href="dependentes.html">${ico("users")}<span class="grow"><b>Dependentes</b><small>${(c.dependentes || []).length} cadastrado(s)</small></span>${ico("right")}</a><a class="item" href="pagamento.html">${ico("wallet")}<span class="grow"><b>Pagamentos</b><small>Faturas, histórico e extrato</small></span>${ico("right")}</a><a class="item" href="autorizacoes.html">${ico("shield")}<span class="grow"><b>Autorizações</b><small>Guias e pedidos</small></span>${ico("right")}</a><a class="item" href="privacidade.html">${ico("lock")}<span class="grow"><b>Privacidade e Consentimentos</b><small>Seus dados e a LGPD</small></span>${ico("right")}</a><a class="item" href="ajuda.html">${ico("help")}<span class="grow"><b>Ajuda e Ouvidoria</b><small>Perguntas frequentes e contato</small></span>${ico("right")}</a><button class="btn danger outline" id="sair" type="button">${ico("logout")} Sair da Conta</button></div></div>`;
  $("#sair").addEventListener("click", sair);
}
function perfilEditar() {
  const c = eu();
  raizPag().innerHTML = `<div class="page-head"><h1>Editar Meus Dados</h1></div><form id="f" class="card" style="max-width:720px" novalidate><div class="form-grid"><div class="field full"><label for="nome">Nome completo</label><input id="nome" value="${esc(c.nome)}" required></div><div class="field"><label for="cpf-ro">CPF</label><input id="cpf-ro" value="${fmtCPF(c.cpf)}" disabled><span class="hint">Para corrigir o CPF, fale com a recepção.</span></div><div class="field"><label for="plano-ro">Plano</label><input id="plano-ro" value="${esc((PLANOS[c.plano] || {}).nome || "Sem plano")}" disabled><span class="hint">Mudança de plano é feita pela recepção.</span></div><div class="field"><label for="telefone">Telefone</label><input id="telefone" type="tel" data-valida="tel" value="${esc(c.telefone || "")}" required></div><div class="field"><label for="email">E-mail</label><input id="email" type="email" data-valida="email" value="${esc(c.email || "")}" required></div><div class="field"><label for="cidade">Cidade</label><input id="cidade" value="${esc(c.cidade || "")}" required></div><div class="field"><label for="senha-nova">Nova senha (opcional)</label><input id="senha-nova" type="password" minlength="6" autocomplete="new-password"></div></div>
  <label class="check"><input type="checkbox" id="pref" ${c.consentimentos?.notificacoes !== false ? "checked" : ""}> Receber lembretes e avisos por notificação</label><div class="actions"><button class="btn" type="submit">Salvar Alterações</button><a class="btn outline" href="perfil.html">Cancelar</a></div></form>`;
  ligarMascaras($("#f"));
  $("#f").addEventListener("submit", (e) => { e.preventDefault(); if (!formularioValido(e.target)) return; const sn = $("#senha-nova").value; if (sn && sn.length < 6) return toast("A senha precisa de pelo menos 6 caracteres.", "err");
    // TODO: PUT /clientes/:id (back-end)
    DB.upd("clientes", c.id, (x) => ({ nome: $("#nome").value.trim(), telefone: $("#telefone").value, email: $("#email").value, cidade: $("#cidade").value.trim(), ...(sn ? { senha: sn } : {}), consentimentos: { ...x.consentimentos, notificacoes: $("#pref").checked } })); audit("Editou o próprio perfil"); toast("Dados atualizados!", "ok"); setTimeout(() => (location.href = "perfil.html"), 600); });
}

// ---------- C16 Privacidade ----------
function privacidade() {
  const c = eu(), cs = c.consentimentos || {};
  raizPag().innerHTML = `<div class="page-head"><h1>Privacidade e Consentimentos</h1><p class="lead">Veja o que você autorizou e controle seus dados, conforme a LGPD.</p></div><div class="two-col"><div class="card stack"><h2>Consentimentos</h2><label class="check"><input type="checkbox" checked disabled> Termos de uso (obrigatório para usar o serviço)</label><label class="check"><input type="checkbox" checked disabled> Tratamento de dados de saúde (obrigatório para atendimento)</label><label class="check"><input type="checkbox" id="c-not" ${cs.notificacoes !== false ? "checked" : ""}> Lembretes e avisos por notificação</label><label class="check"><input type="checkbox" id="c-mkt" ${cs.marketing ? "checked" : ""}> Receber novidades e campanhas de saúde</label><p class="hint">Aceito em ${fmtHora(cs.aceitoEm || c.criadoEm)}.</p></div>
  <div class="stack"><div class="card stack"><h2>Meus dados</h2><p class="muted">Baixe uma cópia de tudo o que a clínica guarda sobre você.</p><button class="btn outline" id="baixar" type="button">${ico("download")} Baixar Meus Dados</button></div><div class="card stack"><h2>Excluir minha conta</h2><p class="muted">Seus dados de acesso e cadastro são removidos. O prontuário das consultas já feitas é mantido pela clínica pelo prazo exigido em lei.</p><button class="btn danger outline" id="excluir" type="button">${ico("trash")} Excluir Minha Conta</button></div></div></div>`;
  const salvar = () => { DB.upd("clientes", c.id, (x) => ({ consentimentos: { ...x.consentimentos, notificacoes: $("#c-not").checked, marketing: $("#c-mkt").checked } })); toast("Preferência salva.", "ok"); };
  $("#c-not").addEventListener("change", salvar); $("#c-mkt").addEventListener("change", salvar);
  $("#baixar").addEventListener("click", () => { const { senha, ...cad } = c; baixarArquivo("meus-dados-caismed.json", JSON.stringify({ cadastro: cad, consultas: minhasConsultas(), documentos: DB.get("documentos").filter((d) => d.clienteId === c.id), pagamentos: DB.get("pagamentos").filter((p) => p.clienteId === c.id), autorizacoes: DB.get("autorizacoes").filter((a) => a.clienteId === c.id) }, null, 2), "application/json"); audit("Baixou os próprios dados"); });
  $("#excluir").addEventListener("click", () => abrirModal({ titulo: "Excluir Conta", corpo: `<p>Esta ação não pode ser desfeita. Digite <b>EXCLUIR</b> para confirmar.</p><div class="field" style="margin-top:10px"><input id="conf" aria-label="Digite EXCLUIR" autocomplete="off"></div>`, botoes: [{ rotulo: "Voltar", classe: "outline" }, { rotulo: "Excluir Conta", classe: "danger", aoClicar: () => { if ($("#conf").value.trim().toUpperCase() !== "EXCLUIR") { toast("Digite EXCLUIR para confirmar.", "err"); return false; } audit("Excluiu a própria conta", c.nome); /* TODO: DELETE /clientes/:id */ DB.del("clientes", c.id); Sessao.sair(); location.href = "login.html"; } }] }));
}

// ---------- G08 Triagem (chatbot) ----------
function triagem() {
  const msgs = $("#chat-messages"), area = $("#chat-input-area");
  const perguntas = [
    { id: "motivo", tipo: "texto", pergunta: "Oi! Antes da sua consulta, vou fazer algumas perguntas rápidas. Qual o motivo que te trouxe até aqui?", placeholder: "Ex.: dor de cabeça, retorno, exame..." },
    { id: "sintomas", tipo: "multipla", pergunta: "Você está sentindo algum desses sintomas? Pode marcar mais de um.", opcoes: [["febre", "Febre"], ["tosse", "Tosse"], ["dor_cabeca", "Dor de cabeça"], ["dor_corpo", "Dor no corpo"], ["falta_ar", "Falta de ar"], ["nausea", "Náusea"]] },
    { id: "urgencia", tipo: "unica", pergunta: "Como você classificaria a urgência disso?", opcoes: [["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"]] },
    { id: "observacoes", tipo: "texto-opcional", pergunta: "Quer contar mais algum detalhe? Se não tiver nada, é só pular.", placeholder: "Observações (opcional)" },
  ];
  const respostas = {}; let passo = 0;
  const bolha = (t, a) => { const el = document.createElement("div"); el.className = `msg msg-${a}`; el.textContent = t; msgs.appendChild(el); msgs.scrollTop = msgs.scrollHeight; };
  const audio = (url) => { const el = document.createElement("div"); el.className = "msg msg-user"; el.innerHTML = `<audio controls src="${url}"></audio>`; msgs.appendChild(el); msgs.scrollTop = msgs.scrollHeight; };
  const avancar = (txt) => { bolha(txt, "user"); passo++; render(); };
  const mic = (onAudio) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chat-mic"; b.title = "Enviar áudio"; b.setAttribute("aria-label", "Gravar áudio"); b.innerHTML = ico("mic");
    let rec, chunks = [], t0, timer;
    b.addEventListener("click", async () => {
      if (rec && rec.state === "recording") { rec.stop(); return; }
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: true }); rec = new MediaRecorder(st); chunks = [];
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = () => { clearInterval(timer); st.getTracks().forEach((t) => t.stop()); b.classList.remove("rec"); b.innerHTML = ico("mic"); onAudio(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }))); };
        rec.start(); t0 = Date.now(); b.classList.add("rec"); timer = setInterval(() => (b.textContent = Math.floor((Date.now() - t0) / 1000) + "s"), 500);
      } catch (e) { toast("Não foi possível acessar o microfone. Libere a permissão no navegador.", "err"); }
    });
    return b;
  };
  // TODO: trocar por chamada à IA do chatbot (back-end). Por enquanto é uma regra simples.
  const escolher = (r) => {
    const t = (r.motivo || "").toLowerCase(), s = r.sintomas || [];
    if (/crian|filh|beb[eê]/.test(t)) return "pediatria";
    if (/pele|mancha|alergi|coceira/.test(t)) return "dermatologia";
    if (/joelho|coluna|osso|fratura|tornozelo|ombro/.test(t)) return "ortopedia";
    if (/gravidez|gestante|menstrua|ginecolog/.test(t)) return "ginecologia";
    if (/peito|cora[cç][aã]o|press[aã]o/.test(t) || s.includes("falta_ar")) return "cardiologia";
    return "clinico_geral";
  };
  function render() {
    area.innerHTML = "";
    if (passo >= perguntas.length) {
      const esp = escolher(respostas);
      bolha(`Com base no que você me contou, o mais indicado é uma consulta de ${espNome(esp)}. Já deixei essa sugestão registrada em "Minhas Consultas".`, "bot");
      if (respostas.urgencia === "alta" || (respostas.sintomas || []).includes("falta_ar")) bolha("Atenção: se os sintomas forem fortes ou piorarem, não espere a consulta. Procure um pronto-socorro ou ligue 192 (SAMU).", "bot");
      const c = eu();
      const nova = DB.add("consultas", { pacienteId: c.id, paciente: c.nome, tipo: "consulta", especialidade: esp, data: "", horario: "", status: "sugerida", origem: "triagem", preTriagem: respostas, valor: valorCliente(c, "consulta", esp).valor, pago: false, criadoEm: new Date().toISOString(), historico: [{ quando: new Date().toISOString(), texto: "Sugerida pela triagem" }] });
      audit("Concluiu triagem", espNome(esp)); // TODO: POST /triagem (multipart: audio)
      area.innerHTML = `<div class="actions" style="margin:0"><a class="btn" href="agendamento.html?remarcar=${nova.id}">Marcar Horário Agora</a><a class="btn outline" href="consultas.html">Ver Minhas Consultas</a></div>`;
      return;
    }
    const p = perguntas[passo]; bolha(p.pergunta, "bot");
    if (p.tipo === "texto" || p.tipo === "texto-opcional") {
      const row = document.createElement("div"); row.className = "chat-send-row";
      const input = document.createElement("input"); input.type = "text"; input.className = "chat-text-input"; input.placeholder = p.placeholder; input.setAttribute("aria-label", p.placeholder);
      const enviar = () => { const v = input.value.trim(); if (!v && p.tipo === "texto") return; respostas[p.id] = v; avancar(v || "Pular"); };
      input.addEventListener("keydown", (e) => e.key === "Enter" && enviar());
      const send = document.createElement("button"); send.type = "button"; send.className = "chat-send-btn"; send.setAttribute("aria-label", "Enviar"); send.innerHTML = ico("send"); send.addEventListener("click", enviar);
      row.append(input, mic((url) => { respostas[p.id] = "[Áudio enviado]"; audio(url); passo++; render(); }), send); area.appendChild(row);
      if (p.tipo === "texto-opcional") { const pular = document.createElement("button"); pular.type = "button"; pular.className = "link"; pular.textContent = "Pular"; pular.addEventListener("click", () => { respostas[p.id] = ""; avancar("Pular"); }); area.appendChild(pular); }
      input.focus();
    }
    if (p.tipo === "multipla") {
      const sel = new Set(), chips = document.createElement("div"); chips.className = "chat-chips";
      p.opcoes.forEach(([v, l]) => { const b = document.createElement("button"); b.type = "button"; b.className = "chat-chip"; b.textContent = l; b.setAttribute("aria-pressed", "false"); b.addEventListener("click", () => { sel.has(v) ? sel.delete(v) : sel.add(v); b.classList.toggle("selected"); b.setAttribute("aria-pressed", String(sel.has(v))); }); chips.appendChild(b); });
      const ok = document.createElement("button"); ok.type = "button"; ok.className = "btn"; ok.textContent = "Confirmar"; ok.addEventListener("click", () => { respostas[p.id] = [...sel]; avancar(sel.size ? p.opcoes.filter(([v]) => sel.has(v)).map(([, l]) => l).join(", ") : "Nenhum sintoma"); });
      area.append(chips, ok);
    }
    if (p.tipo === "unica") { const chips = document.createElement("div"); chips.className = "chat-chips"; p.opcoes.forEach(([v, l]) => { const b = document.createElement("button"); b.type = "button"; b.className = "chat-chip"; b.textContent = l; b.addEventListener("click", () => { respostas[p.id] = v; avancar(l); }); chips.appendChild(b); }); area.appendChild(chips); }
  }
  render();
}

// ---------- G07 Notificações (todos os perfis) ----------
function notificacoes() {
  const desenhar = () => {
    const l = minhasNotifs();
    $("#lista-not").innerHTML = l.length ? l.map((n) => `<a class="item" href="${n.link || "#"}" data-id="${n.id}" style="${n.lida ? "" : "border-color:var(--blue-text)"}">${ico("bell")}<span class="grow"><b>${esc(n.titulo)}</b><small>${esc(n.texto)}</small><small>${fmtHora(n.quando)}</small></span>${n.lida ? "" : '<span class="badge info">Nova</span>'}</a>`).join("") : vazio("Sem Notificações", "Lembretes, avisos e mensagens aparecem aqui.");
    $$("#lista-not a").forEach((a) => a.addEventListener("click", () => DB.upd("notificacoes", a.dataset.id, { lida: true })));
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Notificações</h1><button class="btn outline" id="ler" type="button">${ico("check")} Marcar Todas Como Lidas</button></div><div class="stack" id="lista-not" style="max-width:760px"></div>`;
  $("#ler").addEventListener("click", () => { minhasNotifs().forEach((n) => DB.upd("notificacoes", n.id, { lida: true })); location.reload(); });
  desenhar();
}

// ---------- C18 / G09 Ajuda e ouvidoria ----------
function ajuda() {
  const logado = !!(Sessao.perfil && eu()), c = logado && Sessao.perfil === "cliente" ? eu() : null;
  const faq = [["Como agendo uma consulta?", "Toque em Nova Consulta, escolha o tipo, a especialidade, a unidade, o médico e o horário. No fim, confirme."], ["Posso cancelar ou remarcar?", `Sim, pelo app até ${cfg().cancelarAteHoras} horas antes. Depois disso, ligue para a unidade.`], ["Como faço check-in?", "No dia da consulta, abra a consulta e toque em Fazer Check-in, ou mostre o QR Code da carteirinha na recepção."], ["Esqueci minha senha.", "Na tela de login, toque em Esqueceu a Senha? e informe seu CPF."], ["Como recebo receitas e resultados?", "Eles ficam em Documentos assim que o médico finaliza o atendimento ou o laudo é liberado."], ["A triagem substitui a consulta?", "Não. Ela só ajuda a escolher a especialidade e adianta informações para o médico."]];
  raizPag().innerHTML = `<div class="page-head"><h1>Ajuda e Ouvidoria</h1></div><div class="two-col"><div class="stack"><h2>Perguntas frequentes</h2>${faq.map(([q, a]) => `<details class="card"><summary style="font-weight:800;cursor:pointer;min-height:32px">${q}</summary><p class="muted" style="margin-top:8px">${a}</p></details>`).join("")}<h2 style="margin-top:10px">Telefones das unidades</h2>${DB.get("unidades").map((u) => `<div class="kv"><span>${esc(u.nome)}</span><span>${esc(u.fone)}</span></div>`).join("")}</div>
  <form id="ouv" class="card stack" novalidate><h2>Fale com a ouvidoria</h2>${logado ? "" : `<div class="field"><label for="o-nome">Seu nome</label><input id="o-nome" required></div><div class="field"><label for="o-mail">E-mail</label><input id="o-mail" type="email" data-valida="email" required></div>`}<div class="field"><label for="o-tipo">Tipo</label><select id="o-tipo"><option>Dúvida</option><option>Elogio</option><option>Sugestão</option><option>Reclamação</option></select></div><div class="field"><label for="o-ass">Assunto</label><input id="o-ass" required></div><div class="field"><label for="o-msg">Mensagem</label><textarea id="o-msg" required></textarea></div><button class="btn" type="submit">Enviar Mensagem</button></form></div>`;
  ligarMascaras($("#ouv"));
  $("#ouv").addEventListener("submit", (e) => { e.preventDefault(); if (!formularioValido(e.target)) return; const u = logado ? eu() : null; if (!$("#o-ass").value.trim() || !$("#o-msg").value.trim() || (!logado && (!$("#o-nome").value.trim() || !$("#o-mail").value.trim()))) return toast("Preencha todos os campos.", "err");
    DB.add("ouvidoria", { tipo: $("#o-tipo").value, assunto: $("#o-ass").value.trim(), mensagem: $("#o-msg").value.trim(), clienteId: c?.id || null, nome: u?.nome || $("#o-nome").value.trim(), email: u?.email || $("#o-mail")?.value || "", perfil: Sessao.perfil || "visitante", status: "nova", criadoEm: new Date().toISOString() });
    notificar("admin", "Nova Mensagem na Ouvidoria", $("#o-ass").value.trim(), "admin-ouvidoria.html"); toast("Mensagem enviada. Respondemos em até 5 dias úteis.", "ok"); e.target.reset(); });
}

ready(() => {
  ({ home, consultas, "consulta": consultaDetalhe, "agendamento-confirmado": agendamentoConfirmado, teleconsulta, documentos, carteirinha, dependentes, autorizacoes, pagamento, perfil, "perfil-editar": perfilEditar, privacidade, triagem, notificacoes, ajuda,
    agendamento: () => iniciarWizard("cliente") })[document.body.dataset.pagina]?.();
});


/* ======================= atendente.js ======================= */
"use strict";
/* Portal do Atendente (A01 a A13) */

const doDia = (uni, iso) => DB.get("consultas").filter((c) => c.data === iso && (!uni || c.unidadeId === uni));
const pacienteDe = (c) => DB.find("clientes", c.pacienteId);

// ---------- A01 Painel do dia ----------
function atendentePainel() {
  const un = unidadeAtiva(), hoje = hojeISO(), l = doDia(un, hoje);
  const n = (s) => l.filter((c) => c.status === s).length;
  const atrasadas = l.filter((c) => c.status === "agendada" && hm(c.horario) + 15 < agoraMin());
  const espera = DB.get("espera").filter((e) => !e.avisado).length, aut = DB.get("autorizacoes").filter((a) => a.status === "em_analise").length;
  const proximas = l.filter((c) => ["agendada", "aguardando"].includes(c.status)).sort((a, b) => a.horario.localeCompare(b.horario));
  raizPag().innerHTML = `<div class="page-head"><div><h1>Painel do Dia</h1><p class="lead">${esc(nomeUnidade(un))}, ${fmtDataLonga(hoje)}</p></div><a class="btn" href="agendar-paciente.html">${ico("plus")} Novo Agendamento</a></div>
  <div class="stats"><div class="stat"><b>${l.filter((c) => c.status !== "cancelada").length}</b><span>Consultas do dia</span></div><div class="stat"><b>${n("aguardando")}</b><span>Na recepção</span></div><div class="stat"><b>${n("em_atendimento")}</b><span>Em atendimento</span></div><div class="stat"><b>${n("finalizada")}</b><span>Finalizadas</span></div><div class="stat"><b>${n("faltou")}</b><span>Faltas</span></div><div class="stat"><b>${n("cancelada")}</b><span>Cancelamentos</span></div><div class="stat"><b>${espera}</b><span>Na lista de espera</span></div><div class="stat"><b>${aut}</b><span>Autorizações em análise</span></div></div>
  <div class="two-col"><div class="stack"><h2>Próximos atendimentos</h2>${proximas.length ? proximas.map((c) => `<div class="item" style="cursor:default"><span class="avatar">${esc(c.horario)}</span><span class="grow"><b>${esc(c.paciente)}</b><small>${esc(nomeServico(c))}${nomeMedico(c) ? ` com ${esc(nomeMedico(c))}` : ""}</small></span>${badgeStatus(c.status)}${c.status === "agendada" ? `<button class="btn sm" data-ck="${c.id}" type="button">Check-in</button>` : ""}</div>`).join("") : vazio("Nenhum Atendimento Pendente Hoje", "Os agendamentos de hoje aparecem aqui.")}</div>
  <div class="stack"><div class="card stack"><h2>Alertas</h2>${atrasadas.length ? atrasadas.map((c) => `<div class="item" style="cursor:default">${ico("alert")}<span class="grow"><b>Atraso: ${esc(c.paciente)}</b><small>Horário ${esc(c.horario)}, ainda sem check-in</small></span></div>`).join("") : '<p class="muted">Sem atrasos agora.</p>'}</div>
  <a class="item" href="fila.html">${ico("clock")}<span class="grow"><b>Check-in e fila</b><small>Receber pacientes e chamar</small></span>${ico("right")}</a><a class="item" href="cliente-form.html">${ico("users")}<span class="grow"><b>Cadastrar cliente</b><small>Novo paciente da clínica</small></span>${ico("right")}</a><a class="item" href="caixa.html">${ico("wallet")}<span class="grow"><b>Caixa</b><small>Cobranças e recibos</small></span>${ico("right")}</a><a class="item" href="espera.html">${ico("list")}<span class="grow"><b>Lista de espera</b><small>Pacientes aguardando vaga</small></span>${ico("right")}</a></div></div>`;
  $$("[data-ck]").forEach((b) => b.addEventListener("click", () => checkinRecepcao(b.dataset.ck, () => atendentePainel())));
}

// A05: conferir documento e convênio antes de liberar o paciente para a fila
function checkinRecepcao(id, depois) {
  const c = DB.find("consultas", id), cl = pacienteDe(c);
  abrirModal({ titulo: "Check-in de " + c.paciente, corpo: `<div class="card pale"><b>${esc(nomeServico(c))}</b><br><span class="muted">${esc(c.horario)}${nomeMedico(c) ? `, ${esc(nomeMedico(c))}` : ""}</span></div><label class="check"><input type="checkbox" id="k1"> Documento com foto conferido</label><label class="check"><input type="checkbox" id="k2"> Plano ${esc((PLANOS[cl?.plano] || {}).nome || "particular")} conferido</label><div class="field"><label for="k3">Telefone atualizado</label><input id="k3" type="tel" value="${esc(cl?.telefone || "")}"></div>`,
    botoes: [{ rotulo: "Voltar", classe: "outline" }, { rotulo: "Enviar para a Fila", aoClicar: () => { if (!$("#k1").checked || !$("#k2").checked) { toast("Confira o documento e o plano antes de continuar.", "err"); return false; } if (cl) DB.upd("clientes", cl.id, { telefone: $("#k3").value }); fazerCheckin(id, depois); } }] });
  ligarMascaras($(".modal"));
}

// ---------- A02 / A04 Agenda geral ----------
function agenda() {
  const un = unidadeAtiva(), q = new URLSearchParams(location.search);
  let data = sessionStorage.getItem("agendaData") || hojeISO();
  if (q.get("ok")) toast("Agendamento criado.", "ok");
  const desenhar = () => {
    sessionStorage.setItem("agendaData", data);
    const meds = medicosAtivos().filter((m) => m.unidades.includes(un));
    const por = meds.map((m) => ({ m, slots: slotsDoMedico(m, data, un) })).filter((x) => x.slots.length);
    const horas = [...new Set(por.flatMap((x) => x.slots.map((s) => s.h)))].sort();
    const cons = doDia(un, data).filter((c) => c.status !== "cancelada");
    let grade = "";
    if (por.length) {
      grade = `<div class="agenda" style="grid-template-columns:72px repeat(${por.length},minmax(170px,1fr))"><div class="h">Hora</div>${por.map((x) => `<div class="h">${esc(x.m.nome)}<br><small class="muted">${esc(espNome(x.m.especialidades[0]))}</small></div>`).join("")}${horas.map((h) => `<div class="t">${h}</div>${por.map((x) => { const s = x.slots.find((y) => y.h === h); const c = cons.find((y) => y.medicoId === x.m.id && y.horario === h); if (c) return `<div class="c"><button class="ev ${c.status}" data-c="${c.id}" type="button"><b>${esc(c.paciente)}</b><small>${esc(STATUS[c.status][0])}${c.tipo === "teleconsulta" ? ", online" : ""}</small></button></div>`; if (!s) return `<div class="c"></div>`; if (s.bloqueado) return `<div class="c"><button class="blk" data-un="${x.m.id}|${h}" type="button">Bloqueado</button></div>`; if (!s.livre) return `<div class="c"><span class="muted small">Encerrado</span></div>`; return `<div class="c"><button data-free="${x.m.id}|${h}" type="button">Livre</button></div>`; }).join("")}`).join("")}</div>`;
    }
    $("#grade").innerHTML = grade || vazio("Sem Atendimentos Neste Dia", "Nenhum médico atende nesta unidade no dia escolhido.");
    $("#data-lbl").textContent = fmtDataLonga(data);
    $$("[data-c]").forEach((b) => b.addEventListener("click", () => detalheConsulta(b.dataset.c, desenhar)));
    $$("[data-free]").forEach((b) => b.addEventListener("click", () => { const [mid, h] = b.dataset.free.split("|"); const m = medicoPorId(mid); abrirModal({ titulo: `${h}, ${m.nome}`, corpo: `<div class="stack"><a class="btn" href="agendar-paciente.html?medico=${mid}&especialidade=${m.especialidades[0]}&unidade=${un}&data=${data}&horario=${h}">Agendar Paciente</a><button class="btn outline" id="bloq" type="button">Bloquear Horário</button></div>`, aoAbrir: (ov) => $("#bloq", ov).addEventListener("click", () => { DB.add("bloqueios", { medicoId: mid, data, horario: h, por: eu().nome }); audit("Bloqueou horário", `${m.nome} ${fmtData(data)} ${h}`); $(".x-btn", ov).click(); desenhar(); }) }); }));
    $$("[data-un]").forEach((b) => b.addEventListener("click", async () => { const [mid, h] = b.dataset.un.split("|"); if (await confirmar("Liberar este horário de novo?", { ok: "Liberar" })) { DB.set("bloqueios", DB.get("bloqueios").filter((x) => !(x.medicoId === mid && x.data === data && x.horario === h))); desenhar(); } }));
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Agenda Geral</h1><a class="btn" href="agendar-paciente.html">${ico("plus")} Novo Agendamento</a></div><div class="row between" style="margin-bottom:14px"><div class="row"><button class="btn outline sm" id="ant" type="button" aria-label="Dia anterior">${ico("back")}</button><b id="data-lbl" style="min-width:150px;text-align:center"></b><button class="btn outline sm" id="prox" type="button" aria-label="Próximo dia">${ico("right")}</button><button class="btn outline sm" id="hj" type="button">Hoje</button></div><input type="date" id="pick" style="width:auto" aria-label="Escolher data"></div><div id="grade"></div><p class="hint" style="margin-top:10px">Toque em um horário livre para agendar ou bloquear. Toque em uma consulta para ver os detalhes, remarcar ou cancelar.</p>`;
  const mover = (n) => { data = addDias(data, n); $("#pick").value = data; desenhar(); };
  $("#ant").addEventListener("click", () => mover(-1)); $("#prox").addEventListener("click", () => mover(1)); $("#hj").addEventListener("click", () => { data = hojeISO(); $("#pick").value = data; desenhar(); });
  $("#pick").value = data; $("#pick").addEventListener("change", (e) => { if (e.target.value) { data = e.target.value; desenhar(); } });
  desenhar();
}
function detalheConsulta(id, depois) {
  const c = DB.find("consultas", id), m = c.medicoId ? medicoPorId(c.medicoId) : null, ativa = ["agendada", "aguardando"].includes(c.status);
  abrirModal({ titulo: "Detalhe da Consulta", corpo: `<div class="row between"><b>${esc(c.paciente)}</b>${badgeStatus(c.status)}</div><div class="card" style="margin:10px 0"><div class="kv"><span>Atendimento</span><span>${esc(nomeServico(c))}</span></div><div class="kv"><span>Data</span><span>${fmtData(c.data)} às ${esc(c.horario)}</span></div>${m ? `<div class="kv"><span>Médico</span><span>${esc(m.nome)}</span></div>` : ""}<div class="kv"><span>Valor</span><span>${brl(c.valor)} ${c.pago ? "(pago)" : ""}</span></div></div><b>Histórico de alterações</b>${(c.historico || []).slice().reverse().map((h) => `<div class="kv"><span class="small">${fmtHora(h.quando)}</span><span class="small">${esc(h.texto)}</span></div>`).join("")}
  <div class="actions"><a class="btn outline sm" href="paciente.html?id=${c.pacienteId}">Ficha do Paciente</a>${c.status === "agendada" ? `<button class="btn sm" id="d-ck" type="button">Check-in</button>` : ""}${ativa ? `<a class="btn outline sm" href="agendar-paciente.html?remarcar=${c.id}">Remarcar</a><button class="btn danger outline sm" id="d-can" type="button">Cancelar</button>` : ""}${c.status === "agendada" ? `<button class="btn danger outline sm" id="d-falta" type="button">Registrar Falta</button>` : ""}</div>`,
    aoAbrir: (ov, fechar) => {
      $("#d-ck", ov)?.addEventListener("click", () => { fechar(); checkinRecepcao(id, depois); });
      $("#d-can", ov)?.addEventListener("click", () => { fechar(); abrirModal({ titulo: "Cancelar Consulta", corpo: `<div class="field"><label for="mt">Motivo</label><select id="mt"><option>Pedido do paciente</option><option>Médico indisponível</option><option>Erro de agendamento</option><option>Outro</option></select></div>`, botoes: [{ rotulo: "Voltar", classe: "outline" }, { rotulo: "Cancelar Consulta", classe: "danger", aoClicar: () => { cancelarConsulta(id, $("#mt").value, "atendente"); toast("Consulta cancelada.", "ok"); depois(); } }] }); });
      $("#d-falta", ov)?.addEventListener("click", async () => { fechar(); if (await confirmar("Registrar falta deste paciente?", { perigo: true, ok: "Registrar Falta" })) { DB.upd("consultas", id, (x) => ({ status: "faltou", historico: [...(x.historico || []), { quando: new Date().toISOString(), texto: "Falta registrada pela recepção" }] })); audit("Registrou falta", c.paciente); depois(); } });
    } });
}

// ---------- A05 / A06 Check-in e fila ----------
function fila() {
  const un = unidadeAtiva();
  const desenhar = () => {
    const l = doDia(un, hojeISO());
    const col = (st, tit) => { const it = l.filter((c) => (st === "aguardando" ? c.status === "aguardando" : c.status === st)).sort((a, b) => (a.chegouEm || a.horario).localeCompare(b.chegouEm || b.horario)); return `<div class="col"><h3>${tit}<span class="badge info">${it.length}</span></h3>${it.map((c) => `<div class="card stack sm"><b>${esc(c.paciente)}</b><small class="muted">${esc(c.horario)}, ${esc(nomeServico(c))}${nomeMedico(c) ? `, ${esc(nomeMedico(c))}` : ""}</small>${st === "aguardando" ? `<small>Espera: <b>${Math.max(0, Math.round((Date.now() - new Date(c.chegouEm || Date.now())) / 60000))} min</b>${c.chamadoEm ? ' <span class="badge ok">Chamado</span>' : ""}</small><button class="btn sm" data-call="${c.id}" type="button">${c.chamadoEm ? "Chamar de Novo" : "Chamar Paciente"}</button>` : ""}</div>`).join("") || '<p class="muted small">Ninguém aqui.</p>'}</div>`; };
    $("#kanban").innerHTML = col("aguardando", "Aguardando") + col("em_atendimento", "Em Atendimento") + col("finalizada", "Finalizado");
    $$("[data-call]").forEach((b) => b.addEventListener("click", () => { const c = DB.find("consultas", b.dataset.call); DB.upd("consultas", c.id, { chamadoEm: new Date().toISOString() }); if (c.medicoId) notificar("medico:" + c.medicoId, "Paciente Chamado", `${c.paciente} foi chamado pela recepção.`, "medico-painel.html"); audit("Chamou paciente", c.paciente); toast(`${c.paciente} chamado no painel da sala de espera.`, "ok"); desenhar(); }));
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Check-in e Fila</h1><a class="btn outline" href="painel-tv.html" target="_blank" rel="noopener">${ico("video")} Abrir Painel da Sala de Espera</a></div>
  <form class="card" id="busca" style="margin-bottom:18px"><label for="q">Buscar paciente por nome, CPF ou QR Code da carteirinha</label><div class="row" style="flex-wrap:nowrap;margin-top:6px"><input id="q" placeholder="Digite ou use o leitor de QR Code" autocomplete="off"><button class="btn" type="submit">Buscar</button></div><div id="res" class="stack" style="margin-top:12px"></div></form><div class="kanban" id="kanban"></div>`;
  $("#busca").addEventListener("submit", (e) => {
    e.preventDefault(); const t = $("#q").value.trim(); if (!t) return;
    let cid = null, depId = null; const m = t.match(/^CAISMED:(CLI|DEP):([^:]+):(.+)$/i);
    if (m) { cid = m[2]; depId = m[1].toUpperCase() === "DEP" ? m[3] : null; }
    const d = soDigitos(t); const cls = DB.get("clientes").filter((c) => (cid ? c.id === cid : c.nome.toLowerCase().includes(t.toLowerCase()) || (d.length >= 3 && c.cpf.includes(d))));
    const cons = DB.get("consultas").filter((c) => c.data === hojeISO() && cls.some((x) => x.id === c.pacienteId) && c.status === "agendada" && (!depId || c.dependenteId === depId));
    $("#res").innerHTML = !cls.length ? vazio("Paciente Não Encontrado", "Confira os dados ou cadastre o paciente.", '<a class="btn sm" href="cliente-form.html">Cadastrar Paciente</a>') : cons.length ? cons.map((c) => `<div class="item" style="cursor:default"><span class="avatar">${esc(c.horario)}</span><span class="grow"><b>${esc(c.paciente)}</b><small>${esc(nomeServico(c))}, ${esc(nomeUnidade(c.unidadeId))}</small></span><button class="btn sm" data-ck="${c.id}" type="button">Check-in</button></div>`).join("") : vazio(`${cls[0].nome} não tem consulta para confirmar hoje`, "", `<a class="btn sm" href="agendar-paciente.html?cliente=${cls[0].id}">Agendar Agora</a>`);
    $$("#res [data-ck]").forEach((b) => b.addEventListener("click", () => checkinRecepcao(b.dataset.ck, () => { $("#res").innerHTML = ""; $("#q").value = ""; desenhar(); })));
  });
  desenhar();
}
function painelTV() {
  const un = unidadeAtiva();
  const d = () => { const l = doDia(un, hojeISO()).filter((c) => c.chamadoEm && ["aguardando", "em_atendimento"].includes(c.status)).sort((a, b) => b.chamadoEm.localeCompare(a.chamadoEm)).slice(0, 5); $("#tv").innerHTML = l.length ? l.map((c, i) => `<div class="card ${i ? "" : "raise"}" style="padding:${i ? 14 : 28}px"><div class="${i ? "" : "display"}" style="font-size:${i ? "1.3rem" : "clamp(2rem,6vw,4rem)"};font-weight:800">${esc(c.paciente.split(" ").slice(0, 2).join(" "))}</div><div class="muted">${esc(nomeMedico(c) || nomeServico(c))}</div></div>`).join("") : '<p class="lead" style="text-align:center;padding:60px 0">Aguarde. Você será chamado pelo nome.</p>'; };
  raizPag().innerHTML = `<div class="page-head"><h1>Chamadas da Sala de Espera</h1><p class="lead">${esc(nomeUnidade(un))}. Esta tela atualiza sozinha.</p></div><div class="stack" id="tv" style="max-width:900px"></div>`; d(); setInterval(d, 2000);
}

// ---------- A07 Cadastro de pacientes ----------
function pacientes() {
  const desenhar = () => {
    const t = $("#q").value.trim().toLowerCase(), dg = soDigitos(t);
    const l = DB.get("clientes").filter((c) => !t || c.nome.toLowerCase().includes(t) || (dg.length >= 3 && c.cpf.includes(dg))).sort((a, b) => a.nome.localeCompare(b.nome));
    $("#lista").innerHTML = l.length ? l.map((c) => `<a class="item" href="paciente.html?id=${c.id}"><span class="avatar">${esc(iniciais(c.nome))}</span><span class="grow"><b>${esc(c.nome)}</b><small>CPF ${fmtCPF(c.cpf)}, ${esc(c.telefone || "")}</small></span><span class="badge info">${esc((PLANOS[c.plano] || {}).nome || "Particular")}</span>${c.senha ? "" : '<span class="badge warn">Sem senha</span>'}</a>`).join("") : vazio("Nenhum Paciente Encontrado", "Cadastre um novo cliente da clínica.", '<a class="btn sm" href="cliente-form.html">Cadastrar Cliente</a>');
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Pacientes</h1><a class="btn" href="cliente-form.html">${ico("plus")} Cadastrar Novo Cliente</a></div><div class="field"><label class="sr" for="q">Buscar</label><input id="q" type="search" placeholder="Buscar por nome ou CPF"></div><div class="grid g2" id="lista"></div>`;
  $("#q").addEventListener("input", desenhar); desenhar();
}
function clienteForm() {
  const id = new URLSearchParams(location.search).get("id"), atual = id ? DB.find("clientes", id) : null;
  let plano = atual?.plano || "";
  raizPag().innerHTML = `<div class="page-head"><h1>${atual ? "Alterar Dados do Cliente" : "Cadastrar Novo Cliente"}</h1></div><form id="f" class="card" style="max-width:820px" novalidate><div class="form-grid"><div class="field full"><label for="nome">Nome completo</label><input id="nome" required></div><div class="field"><label for="cpf">CPF</label><input id="cpf" name="cpf" data-valida="cpf" required></div><div class="field"><label for="nascimento">Data de nascimento</label><input id="nascimento" type="date" max="${hojeISO()}" required></div><div class="field"><label for="telefone">Telefone</label><input id="telefone" type="tel" data-valida="tel" required></div><div class="field"><label for="email">E-mail</label><input id="email" type="email" data-valida="email" required></div><div class="field"><label for="cidade">Cidade</label><input id="cidade" required></div><div class="field"><label for="pagamento">Forma de pagamento</label><select id="pagamento"><option>Pix</option><option>Cartão de Crédito</option><option>Boleto</option></select></div></div><span class="label">Plano do cliente</span><div class="grid g2" id="planos" style="margin:8px 0 18px"></div><div class="actions"><button class="btn" type="submit">Salvar Cliente</button><a class="btn outline" href="pacientes.html">Cancelar</a></div></form>`;
  const pl = () => { $("#planos").innerHTML = Object.entries(PLANOS).map(([k, p]) => `<button type="button" class="opt" data-k="${k}" aria-pressed="${k === plano}"><span class="grow"><b>${esc(p.nome)}, ${brl(p.valor)}/mês</b><small>${esc(p.desc)}. Coparticipação de ${p.copart}%.</small></span></button>`).join("") + `<button type="button" class="opt" data-k="" aria-pressed="${plano === ""}"><span class="grow"><b>Sem plano (particular)</b><small>Paga o valor integral de cada atendimento.</small></span></button>`; $$("#planos .opt").forEach((b) => b.addEventListener("click", () => { plano = b.dataset.k; pl(); })); };
  pl();
  if (atual) ["nome", "nascimento", "telefone", "email", "cidade", "pagamento"].forEach((k) => ($("#" + k).value = atual[k] || "")), ($("#cpf").value = atual.cpf);
  ligarMascaras($("#f"));
  $("#f").addEventListener("submit", async (e) => {
    e.preventDefault(); if (!formularioValido(e.target)) return;
    const cpf = soDigitos($("#cpf").value);
    if (!cpfValido(cpf)) return toast("CPF inválido. Confira os 11 números.", "err");
    if (DB.get("clientes").some((c) => c.cpf === cpf && (!atual || c.id !== atual.id))) return toast("Já existe um cliente cadastrado com este CPF.", "err");
    if (atual && !(await confirmar("Salvar as alterações deste cliente?", { ok: "Salvar" }))) return;
    // TODO: POST /clientes ou PUT /clientes/:id (back-end)
    const d = { nome: $("#nome").value.trim(), cpf, nascimento: $("#nascimento").value, telefone: $("#telefone").value, email: $("#email").value, cidade: $("#cidade").value.trim(), pagamento: $("#pagamento").value, plano };
    let c;
    if (atual) { c = DB.upd("clientes", atual.id, d); audit("Alterou cadastro de cliente", c.nome); }
    else { c = DB.add("clientes", { ...d, dependentes: [], consentimentos: { termos: false, lgpd: false, notificacoes: true, marketing: false, aceitoEm: null }, criadoEm: new Date().toISOString() }); audit("Cadastrou cliente", c.nome); }
    abrirModal({ titulo: atual ? "Dados Atualizados" : "Cliente Cadastrado", corpo: `<p>${atual ? "As alterações foram salvas." : `Peça para ${esc(c.nome.split(" ")[0])} abrir o app, tocar em <b>Primeiro Acesso</b> e criar a senha com o CPF cadastrado.`}</p>`, botoes: [{ rotulo: "Ver Ficha do Paciente", aoClicar: () => { location.href = "paciente.html?id=" + c.id; } }] });
  });
}

// ---------- A08 Ficha do paciente (sem prontuário clínico) ----------
function paciente() {
  const c = DB.find("clientes", new URLSearchParams(location.search).get("id")); if (!c) { raizPag().innerHTML = vazio("Paciente Não Encontrado", "", '<a class="btn sm" href="pacientes.html">Voltar</a>'); return; }
  const cons = DB.get("consultas").filter((x) => x.pacienteId === c.id).sort((a, b) => (b.data || "").localeCompare(a.data || "")), pend = pendencias(c);
  raizPag().innerHTML = `<div class="page-head"><div><h1>${esc(c.nome)}</h1><p class="lead">${esc((PLANOS[c.plano] || {}).nome || "Particular")}</p></div><div class="row"><a class="btn" href="agendar-paciente.html?cliente=${c.id}">Agendar</a><a class="btn outline" href="cliente-form.html?id=${c.id}">${ico("edit")} Alterar Dados</a><a class="btn outline" href="caixa.html?cliente=${c.id}">Cobrar</a></div></div>
  <div class="two-col"><div class="stack"><div class="card"><h2 style="margin-bottom:8px">Dados cadastrais</h2><div class="kv"><span>CPF</span><span>${fmtCPF(c.cpf)}</span></div><div class="kv"><span>Nascimento</span><span>${fmtData(c.nascimento)} (${idade(c.nascimento)} anos)</span></div><div class="kv"><span>Telefone</span><span>${esc(c.telefone)}</span></div><div class="kv"><span>E-mail</span><span>${esc(c.email)}</span></div><div class="kv"><span>Cidade</span><span>${esc(c.cidade)}</span></div><div class="kv"><span>Acesso ao app</span><span>${c.senha ? "Senha criada" : "Aguardando primeiro acesso"}</span></div></div>
  <div class="card stack"><h2>Consultas</h2>${cons.length ? cons.slice(0, 8).map((x) => `<div class="kv"><span>${fmtData(x.data)} ${esc(x.horario || "")}<br><small class="muted">${esc(nomeServico(x))}</small></span><span>${badgeStatus(x.status)}</span></div>`).join("") : '<p class="muted">Sem consultas.</p>'}</div></div>
  <div class="stack"><div class="card stack"><h2>Pendências financeiras</h2>${pend.length ? pend.map((p) => `<div class="kv"><span>${esc(p.descricao)}</span><span>${brl(p.valor)}</span></div>`).join("") : '<p class="muted">Nada em aberto.</p>'}</div><div class="card stack"><h2>Dependentes</h2>${(c.dependentes || []).length ? c.dependentes.map((d) => `<div class="kv"><span>${esc(d.nome)}</span><span>${esc(d.parentesco)}</span></div>`).join("") : '<p class="muted">Nenhum dependente.</p>'}</div><p class="hint">A recepção não tem acesso ao prontuário clínico.</p></div></div>`;
}

// ---------- A09 Caixa ----------
function caixa() {
  const un = unidadeAtiva(), q = new URLSearchParams(location.search), foco = q.get("cliente"), hoje = hojeISO();
  const desenhar = () => {
    const fechado = DB.get("caixas").find((x) => x.data === hoje && x.unidadeId === un);
    const pagsHoje = DB.get("pagamentos").filter((p) => p.data === hoje && p.unidadeId === un);
    const por = {}; pagsHoje.forEach((p) => (por[p.metodo] = (por[p.metodo] || 0) + p.valor)); const total = pagsHoje.reduce((s, p) => s + p.valor, 0);
    let itens = []; const t = ($("#q")?.value || "").trim().toLowerCase(), dg = soDigitos(t);
    DB.get("clientes").forEach((c) => { if (foco && c.id !== foco && !t) return; if (t && !(c.nome.toLowerCase().includes(t) || (dg.length >= 3 && c.cpf.includes(dg)))) return; if (!foco && !t) { pendencias(c).filter((p) => p.tipo === "consulta" && DB.find("consultas", p.consultaId)?.unidadeId === un).forEach((p) => itens.push({ c, p })); } else pendencias(c).forEach((p) => itens.push({ c, p })); });
    $("#pend").innerHTML = itens.length ? itens.map(({ c, p }, i) => `<div class="item" style="cursor:default"><span class="grow"><b>${esc(c.nome)}</b><small>${esc(p.descricao)}</small></span><b>${brl(p.valor)}</b><button class="btn sm" data-cobrar="${i}" type="button" ${fechado ? "disabled" : ""}>Cobrar</button></div>`).join("") : vazio("Nenhuma Cobrança Pendente", "Busque um paciente para ver as pendências dele.");
    $("#resumo").innerHTML = `<div class="kv"><span>Recebimentos do dia</span><span>${pagsHoje.length}</span></div>${Object.entries(por).map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${brl(v)}</span></div>`).join("")}<div class="kv"><span><b>Total em caixa</b></span><span><b>${brl(total)}</b></span></div>${fechado ? `<p class="badge ok" style="margin-top:10px">Caixa fechado às ${fmtHora(fechado.quando).slice(-5)} por ${esc(fechado.por)}</p>` : `<button class="btn block" id="fechar" type="button" style="margin-top:12px">Fechar Caixa do Dia</button>`}`;
    $$("[data-cobrar]").forEach((b) => b.addEventListener("click", () => cobrar(itens[+b.dataset.cobrar])));
    $("#fechar")?.addEventListener("click", async () => { if (await confirmar(`Fechar o caixa de hoje com total de ${brl(total)}? Depois disso não dá para registrar novas cobranças hoje.`, { ok: "Fechar Caixa" })) { DB.add("caixas", { data: hoje, unidadeId: un, total, porMetodo: por, por: eu().nome, quando: new Date().toISOString() }); audit("Fechou o caixa", `${nomeUnidade(un)} ${fmtData(hoje)} ${brl(total)}`); desenhar(); } });
  };
  function cobrar({ c, p }) {
    abrirModal({ titulo: "Cobrar " + brl(p.valor), corpo: `<p class="muted">${esc(c.nome)}: ${esc(p.descricao)}</p><div class="field" style="margin-top:12px"><label for="met">Forma de pagamento</label><select id="met"><option>Dinheiro</option><option>Pix</option><option>Cartão de Débito</option><option>Cartão de Crédito</option></select></div><div class="field" id="rec-box"><label for="rec">Valor recebido</label><input id="rec" type="number" step="0.01" min="0" value="${p.valor}"><span class="hint" id="troco">Troco: R$ 0,00</span></div>`,
      aoAbrir: (ov) => { const m = $("#met", ov), r = $("#rec", ov); const f = () => { $("#rec-box", ov).hidden = m.value !== "Dinheiro"; $("#troco", ov).textContent = "Troco: " + brl(Math.max(0, (+r.value || 0) - p.valor)); }; m.addEventListener("change", f); r.addEventListener("input", f); f(); },
      botoes: [{ rotulo: "Voltar", classe: "outline" }, { rotulo: "Confirmar Recebimento", aoClicar: () => { if ($("#met").value === "Dinheiro" && (+$("#rec").value || 0) < p.valor) { toast("O valor recebido é menor que o valor cobrado.", "err"); return false; } const met = $("#met").value; registrarPagamento(c, p, met, eu().nome, un); toast("Pagamento registrado.", "ok"); setTimeout(() => { desenhar(); abrirModal({ titulo: "Emitir Recibo?", corpo: `<p>Pagamento de ${brl(p.valor)} registrado.</p>`, botoes: [{ rotulo: "Não Precisa", classe: "outline" }, { rotulo: "Imprimir Recibo", aoClicar: () => imprimirDoc("Recibo CaisMed", `<h1>Recibo de Pagamento</h1><p class="m">${esc(nomeUnidade(un))}<br>${fmtData(hoje)}</p><p>Recebemos de <b>${esc(c.nome)}</b> (CPF ${fmtCPF(c.cpf)}) a quantia de <b>${brl(p.valor)}</b>, referente a ${esc(p.descricao)}, pago em ${esc(met)}.</p><div class="sig">${esc(eu().nome)}<br>CaisMed</div>`) }] }); }, 100); } }] });
  }
  raizPag().innerHTML = `<div class="page-head"><div><h1>Caixa</h1><p class="lead">${esc(nomeUnidade(un))}, ${fmtDataLonga(hoje)}</p></div></div><div class="two-col"><div class="stack"><div class="field"><label class="sr" for="q">Buscar paciente</label><input id="q" type="search" placeholder="Buscar paciente por nome ou CPF"></div><div class="stack" id="pend"></div></div><div class="card" id="resumo"></div></div>`;
  $("#q").addEventListener("input", desenhar); desenhar();
}

// ---------- A11 Lista de espera ----------
function espera() {
  const desenhar = () => {
    const l = DB.get("espera").sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    $("#lista").innerHTML = l.length ? l.map((e) => { const c = DB.find("clientes", e.clienteId); return `<div class="card stack sm"><div class="row between"><b>${esc(c?.nome || "—")}</b>${e.avisado ? '<span class="badge ok">Avisado</span>' : '<span class="badge warn">Aguardando</span>'}</div><p class="muted">${esc(espNome(e.especialidade))}, desde ${fmtHora(e.criadoEm)}</p><div class="row"><a class="btn sm" href="agendar-paciente.html?cliente=${e.clienteId}&especialidade=${e.especialidade}">Agendar</a><button class="btn outline sm" data-av="${e.id}" type="button">Avisar Agora</button><button class="btn danger outline sm" data-rm="${e.id}" type="button">Remover</button></div></div>`; }).join("") : vazio("Lista de Espera Vazia", "Quando um paciente não achar horário, ele entra aqui. Ao cancelar uma consulta, o aviso sai automático.");
    $$("[data-av]").forEach((b) => b.addEventListener("click", () => { const e = DB.find("espera", b.dataset.av); notificar("cliente:" + e.clienteId, "Temos Horário Para Você", `Pode haver vaga de ${espNome(e.especialidade)}. Toque para agendar.`, "agendamento.html?especialidade=" + e.especialidade); DB.upd("espera", e.id, { avisado: true }); toast("Paciente avisado.", "ok"); desenhar(); }));
    $$("[data-rm]").forEach((b) => b.addEventListener("click", () => { DB.del("espera", b.dataset.rm); desenhar(); }));
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Lista de Espera</h1></div><div class="grid g2" id="lista"></div>`; desenhar();
}

ready(() => {
  ({ "atendente-painel": atendentePainel, agenda, "agendar-paciente": () => iniciarWizard("atendente"), fila, "painel-tv": painelTV, pacientes, "cliente-form": clienteForm, paciente, caixa, espera })[document.body.dataset.pagina]?.();
});


/* ======================= medico.js ======================= */
"use strict";
/* Portal do Médico (M01 a M14) */

const CIDS = ["J00 - Resfriado comum", "J06.9 - Infecção aguda das vias aéreas superiores", "G44.2 - Cefaleia tensional", "I10 - Hipertensão essencial", "E11 - Diabetes mellitus tipo 2", "M54.5 - Dor lombar baixa", "K29.7 - Gastrite", "L20 - Dermatite atópica", "R50.9 - Febre não especificada", "Z00.0 - Exame médico geral", "N76.0 - Vaginite aguda", "J45 - Asma", "B34.9 - Infecção viral não especificada"];
const MODELOS_RX = { "Dor e febre": [{ nome: "Dipirona 500 mg", posologia: "1 comprimido a cada 6 horas se dor ou febre, por até 3 dias" }], "Resfriado": [{ nome: "Soro fisiológico nasal", posologia: "2 jatos em cada narina, 3 vezes ao dia" }, { nome: "Paracetamol 750 mg", posologia: "1 comprimido a cada 8 horas se febre ou dor, por 3 dias" }], "Hidratação e repouso": [{ nome: "Hidratação oral", posologia: "Beber de 2 a 3 litros de água por dia e repousar" }] };
const euMedico = () => eu();

// ---------- M01 / M02 Agenda do dia e da semana ----------
function medicoPainel() {
  const me = euMedico(), un = unidadeAtiva();
  let data = sessionStorage.getItem("medData") || hojeISO(), modo = "dia";
  if (new URLSearchParams(location.search).get("ok")) toast("Atendimento finalizado. Documentos enviados ao paciente.", "ok");
  const minhas = (iso) => DB.get("consultas").filter((c) => c.medicoId === me.id && c.data === iso && c.status !== "cancelada" && (!un || c.unidadeId === un || c.unidadeId === "online")).sort((a, b) => a.horario.localeCompare(b.horario));
  const linha = (c) => { const chamado = c.chamadoEm && c.status === "aguardando"; return `<div class="item" style="cursor:default${c.status === "aguardando" ? ";border-color:var(--blue-text)" : ""}"><span class="avatar">${esc(c.horario)}</span><span class="grow"><b>${esc(c.paciente)}</b><small>${esc(nomeServico(c))}${c.tipo === "teleconsulta" ? ", online" : ", " + esc(nomeUnidade(c.unidadeId))}</small>${c.preTriagem ? '<small>Tem pré-triagem do chatbot</small>' : ""}</span>${chamado ? '<span class="badge ok">Chamado</span>' : ""}${badgeStatus(c.status)}${c.status === "aguardando" && !chamado && c.tipo !== "teleconsulta" ? `<button class="btn outline sm" data-chamar="${c.id}" type="button">Chamar</button>` : ""}<a class="btn sm ${["agendada"].includes(c.status) ? "outline" : ""}" href="atendimento.html?id=${c.id}">${c.status === "finalizada" ? "Ver" : "Atender"}</a></div>`; };
  const desenhar = () => {
    sessionStorage.setItem("medData", data); $("#data-lbl").textContent = fmtDataLonga(data);
    const l = minhas(data), hoje = minhas(hojeISO());
    $("#stats").innerHTML = `<div class="stat"><b>${hoje.length}</b><span>Consultas hoje</span></div><div class="stat"><b>${hoje.filter((c) => c.status === "aguardando").length}</b><span>Aguardando agora</span></div><div class="stat"><b>${hoje.filter((c) => c.status === "em_atendimento").length}</b><span>Em atendimento</span></div><div class="stat"><b>${hoje.filter((c) => c.status === "finalizada").length}</b><span>Finalizadas hoje</span></div>`;
    if (modo === "dia") $("#corpo").innerHTML = l.length ? `<div class="stack">${l.map(linha).join("")}</div>` : vazio("Sem Consultas Neste Dia", "Quando houver pacientes agendados, eles aparecem aqui.");
    else { const seg = addDias(data, -((diaSemana(data) + 6) % 7)); $("#corpo").innerHTML = `<div class="grid g4">${Array.from({ length: 7 }, (_, i) => addDias(seg, i)).map((d) => { const x = minhas(d); return `<button type="button" class="card stack sm" data-dia="${d}" style="text-align:left;${d === hojeISO() ? "border-color:var(--blue-text)" : ""}"><b>${fmtDataLonga(d)}</b><span class="badge ${x.length ? "info" : "mute"}">${x.length} consulta(s)</span>${x.slice(0, 3).map((c) => `<small class="muted">${esc(c.horario)} ${esc(c.paciente.split(" ")[0])}</small>`).join("")}</button>`; }).join("")}</div>`; $$("[data-dia]").forEach((b) => b.addEventListener("click", () => { data = b.dataset.dia; modo = "dia"; $$("#modo button").forEach((o) => o.setAttribute("aria-selected", String(o.dataset.m === "dia"))); desenhar(); })); }
    $$("[data-chamar]").forEach((b) => b.addEventListener("click", () => { DB.upd("consultas", b.dataset.chamar, { chamadoEm: new Date().toISOString() }); audit("Chamou paciente", DB.find("consultas", b.dataset.chamar).paciente); toast("Paciente chamado.", "ok"); desenhar(); }));
  };
  raizPag().innerHTML = `<div class="page-head"><div><h1>Agenda do Dia</h1><p class="lead">${esc(me.nome)}${un ? `, ${esc(nomeUnidade(un))}` : ", todas as unidades"}</p></div></div><div class="stats" id="stats"></div><div class="row between" style="margin-bottom:14px"><div class="row"><button class="btn outline sm" id="ant" type="button" aria-label="Anterior">${ico("back")}</button><b id="data-lbl" style="min-width:150px;text-align:center"></b><button class="btn outline sm" id="prox" type="button" aria-label="Próximo">${ico("right")}</button><button class="btn outline sm" id="hj" type="button">Hoje</button></div><div class="seg" id="modo" role="tablist" style="width:auto"><button data-m="dia" aria-selected="true" type="button">Dia</button><button data-m="semana" aria-selected="false" type="button">Semana</button></div></div><div id="corpo"></div>`;
  const passo = () => (modo === "dia" ? 1 : 7);
  $("#ant").addEventListener("click", () => { data = addDias(data, -passo()); desenhar(); }); $("#prox").addEventListener("click", () => { data = addDias(data, passo()); desenhar(); }); $("#hj").addEventListener("click", () => { data = hojeISO(); desenhar(); });
  $$("#modo button").forEach((b) => b.addEventListener("click", () => { modo = b.dataset.m; $$("#modo button").forEach((o) => o.setAttribute("aria-selected", String(o === b))); desenhar(); }));
  desenhar();
  setInterval(() => !document.querySelector(".overlay") && modo === "dia" && desenhar(), 8000);
}

// ---------- M03 / M05 / M06 Atendimento ----------
function atendimento() {
  const id = new URLSearchParams(location.search).get("id"); let c = DB.find("consultas", id), me = euMedico();
  if (!c || c.medicoId !== me.id) { raizPag().innerHTML = vazio("Consulta Não Encontrada", "Você só acessa os atendimentos da sua agenda.", '<a class="btn sm" href="medico-painel.html">Voltar à Agenda</a>'); return; }
  const cl = DB.find("clientes", c.pacienteId) || { nome: c.paciente, alertas: {} }, somenteLer = c.status === "finalizada";
  if (["agendada", "aguardando"].includes(c.status) && c.tipo !== "teleconsulta") c = DB.upd("consultas", id, (x) => ({ status: "em_atendimento", iniciouEm: new Date().toISOString(), historico: [...(x.historico || []), { quando: new Date().toISOString(), texto: "Atendimento iniciado" }] }));
  audit("Abriu prontuário/atendimento", c.paciente);
  const r = c.rascunho || { anamnese: c.anamnese || "", evolucao: c.evolucao || "", cid: c.cid || "", meds: [], atestado: { on: false, dias: 1, texto: "" }, exames: [], justificativa: "", anexos: [] };
  const hist = DB.get("consultas").filter((x) => x.pacienteId === c.pacienteId && x.status === "finalizada" && x.id !== c.id).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);
  const t = c.preTriagem, al = cl.alertas || {};
  const exames = DB.get("exames", EXAMES_PADRAO);
  raizPag().innerHTML = `<div class="page-head"><div><h1>${esc(c.paciente)}</h1><p class="lead">${cl.nascimento ? idade(cl.nascimento) + " anos, " : ""}${esc((PLANOS[cl.plano] || {}).nome || "Particular")}. ${esc(nomeServico(c))}, ${esc(c.horario)}</p></div><div class="row">${badgeStatus(c.status)}<a class="btn outline sm" href="prontuario.html?paciente=${c.pacienteId}">Prontuário Completo</a></div></div>
  ${c.tipo === "teleconsulta" && !somenteLer ? `<div class="card pale row between" style="margin-bottom:14px"><span><b>Teleconsulta</b><br><small class="muted">${c.teleIniciada ? "Chamada em andamento. O vídeo vem do serviço de videochamada do back-end." : "O paciente entra na sala de espera e aguarda você iniciar."}</small></span>${c.teleIniciada ? "" : `<button class="btn" id="tele" type="button">${ico("video")} Iniciar Teleconsulta</button>`}</div>` : ""}
  <div class="two-col"><div class="stack"><div class="tabs" id="abas">${[["t-an", "Anamnese"], ["t-ev", "Evolução e CID"], ["t-rx", "Prescrição"], ["t-ex", "Exames"], ["t-ax", "Anexos"]].map(([k, v], i) => `<button type="button" class="tab-btn ${i ? "" : "active"}" data-tab="${k}">${v}</button>`).join("")}</div>
  <div class="tab-panel active" id="t-an"><div class="field"><label for="anamnese">Queixa principal e história</label><textarea id="anamnese" rows="8">${esc(r.anamnese)}</textarea></div></div>
  <div class="tab-panel" id="t-ev"><div class="field"><label for="evolucao">Evolução clínica</label><textarea id="evolucao" rows="7">${esc(r.evolucao)}</textarea></div><div class="field"><label for="cid">Diagnóstico (CID)</label><input id="cid" list="cids" value="${esc(r.cid)}" placeholder="Digite o código ou o nome"><datalist id="cids">${CIDS.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div></div>
  <div class="tab-panel" id="t-rx"><div class="row"><div class="field" style="margin:0;flex:1 1 200px"><label for="modelo">Modelo pronto</label><select id="modelo"><option value="">Escolha um modelo</option>${Object.keys(MODELOS_RX).map((k) => `<option>${k}</option>`).join("")}</select></div><button class="btn outline sm" id="add-med" type="button" style="align-self:flex-end">${ico("plus")} Adicionar Medicamento</button></div><div class="stack" id="meds"></div>
    <label class="check" style="margin-top:8px"><input type="checkbox" id="at-on" ${r.atestado.on ? "checked" : ""}> Emitir atestado</label><div id="at-box" class="form-grid" ${r.atestado.on ? "" : "hidden"}><div class="field"><label for="at-dias">Dias de afastamento</label><input id="at-dias" type="number" min="1" max="30" value="${r.atestado.dias}"></div><div class="field full"><label for="at-txt">Texto do atestado</label><textarea id="at-txt">${esc(r.atestado.texto)}</textarea></div></div><button class="btn outline sm" id="prev-rx" type="button">${ico("print")} Visualizar Receita em PDF</button></div>
  <div class="tab-panel" id="t-ex"><div class="field"><label for="busca-ex">Buscar exame</label><input id="busca-ex" type="search" placeholder="Digite o nome do exame"></div><div class="stack" id="lista-ex"></div><div class="field" style="margin-top:12px"><label for="just">Justificativa clínica</label><textarea id="just">${esc(r.justificativa)}</textarea></div></div>
  <div class="tab-panel" id="t-ax"><div class="field"><label for="anexo">Anexar arquivo (foto ou PDF)</label><input id="anexo" type="file" accept="image/*,application/pdf" multiple></div><div class="stack" id="lista-ax"></div></div>
  ${somenteLer ? '<p class="badge ok">Atendimento finalizado. Somente leitura.</p>' : `<div class="actions"><button class="btn outline" id="salvar" type="button">Salvar Rascunho</button><button class="btn" id="finalizar" type="button">Finalizar Atendimento</button></div>`}</div>
  <div class="stack"><div class="card stack sm"><div class="card-h"><h2>Alertas clínicos</h2>${somenteLer ? "" : '<button class="link" id="ed-al" type="button">Editar</button>'}</div><p><b>Alergias:</b> ${esc(al.alergias || "Não informado")}</p><p><b>Medicamentos em uso:</b> ${esc(al.medicamentos || "Não informado")}</p></div>
  ${t ? `<div class="card stack sm"><h2>Pré-triagem do chatbot</h2><p><b>Motivo:</b> ${esc(t.motivo || "—")}</p><p><b>Sintomas:</b> ${esc((t.sintomas || []).map((s) => ({ febre: "Febre", tosse: "Tosse", dor_cabeca: "Dor de cabeça", dor_corpo: "Dor no corpo", falta_ar: "Falta de ar", nausea: "Náusea" }[s] || s)).join(", ") || "Nenhum")}</p><p><b>Urgência:</b> ${esc({ baixa: "Baixa", media: "Média", alta: "Alta" }[t.urgencia] || "—")}</p><p><b>Observações:</b> ${esc(t.observacoes || "—")}</p></div>` : ""}
  <div class="card stack sm"><h2>Histórico resumido</h2>${hist.length ? hist.map((x) => `<div class="kv"><span>${fmtData(x.data)}<br><small class="muted">${esc(x.cid || "")}</small></span><span class="small">${esc((x.evolucao || "").slice(0, 110))}</span></div>`).join("") : '<p class="muted">Primeira consulta nesta clínica.</p>'}</div></div></div>`;
  ligarAbas(raizPag());
  const st = { ...r, meds: [...(r.meds || [])], exames: [...(r.exames || [])], anexos: [...(r.anexos || [])] };
  const rascunho = () => { st.anamnese = $("#anamnese").value; st.evolucao = $("#evolucao").value; st.cid = $("#cid").value; st.atestado = { on: $("#at-on").checked, dias: +$("#at-dias").value || 1, texto: $("#at-txt").value }; st.justificativa = $("#just").value; if (!somenteLer) DB.upd("consultas", id, { rascunho: st }); };
  const medsUI = () => { $("#meds").innerHTML = st.meds.length ? st.meds.map((m, i) => `<div class="card stack sm"><div class="row" style="flex-wrap:nowrap"><input data-m="${i}" data-k="nome" value="${esc(m.nome)}" placeholder="Medicamento e dose" aria-label="Medicamento"><button class="btn danger outline sm" data-rm="${i}" type="button" aria-label="Remover">${ico("trash")}</button></div><input data-m="${i}" data-k="posologia" value="${esc(m.posologia)}" placeholder="Como tomar" aria-label="Posologia"></div>`).join("") : '<p class="muted">Nenhum medicamento adicionado.</p>'; $$("[data-m]").forEach((el) => el.addEventListener("input", () => { st.meds[+el.dataset.m][el.dataset.k] = el.value; rascunho(); })); $$("[data-rm]").forEach((b) => b.addEventListener("click", () => { st.meds.splice(+b.dataset.rm, 1); medsUI(); rascunho(); })); };
  const exUI = () => { const q = $("#busca-ex").value.toLowerCase(); $("#lista-ex").innerHTML = exames.filter((x) => x.nome.toLowerCase().includes(q)).map((x) => `<label class="check"><input type="checkbox" data-ex="${x.id}" ${st.exames.includes(x.id) ? "checked" : ""}> ${esc(x.nome)}</label>`).join(""); $$("[data-ex]").forEach((el) => el.addEventListener("change", () => { st.exames = el.checked ? [...new Set([...st.exames, el.dataset.ex])] : st.exames.filter((x) => x !== el.dataset.ex); rascunho(); })); };
  const axUI = () => ($("#lista-ax").innerHTML = st.anexos.length ? st.anexos.map((a) => `<div class="item" style="cursor:default">${ico("file")}<span class="grow">${esc(a)}</span></div>`).join("") : '<p class="muted">Nenhum anexo.</p>');
  medsUI(); exUI(); axUI();
  if (somenteLer) $$("input,textarea,select,button.btn:not(.outline)", raizPag()).forEach((el) => { if (!el.closest("#abas") && !el.closest(".page-head")) el.disabled = true; });
  $$("textarea,#cid,#at-dias,#just").forEach((el) => el.addEventListener("input", rascunho));
  $("#at-on").addEventListener("change", () => { $("#at-box").hidden = !$("#at-on").checked; rascunho(); });
  $("#busca-ex").addEventListener("input", exUI);
  $("#anexo").addEventListener("change", (e) => { st.anexos.push(...[...e.target.files].map((f) => f.name)); axUI(); rascunho(); });
  $("#add-med").addEventListener("click", () => { st.meds.push({ nome: "", posologia: "" }); medsUI(); rascunho(); });
  $("#modelo").addEventListener("change", (e) => { if (e.target.value) { st.meds.push(...structuredClone(MODELOS_RX[e.target.value])); medsUI(); rascunho(); e.target.value = ""; } });
  $("#tele")?.addEventListener("click", () => { DB.upd("consultas", id, { teleIniciada: true, status: "em_atendimento", iniciouEm: new Date().toISOString() }); audit("Iniciou teleconsulta", c.paciente); location.reload(); });
  $("#ed-al")?.addEventListener("click", () => abrirModal({ titulo: "Alertas Clínicos", corpo: `<div class="field"><label for="a1">Alergias</label><input id="a1" value="${esc(al.alergias || "")}"></div><div class="field"><label for="a2">Medicamentos em uso</label><input id="a2" value="${esc(al.medicamentos || "")}"></div>`, botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Salvar", aoClicar: () => { DB.upd("clientes", cl.id, { alertas: { alergias: $("#a1").value, medicamentos: $("#a2").value } }); audit("Atualizou alertas clínicos", c.paciente); setTimeout(() => location.reload(), 100); } }] }));
  const corpoRx = () => `<h1>Receita Médica</h1><p class="m">Paciente: ${esc(c.paciente)}<br>Data: ${fmtData(hojeISO())}<br>${esc(me.nome)}, ${esc(me.crm)}</p><ul>${st.meds.filter((m) => m.nome).map((m) => `<li><b>${esc(m.nome)}</b><br>${esc(m.posologia)}</li>`).join("")}</ul><div class="sig">${esc(me.nome)}<br>${esc(me.crm)}<br>Assinatura digital (simulada)</div>`;
  $("#prev-rx").addEventListener("click", () => (st.meds.filter((m) => m.nome).length ? imprimirDoc("Receita Médica", corpoRx()) : toast("Adicione ao menos um medicamento.", "err")));
  $("#salvar")?.addEventListener("click", () => { rascunho(); toast("Rascunho salvo.", "ok"); });
  $("#finalizar")?.addEventListener("click", async () => {
    rascunho();
    if (!st.evolucao.trim()) { toast("Preencha a evolução clínica antes de finalizar.", "err"); $$("#abas .tab-btn")[1].click(); return; }
    if (!(await confirmar("Finalizar o atendimento? Receitas e pedidos serão enviados ao paciente.", { ok: "Finalizar" }))) return;
    // TODO: POST /atendimentos/:id/finalizar (back-end valida assinatura digital e regras do CFM)
    const hoje = hojeISO(), base = { clienteId: c.pacienteId, consultaId: c.id, medicoId: me.id, data: hoje, visto: false };
    const meds = st.meds.filter((m) => m.nome.trim());
    if (meds.length) DB.add("documentos", { ...base, tipo: "receita", titulo: "Receita Médica", itens: meds });
    if (st.exames.length) DB.add("documentos", { ...base, tipo: "exame_pedido", titulo: "Pedido de Exame: " + st.exames.map((x) => exames.find((e) => e.id === x)?.nome).join(", "), itens: st.exames.map((x) => ({ nome: exames.find((e) => e.id === x)?.nome, posologia: "Justificativa: " + (st.justificativa || "avaliação clínica") })) });
    if (st.atestado.on) DB.add("documentos", { ...base, tipo: "atestado", titulo: "Atestado Médico", texto: `Atesto que ${c.paciente} esteve em consulta em ${fmtData(hoje)} e deve permanecer afastado por ${st.atestado.dias} dia(s). ${st.atestado.texto}`, itens: [] });
    DB.upd("consultas", id, (x) => ({ status: "finalizada", atendida: true, finalizadoEm: new Date().toISOString(), anamnese: st.anamnese, evolucao: st.evolucao, cid: st.cid, anexos: st.anexos, rascunho: null, historico: [...(x.historico || []), { quando: new Date().toISOString(), texto: "Atendimento finalizado" }] }));
    notificar("cliente:" + c.pacienteId, "Documentos Disponíveis", "Seu atendimento foi finalizado. Receitas e pedidos já estão em Documentos.", "documentos.html");
    audit("Finalizou atendimento", c.paciente);
    location.href = "medico-painel.html?ok=1";
  });
}

// ---------- M04 Prontuário completo ----------
function prontuario() {
  const pid = new URLSearchParams(location.search).get("paciente"), perfil = Sessao.perfil, me = eu();
  const cl = DB.find("clientes", pid);
  if (!cl) { raizPag().innerHTML = vazio("Paciente Não Encontrado"); return; }
  if (perfil === "medico" && !DB.get("consultas").some((c) => c.medicoId === me.id && c.pacienteId === pid)) { location.replace("estado.html?tipo=sem-permissao"); return; }
  const desenhar = () => {
    audit(perfil === "admin" ? "Acessou prontuário (admin)" : "Abriu prontuário", cl.nome);
    const ev = [];
    DB.get("consultas").filter((c) => c.pacienteId === pid && c.status === "finalizada").forEach((c) => ev.push({ d: c.data, t: `Consulta: ${nomeServico(c)}`, m: medicoPorId(c.medicoId)?.nome, txt: [c.anamnese && `Anamnese: ${c.anamnese}`, c.evolucao && `Evolução: ${c.evolucao}`, c.cid && `CID: ${c.cid}`].filter(Boolean).join("\n") }));
    DB.get("documentos").filter((d) => d.clienteId === pid).forEach((d) => ev.push({ d: d.data, t: d.titulo, m: medicoPorId(d.medicoId)?.nome, txt: [d.laudo, d.texto, ...(d.itens || []).map((i) => `${i.nome}: ${i.posologia || ""}`)].filter(Boolean).join("\n") }));
    ev.sort((a, b) => b.d.localeCompare(a.d));
    const draw = () => { const q = $("#busca").value.toLowerCase(); const l = ev.filter((e) => !q || `${e.t} ${e.txt} ${e.m}`.toLowerCase().includes(q)); $("#linha").innerHTML = l.length ? l.map((e) => `<div class="ev"><div class="row between"><b>${esc(e.t)}</b><span class="muted small">${fmtData(e.d)}</span></div>${e.m ? `<small class="muted">${esc(e.m)}</small>` : ""}${e.txt ? `<p style="white-space:pre-line;margin-top:6px">${esc(e.txt)}</p>` : ""}</div>`).join("") : vazio("Nada Encontrado", "Tente outra palavra na busca."); };
    raizPag().innerHTML = `<div class="page-head"><div><h1>Prontuário: ${esc(cl.nome)}</h1><p class="lead">${idade(cl.nascimento)} anos. Todo acesso fica registrado em auditoria.</p></div></div><div class="card stack sm" style="margin-bottom:16px"><p><b>Alergias:</b> ${esc(cl.alertas?.alergias || "Não informado")}</p><p><b>Medicamentos em uso:</b> ${esc(cl.alertas?.medicamentos || "Não informado")}</p></div><div class="field"><label for="busca" class="sr">Buscar no histórico</label><input id="busca" type="search" placeholder="Buscar no histórico (diagnóstico, remédio, exame...)"></div><div class="timeline" id="linha"></div>`;
    $("#busca").addEventListener("input", draw); draw();
  };
  if (perfil === "admin" && !sessionStorage.getItem("just" + pid)) {
    raizPag().innerHTML = vazio("Acesso Com Justificativa", "O administrador só abre prontuário com justificativa. O motivo fica registrado na auditoria.");
    abrirModal({ titulo: "Justificar Acesso ao Prontuário", corpo: `<div class="field"><label for="just">Motivo do acesso</label><textarea id="just" required></textarea></div>`, botoes: [{ rotulo: "Voltar", classe: "outline", aoClicar: () => { location.href = "admin-auditoria.html"; } }, { rotulo: "Acessar", aoClicar: () => { const j = $("#just").value.trim(); if (j.length < 10) { toast("Descreva o motivo com pelo menos 10 letras.", "err"); return false; } sessionStorage.setItem("just" + pid, j); audit("Justificativa de acesso ao prontuário", `${cl.nome}: ${j}`); setTimeout(desenhar, 50); } }] });
    return;
  }
  desenhar();
}

// ---------- M10 Meus pacientes ----------
function meusPacientes() {
  const me = eu(), cons = DB.get("consultas").filter((c) => c.medicoId === me.id);
  const ids = [...new Set(cons.map((c) => c.pacienteId).filter(Boolean))];
  const desenhar = () => { const q = $("#q").value.toLowerCase(); const l = ids.map((i) => DB.find("clientes", i)).filter((c) => c && (!q || c.nome.toLowerCase().includes(q))); $("#lista").innerHTML = l.length ? l.map((c) => { const mine = cons.filter((x) => x.pacienteId === c.id), ult = mine.filter((x) => x.status === "finalizada").sort((a, b) => b.data.localeCompare(a.data))[0]; return `<a class="item" href="prontuario.html?paciente=${c.id}"><span class="avatar">${esc(iniciais(c.nome))}</span><span class="grow"><b>${esc(c.nome)}</b><small>${mine.length} consulta(s)${ult ? `, última em ${fmtData(ult.data)}` : ""}</small></span>${ico("right")}</a>`; }).join("") : vazio("Nenhum Paciente", "Você vê só quem já atendeu ou está na sua agenda."); };
  raizPag().innerHTML = `<div class="page-head"><h1>Meus Pacientes</h1></div><div class="field"><label class="sr" for="q">Buscar</label><input id="q" type="search" placeholder="Buscar por nome"></div><div class="grid g2" id="lista"></div>`;
  $("#q").addEventListener("input", desenhar); desenhar();
}

// ---------- M11 Meus horários, folgas e férias ----------
function horarios() {
  const salvar = (m) => { DB.upd("usuarios", m.id, { disp: m.disp, folgas: m.folgas }); };
  const desenhar = () => {
    const m = eu(); m.disp ||= []; m.folgas ||= [];
    raizPag().innerHTML = `<div class="page-head"><h1>Meus Horários</h1><button class="btn" id="novo" type="button">${ico("plus")} Adicionar Horário</button></div><div class="two-col"><div class="stack"><h2>Disponibilidade por unidade</h2>${m.disp.length ? m.disp.map((b, i) => `<div class="card stack sm"><div class="row between"><b>${esc(nomeUnidade(b.unidadeId))}</b><button class="btn danger outline sm" data-rm="${i}" type="button">${ico("trash")} Remover</button></div><p>${b.dias.map((d) => DIAS[d].slice(0, 3)).join(", ")}</p><p class="muted">${b.inicio} às ${b.fim}, consultas de ${b.duracao} minutos</p></div>`).join("") : vazio("Sem Horários Definidos", "Adicione os dias e horários em que você atende.")}</div>
    <div class="stack"><div class="row between"><h2>Folgas e férias</h2><button class="btn outline sm" id="nova-folga" type="button">${ico("plus")} Adicionar</button></div>${m.folgas.length ? m.folgas.map((f, i) => `<div class="item" style="cursor:default"><span class="grow"><b>${fmtData(f.inicio)} a ${fmtData(f.fim)}</b><small>${esc(f.motivo || "Folga")}</small></span><button class="btn danger outline sm" data-rf="${i}" type="button" aria-label="Remover">${ico("trash")}</button></div>`).join("") : '<p class="muted">Nenhuma folga ou férias cadastrada.</p>'}<p class="hint">Nesses dias nenhum horário seu fica disponível para agendamento.</p></div></div>`;
    $$("[data-rm]").forEach((b) => b.addEventListener("click", async () => { if (await confirmar("Remover este horário? Consultas já marcadas continuam.", { perigo: true, ok: "Remover" })) { m.disp.splice(+b.dataset.rm, 1); salvar(m); desenhar(); } }));
    $$("[data-rf]").forEach((b) => b.addEventListener("click", () => { m.folgas.splice(+b.dataset.rf, 1); salvar(m); desenhar(); }));
    $("#novo").addEventListener("click", () => abrirModal({ titulo: "Adicionar Horário", corpo: `<div class="field"><label for="h-un">Unidade</label><select id="h-un">${unidadesDoUsuario().map((u) => `<option value="${u.id}">${esc(u.nome)}</option>`).join("")}</select></div><span class="label">Dias da semana</span><div class="chips" id="h-dias" style="margin:6px 0 12px">${[1, 2, 3, 4, 5, 6].map((d) => `<button type="button" class="chip" data-d="${d}" aria-pressed="false">${DIAS[d].slice(0, 3)}</button>`).join("")}</div><div class="form-grid"><div class="field"><label for="h-i">Início</label><input id="h-i" type="time" value="08:00"></div><div class="field"><label for="h-f">Fim</label><input id="h-f" type="time" value="12:00"></div></div><div class="field"><label for="h-d">Duração da consulta</label><select id="h-d">${[15, 20, 30, 40, 60].map((x) => `<option ${x === 30 ? "selected" : ""} value="${x}">${x} minutos</option>`).join("")}</select></div>`,
      aoAbrir: (ov) => $$("#h-dias .chip", ov).forEach((b) => b.addEventListener("click", () => b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")))),
      botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Salvar Horário", aoClicar: () => { const dias = $$("#h-dias .chip").filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => +b.dataset.d), i = $("#h-i").value, f = $("#h-f").value; if (!dias.length) { toast("Escolha ao menos um dia.", "err"); return false; } if (!i || !f || hm(f) <= hm(i)) { toast("O fim precisa ser depois do início.", "err"); return false; } m.disp.push({ unidadeId: $("#h-un").value, dias, inicio: i, fim: f, duracao: +$("#h-d").value }); salvar(m); audit("Alterou horários de atendimento"); setTimeout(desenhar, 0); } }] }));
    $("#nova-folga").addEventListener("click", () => abrirModal({ titulo: "Folga ou Férias", corpo: `<div class="form-grid"><div class="field"><label for="f-i">De</label><input id="f-i" type="date" min="${hojeISO()}"></div><div class="field"><label for="f-f">Até</label><input id="f-f" type="date" min="${hojeISO()}"></div></div><div class="field"><label for="f-m">Motivo</label><input id="f-m" placeholder="Ex.: férias"></div>`, botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Salvar", aoClicar: () => { const i = $("#f-i").value, f = $("#f-f").value; if (!i || !f || f < i) { toast("Confira as datas.", "err"); return false; } m.folgas.push({ inicio: i, fim: f, motivo: $("#f-m").value }); salvar(m); audit("Cadastrou folga ou férias"); setTimeout(desenhar, 0); } }] }));
  };
  desenhar();
}

// ---------- M14 Perfil profissional ----------
function medicoPerfil() {
  const m = eu();
  raizPag().innerHTML = `<div class="page-head"><h1>Perfil Profissional</h1><p class="lead">Estas informações aparecem para o paciente na hora de escolher o médico.</p></div><form class="card" id="f" style="max-width:720px"><div class="row" style="margin-bottom:14px"><span class="avatar lg">${esc(iniciais(m.nome))}</span><div><b>${esc(m.nome)}</b><br><span class="muted">${esc(m.crm)}</span></div></div><div class="field"><label>Especialidades</label><div class="chips">${m.especialidades.map((e) => `<span class="badge info">${esc(espNome(e))}</span>`).join("")}</div><span class="hint">CRM e especialidades são alterados pelo administrador.</span></div><div class="field"><label for="bio">Mini-bio</label><textarea id="bio" maxlength="220">${esc(m.bio || "")}</textarea></div><label class="check"><input type="checkbox" id="tele" ${m.tele ? "checked" : ""}> Atendo por teleconsulta</label><div class="field" style="margin-top:12px"><label for="sn">Nova senha (opcional)</label><input id="sn" type="password" minlength="6" autocomplete="new-password"></div><p class="hint">Assinatura digital: o certificado do médico é configurado no back-end. Nas receitas deste demo ela aparece como simulada.</p><div class="actions"><button class="btn" type="submit">Salvar Perfil</button></div></form>`;
  $("#f").addEventListener("submit", (e) => { e.preventDefault(); const sn = $("#sn").value; if (sn && sn.length < 6) return toast("A senha precisa de ao menos 6 caracteres.", "err"); DB.upd("usuarios", m.id, { bio: $("#bio").value.trim(), tele: $("#tele").checked, ...(sn ? { senha: sn } : {}) }); audit("Atualizou perfil profissional"); toast("Perfil salvo.", "ok"); });
}

ready(() => {
  ({ "medico-painel": medicoPainel, atendimento, prontuario, "meus-pacientes": meusPacientes, horarios, "medico-perfil": medicoPerfil })[document.body.dataset.pagina]?.();
});


/* ======================= admin.js ======================= */
"use strict";
/* Portal do Administrador (AD01 a AD10) */

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const barra = (rot, v, max, txt) => `<div style="margin:8px 0"><div class="row between small"><span>${esc(rot)}</span><b>${esc(txt ?? v)}</b></div><div style="height:10px;background:var(--pale2);border-radius:99px;overflow:hidden"><div style="height:100%;width:${max ? Math.round((v / max) * 100) : 0}%;background:var(--blue)"></div></div></div>`;
const inicioPeriodo = (n) => (n === "todo" ? "0000-00-00" : addDias(hojeISO(), -Number(n)));
const seletorPeriodo = (sel = "30") => `<div class="field" style="margin:0"><label class="sr" for="per">Período</label><select id="per" style="width:auto"><option value="7" ${sel === "7" ? "selected" : ""}>Últimos 7 dias</option><option value="30" ${sel === "30" ? "selected" : ""}>Últimos 30 dias</option><option value="90" ${sel === "90" ? "selected" : ""}>Últimos 90 dias</option><option value="todo" ${sel === "todo" ? "selected" : ""}>Todo o período</option></select></div>`;

// ---------- AD01 Dashboard da rede ----------
function adminPainel() {
  const desenhar = (per) => {
    const ini = inicioPeriodo(per), unis = DB.get("unidades");
    const cons = DB.get("consultas").filter((c) => c.data && c.data >= ini && c.data <= hojeISO());
    const pags = DB.get("pagamentos").filter((p) => p.data >= ini);
    const ativas = cons.filter((c) => c.status !== "cancelada");
    const porUn = unis.map((u) => ({ u, n: ativas.filter((c) => c.unidadeId === u.id).length }));
    const maxU = Math.max(1, ...porUn.map((x) => x.n));
    const ocup = unis.map((u) => { let tot = 0, oc = 0; medicosAtivos().filter((m) => m.unidades.includes(u.id)).forEach((m) => { for (let i = 0; i < 14; i++) { const s = slotsDoMedico(m, addDias(hojeISO(), i), u.id); tot += s.length; oc += s.filter((x) => x.ocupado).length; } }); return { u, pct: tot ? Math.round((oc / tot) * 100) : 0 }; });
    const stN = (s) => cons.filter((c) => c.status === s).length;
    $("#dash").innerHTML = `<div class="stats"><div class="stat"><b>${ativas.length}</b><span>Consultas no período</span></div><div class="stat"><b>${brl(pags.reduce((s, p) => s + p.valor, 0))}</b><span>Faturamento recebido</span></div><div class="stat"><b>${stN("faltou")}</b><span>Faltas</span></div><div class="stat"><b>${stN("cancelada")}</b><span>Cancelamentos</span></div></div>
    <div class="grid g2"><div class="card"><h2>Consultas por unidade</h2>${porUn.map((x) => barra(x.u.nome, x.n, maxU)).join("")}</div><div class="card"><h2>Ocupação da agenda (próximos 14 dias)</h2>${ocup.map((x) => barra(x.u.nome, x.pct, 100, x.pct + "%")).join("")}</div>
    <div class="card"><h2>Faturamento por unidade</h2>${unis.map((u) => { const v = pags.filter((p) => p.unidadeId === u.id).reduce((s, p) => s + p.valor, 0); return barra(u.nome, v, Math.max(1, ...unis.map((y) => pags.filter((p) => p.unidadeId === y.id).reduce((s, p) => s + p.valor, 0))), brl(v)); }).join("")}<p class="hint">Mensalidades online não pertencem a uma unidade e entram só no total.</p></div>
    <div class="card"><h2>Pacientes e equipe</h2><div class="kv"><span>Pacientes cadastrados</span><span>${DB.get("clientes").length}</span></div><div class="kv"><span>Médicos ativos</span><span>${medicosAtivos().length}</span></div><div class="kv"><span>Unidades ativas</span><span>${unis.filter((u) => u.ativa !== false).length}</span></div><div class="kv"><span>Mensagens novas na ouvidoria</span><span>${DB.get("ouvidoria").filter((o) => o.status === "nova").length}</span></div></div></div>`;
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Painel da Rede</h1>${seletorPeriodo("todo")}</div><div id="dash"></div>`;
  $("#per").addEventListener("change", (e) => desenhar(e.target.value)); desenhar("todo");
}

// ---------- AD02 Unidades ----------
function adminUnidades() {
  const desenhar = () => {
    $("#tab").innerHTML = `<table><thead><tr><th>Unidade</th><th>Endereço</th><th>Salas</th><th>Especialidades</th><th>Status</th><th></th></tr></thead><tbody>${DB.get("unidades").map((u) => `<tr><td><b>${esc(u.nome)}</b></td><td>${esc(u.endereco)}, ${esc(u.bairro)}, ${esc(u.cidade)}<br><small class="muted">${esc(u.horario)}</small></td><td>${u.salas}</td><td>${u.especialidades.map((e) => esc(espNome(e))).join(", ")}</td><td>${u.ativa === false ? '<span class="badge mute">Inativa</span>' : '<span class="badge ok">Ativa</span>'}</td><td><button class="btn outline sm" data-ed="${u.id}" type="button">Editar</button></td></tr>`).join("")}</tbody></table>`;
    $$("[data-ed]").forEach((b) => b.addEventListener("click", () => form(DB.find("unidades", b.dataset.ed))));
  };
  const form = (u) => abrirModal({ titulo: u ? "Editar Unidade" : "Nova Unidade", corpo: `<div class="field"><label for="u-n">Nome</label><input id="u-n" value="${esc(u?.nome || "")}"></div><div class="form-grid"><div class="field full"><label for="u-e">Endereço</label><input id="u-e" value="${esc(u?.endereco || "")}"></div><div class="field"><label for="u-b">Bairro</label><input id="u-b" value="${esc(u?.bairro || "")}"></div><div class="field"><label for="u-c">Cidade</label><input id="u-c" value="${esc(u?.cidade || "")}"></div><div class="field"><label for="u-f">Telefone</label><input id="u-f" type="tel" value="${esc(u?.fone || "")}"></div><div class="field"><label for="u-s">Salas</label><input id="u-s" type="number" min="1" value="${u?.salas || 3}"></div><div class="field full"><label for="u-h">Horário de funcionamento</label><input id="u-h" value="${esc(u?.horario || "Seg a Sex, 7h às 18h")}"></div></div><span class="label">Especialidades atendidas</span><div class="stack sm" style="margin:6px 0 10px">${espLista().map((e) => `<label class="check"><input type="checkbox" data-e="${e.id}" ${u?.especialidades?.includes(e.id) ? "checked" : ""}> ${esc(e.nome)}</label>`).join("")}</div><label class="check"><input type="checkbox" id="u-a" ${u?.ativa === false ? "" : "checked"}> Unidade ativa</label>`,
    botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Salvar Unidade", aoClicar: () => { const d = { nome: $("#u-n").value.trim(), endereco: $("#u-e").value.trim(), bairro: $("#u-b").value.trim(), cidade: $("#u-c").value.trim(), fone: $("#u-f").value, salas: +$("#u-s").value || 1, horario: $("#u-h").value.trim(), especialidades: $$("[data-e]").filter((x) => x.checked).map((x) => x.dataset.e), ativa: $("#u-a").checked }; if (!d.nome || !d.endereco || !d.cidade) { toast("Preencha nome, endereço e cidade.", "err"); return false; } if (u) DB.upd("unidades", u.id, d); else DB.add("unidades", { id: "u" + uid(), ...d }); audit(u ? "Editou unidade" : "Criou unidade", d.nome); setTimeout(desenhar, 0); } }] });
  raizPag().innerHTML = `<div class="page-head"><h1>Unidades</h1><button class="btn" id="novo" type="button">${ico("plus")} Cadastrar Unidade</button></div><div class="table-wrap" id="tab"></div>`;
  $("#novo").addEventListener("click", () => form()); desenhar();
}

// ---------- AD03 / AD04 Usuários e permissões ----------
const MATRIZ = [["Ver e criar agendamentos", 1, 1, 0, 1], ["Cadastrar e alterar pacientes", 0, 1, 0, 1], ["Receber pagamentos (caixa)", 0, 1, 0, 1], ["Ver prontuário clínico", 0, 0, 1, "Só com justificativa"], ["Escrever evolução e prescrever", 0, 0, 1, 0], ["Ver o próprio histórico e documentos", 1, 0, 0, 0], ["Gerenciar unidades, usuários e preços", 0, 0, 0, 1], ["Ver faturamento e relatórios da rede", 0, 0, 0, 1], ["Ver auditoria (logs)", 0, 0, 0, 1]];
function adminUsuarios() {
  const desenhar = () => {
    $("#tab").innerHTML = `<table><thead><tr><th>Nome</th><th>Perfil</th><th>Matrícula</th><th>Unidades</th><th>Status</th><th></th></tr></thead><tbody>${DB.get("usuarios").map((u) => `<tr><td><b>${esc(u.nome)}</b>${u.crm ? `<br><small class="muted">${esc(u.crm)}</small>` : ""}</td><td>${PERFIL_NOME[u.perfil]}</td><td>${esc(u.matricula)}</td><td>${(u.unidades || []).map((x) => esc(nomeUnidade(x))).join(", ")}</td><td>${u.ativo === false ? '<span class="badge mute">Inativo</span>' : '<span class="badge ok">Ativo</span>'}</td><td><button class="btn outline sm" data-ed="${u.id}" type="button">Editar</button></td></tr>`).join("")}</tbody></table>`;
    $$("[data-ed]").forEach((b) => b.addEventListener("click", () => form(DB.find("usuarios", b.dataset.ed))));
  };
  const form = (u) => abrirModal({ titulo: u ? "Editar Usuário" : "Novo Usuário", corpo: `<div class="form-grid"><div class="field"><label for="x-p">Perfil</label><select id="x-p" ${u ? "disabled" : ""}><option value="atendente" ${u?.perfil === "atendente" ? "selected" : ""}>Atendente</option><option value="medico" ${u?.perfil === "medico" ? "selected" : ""}>Médico</option><option value="admin" ${u?.perfil === "admin" ? "selected" : ""}>Administrador</option></select></div><div class="field"><label for="x-m">Matrícula</label><input id="x-m" value="${esc(u?.matricula || "")}"></div><div class="field full"><label for="x-n">Nome completo</label><input id="x-n" value="${esc(u?.nome || "")}"></div><div class="field"><label for="x-s">${u ? "Nova senha (opcional)" : "Senha temporária"}</label><input id="x-s" type="password" autocomplete="new-password"></div><div class="field" id="x-crm-box"><label for="x-crm">CRM</label><input id="x-crm" value="${esc(u?.crm || "")}" placeholder="CRM-PE 00000"></div></div><span class="label">Unidades de atuação</span><div class="stack sm" style="margin:6px 0 10px">${DB.get("unidades").map((x) => `<label class="check"><input type="checkbox" data-un="${x.id}" ${u?.unidades?.includes(x.id) ? "checked" : ""}> ${esc(x.nome)}</label>`).join("")}</div><div id="x-esp-box"><span class="label">Especialidades</span><div class="stack sm" style="margin:6px 0 10px">${espLista().map((e) => `<label class="check"><input type="checkbox" data-es="${e.id}" ${u?.especialidades?.includes(e.id) ? "checked" : ""}> ${esc(e.nome)}</label>`).join("")}</div></div><label class="check"><input type="checkbox" id="x-a" ${u?.ativo === false ? "" : "checked"}> Usuário ativo</label>`,
    aoAbrir: (ov) => { const f = () => { const med = $("#x-p", ov).value === "medico"; $("#x-crm-box", ov).hidden = !med; $("#x-esp-box", ov).hidden = !med; }; $("#x-p", ov).addEventListener("change", f); f(); },
    botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Salvar Usuário", aoClicar: () => { const perfil = $("#x-p").value, mat = $("#x-m").value.trim(), nome = $("#x-n").value.trim(), sn = $("#x-s").value; if (!nome || !mat) { toast("Preencha nome e matrícula.", "err"); return false; } if (DB.get("usuarios").some((x) => x.matricula === mat && x.id !== u?.id)) { toast("Já existe um usuário com esta matrícula.", "err"); return false; } if (!u && sn.length < 6) { toast("A senha temporária precisa de ao menos 6 caracteres.", "err"); return false; } const d = { perfil, nome, matricula: mat, unidades: $$("[data-un]").filter((x) => x.checked).map((x) => x.dataset.un), ativo: $("#x-a").checked, ...(sn ? { senha: sn } : {}) }; if (perfil === "medico") { d.crm = $("#x-crm").value.trim(); d.especialidades = $$("[data-es]").filter((x) => x.checked).map((x) => x.dataset.es); if (!d.especialidades.length || !d.unidades.length) { toast("Escolha ao menos uma especialidade e uma unidade.", "err"); return false; } } if (u) DB.upd("usuarios", u.id, d); else DB.add("usuarios", { id: "x" + uid(), disp: [], tele: false, nota: 5, bio: "", ...d }); audit(u ? "Editou usuário" : "Criou usuário", `${nome} (${PERFIL_NOME[perfil]})`); setTimeout(desenhar, 0); } }] });
  raizPag().innerHTML = `<div class="page-head"><h1>Usuários e Permissões</h1><button class="btn" id="novo" type="button">${ico("plus")} Novo Usuário</button></div><div class="tabs" id="abas"><button class="tab-btn active" data-tab="p-u" type="button">Usuários</button><button class="tab-btn" data-tab="p-m" type="button">Matriz de permissões</button></div><div class="tab-panel active" id="p-u"><div class="table-wrap" id="tab"></div></div><div class="tab-panel" id="p-m"><div class="table-wrap"><table><thead><tr><th>Ação</th><th>Paciente</th><th>Atendente</th><th>Médico</th><th>Admin</th></tr></thead><tbody>${MATRIZ.map((l) => `<tr><td>${l[0]}</td>${l.slice(1).map((v) => `<td>${typeof v === "string" ? esc(v) : v ? '<span class="badge ok">Sim</span>' : '<span class="badge mute">Não</span>'}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="hint" style="margin-top:8px">As permissões vêm do perfil e são aplicadas pelas telas. No back-end, cada rota da API deve repetir essas regras.</p></div>`;
  ligarAbas(raizPag()); $("#novo").addEventListener("click", () => form()); desenhar();
}

// ---------- AD05 / AD06 Especialidades, serviços, planos ----------
function adminServicos() {
  const desenhar = () => {
    $("#p-e").innerHTML = `<div class="row between"><h2>Especialidades e consultas</h2><button class="btn outline sm" id="n-e" type="button">${ico("plus")} Nova</button></div><div class="table-wrap"><table><thead><tr><th>Especialidade</th><th>Valor</th><th>Duração</th><th></th></tr></thead><tbody>${espLista().map((e) => `<tr><td>${esc(e.nome)}</td><td>${brl(e.valor)}</td><td>${e.duracao} min</td><td><button class="btn outline sm" data-e="${e.id}" type="button">Editar</button></td></tr>`).join("")}</tbody></table></div>`;
    $("#p-x").innerHTML = `<div class="row between"><h2>Exames</h2><button class="btn outline sm" id="n-x" type="button">${ico("plus")} Novo</button></div><div class="table-wrap"><table><thead><tr><th>Exame</th><th>Valor</th><th>Preparo</th><th></th></tr></thead><tbody>${DB.get("exames", EXAMES_PADRAO).map((e) => `<tr><td>${esc(e.nome)}</td><td>${brl(e.valor)}</td><td>${esc(e.preparo)}</td><td><button class="btn outline sm" data-x="${e.id}" type="button">Editar</button></td></tr>`).join("")}</tbody></table></div>`;
    $("#p-p").innerHTML = `<div class="row between"><h2>Planos e coparticipação</h2><button class="btn outline sm" id="n-p" type="button">${ico("plus")} Novo</button></div><div class="table-wrap"><table><thead><tr><th>Plano</th><th>Mensalidade</th><th>Coparticipação</th><th>Cobertura</th><th></th></tr></thead><tbody>${Object.entries(PLANOS).map(([k, p]) => `<tr><td>${esc(p.nome)}</td><td>${brl(p.valor)}</td><td>${p.copart}%</td><td>${esc(p.desc)}</td><td><button class="btn outline sm" data-p="${k}" type="button">Editar</button></td></tr>`).join("")}</tbody></table></div><p class="hint">Coparticipação é a parte do valor do atendimento que o paciente paga.</p>`;
    $$("[data-e]").forEach((b) => b.addEventListener("click", () => fe(espLista().find((x) => x.id === b.dataset.e)))); $("#n-e").addEventListener("click", () => fe());
    $$("[data-x]").forEach((b) => b.addEventListener("click", () => fx(DB.get("exames", EXAMES_PADRAO).find((x) => x.id === b.dataset.x)))); $("#n-x").addEventListener("click", () => fx());
    $$("[data-p]").forEach((b) => b.addEventListener("click", () => fp(b.dataset.p))); $("#n-p").addEventListener("click", () => fp());
  };
  const salvarLista = (nome, lista, item, antigo) => { const l = lista.slice(); const i = antigo ? l.findIndex((x) => x.id === antigo.id) : -1; if (i >= 0) l[i] = { ...antigo, ...item }; else l.push({ id: slug(item.nome), ...item }); DB.set(nome, l); };
  const fe = (e) => abrirModal({ titulo: e ? "Editar Especialidade" : "Nova Especialidade", corpo: `<div class="field"><label for="e-n">Nome</label><input id="e-n" value="${esc(e?.nome || "")}"></div><div class="form-grid"><div class="field"><label for="e-v">Valor da consulta (R$)</label><input id="e-v" type="number" step="0.01" min="0" value="${e?.valor ?? 200}"></div><div class="field"><label for="e-d">Duração (minutos)</label><input id="e-d" type="number" min="10" step="5" value="${e?.duracao ?? 30}"></div></div>`, botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Salvar", aoClicar: () => { const nome = $("#e-n").value.trim(); if (!nome) { toast("Informe o nome.", "err"); return false; } salvarLista("especialidades", espLista(), { nome, valor: +$("#e-v").value || 0, duracao: +$("#e-d").value || 30 }, e); audit("Alterou especialidade/valor", nome); setTimeout(desenhar, 0); } }] });
  const fx = (e) => abrirModal({ titulo: e ? "Editar Exame" : "Novo Exame", corpo: `<div class="field"><label for="x-n">Nome</label><input id="x-n" value="${esc(e?.nome || "")}"></div><div class="field"><label for="x-v">Valor (R$)</label><input id="x-v" type="number" step="0.01" min="0" value="${e?.valor ?? 50}"></div><div class="field"><label for="x-p">Preparo exigido</label><input id="x-p" value="${esc(e?.preparo || "Sem preparo.")}"></div>`, botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Salvar", aoClicar: () => { const nome = $("#x-n").value.trim(); if (!nome) { toast("Informe o nome.", "err"); return false; } salvarLista("exames", DB.get("exames", EXAMES_PADRAO), { nome, valor: +$("#x-v").value || 0, preparo: $("#x-p").value.trim() }, e); audit("Alterou exame/valor", nome); setTimeout(desenhar, 0); } }] });
  const fp = (k) => { const p = k ? PLANOS[k] : null; abrirModal({ titulo: p ? "Editar Plano" : "Novo Plano", corpo: `<div class="field"><label for="p-n">Nome</label><input id="p-n" value="${esc(p?.nome || "")}"></div><div class="form-grid"><div class="field"><label for="p-v">Mensalidade (R$)</label><input id="p-v" type="number" step="0.01" min="0" value="${p?.valor ?? 100}"></div><div class="field"><label for="p-c">Coparticipação (%)</label><input id="p-c" type="number" min="0" max="100" value="${p?.copart ?? 30}"></div></div><div class="field"><label for="p-d">Cobertura</label><input id="p-d" value="${esc(p?.desc || "")}"></div>`, botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Salvar", aoClicar: () => { const nome = $("#p-n").value.trim(); if (!nome) { toast("Informe o nome.", "err"); return false; } const novo = { nome, valor: +$("#p-v").value || 0, copart: Math.min(100, Math.max(0, +$("#p-c").value || 0)), desc: $("#p-d").value.trim() }; PLANOS = { ...PLANOS, [k || slug(nome)]: novo }; DB.set("planos", PLANOS); audit("Alterou plano", nome); setTimeout(desenhar, 0); } }] }); };
  raizPag().innerHTML = `<div class="page-head"><h1>Serviços, Valores e Planos</h1></div><div class="tabs" id="abas"><button class="tab-btn active" data-tab="p-e" type="button">Especialidades</button><button class="tab-btn" data-tab="p-x" type="button">Exames</button><button class="tab-btn" data-tab="p-p" type="button">Planos</button></div><div class="tab-panel active" id="p-e"></div><div class="tab-panel" id="p-x"></div><div class="tab-panel" id="p-p"></div>`;
  ligarAbas(raizPag()); desenhar();
}

// ---------- AD07 / AD08 Financeiro e relatórios ----------
function adminFinanceiro() {
  const desenhar = (per) => {
    const ini = inicioPeriodo(per), pags = DB.get("pagamentos").filter((p) => p.data >= ini), repasse = cfg().repassePct ?? 60;
    const por = (k) => pags.reduce((o, p) => ((o[p[k] || "—"] = (o[p[k] || "—"] || 0) + p.valor), o), {});
    const inad = DB.get("clientes").map((c) => ({ c, p: pendencias(c) })).filter((x) => x.p.length);
    const meds = medicosAtivos().map((m) => { const fin = DB.get("consultas").filter((c) => c.medicoId === m.id && c.status === "finalizada" && c.pago && c.data >= ini); const base = fin.reduce((s, c) => s + c.valor, 0); return { m, n: fin.length, base, rep: base * repasse / 100 }; });
    $("#fin").innerHTML = `<div class="stats"><div class="stat"><b>${brl(pags.reduce((s, p) => s + p.valor, 0))}</b><span>Recebido no período</span></div><div class="stat"><b>${pags.length}</b><span>Pagamentos</span></div><div class="stat"><b>${brl(inad.reduce((s, x) => s + x.p.reduce((a, p) => a + p.valor, 0), 0))}</b><span>Em aberto (inadimplência)</span></div><div class="stat"><b>${inad.length}</b><span>Pacientes com pendência</span></div></div>
    <div class="grid g2"><div class="card"><h2>Recebido por forma de pagamento</h2>${Object.entries(por("metodo")).map(([k, v]) => barra(k, v, Math.max(...Object.values(por("metodo"))), brl(v))).join("") || '<p class="muted">Sem pagamentos.</p>'}</div><div class="card"><h2>Recebido por tipo</h2>${Object.entries(por("tipo")).map(([k, v]) => barra(k === "mensalidade" ? "Mensalidades" : "Atendimentos", v, Math.max(...Object.values(por("tipo"))), brl(v))).join("") || '<p class="muted">Sem pagamentos.</p>'}</div></div>
    <h2 class="sec-title">Repasse médico (${repasse}% do valor recebido)</h2><div class="table-wrap"><table><thead><tr><th>Médico</th><th>Consultas pagas</th><th>Base</th><th>Repasse</th></tr></thead><tbody>${meds.map((x) => `<tr><td>${esc(x.m.nome)}</td><td>${x.n}</td><td>${brl(x.base)}</td><td><b>${brl(x.rep)}</b></td></tr>`).join("")}</tbody></table></div>
    <h2 class="sec-title">Inadimplência</h2><div class="table-wrap"><table><thead><tr><th>Paciente</th><th>Pendências</th><th>Valor</th></tr></thead><tbody>${inad.map((x) => `<tr><td>${esc(x.c.nome)}</td><td>${x.p.map((p) => esc(p.descricao)).join("; ")}</td><td>${brl(x.p.reduce((a, p) => a + p.valor, 0))}</td></tr>`).join("") || '<tr><td colspan="3">Nenhuma pendência.</td></tr>'}</tbody></table></div>`;
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Financeiro e Relatórios</h1>${seletorPeriodo("todo")}</div><div id="fin"></div><h2 class="sec-title">Exportar relatórios</h2><div class="row"><button class="btn outline" id="x-pag" type="button">${ico("download")} Pagamentos (CSV)</button><button class="btn outline" id="x-con" type="button">${ico("download")} Consultas (CSV)</button><button class="btn outline" id="x-cli" type="button">${ico("download")} Pacientes (CSV)</button><button class="btn outline" id="x-pdf" type="button">${ico("print")} Resumo em PDF</button></div><p class="hint" style="margin-top:8px">Os arquivos CSV abrem direto no Excel.</p>`;
  $("#per").addEventListener("change", (e) => desenhar(e.target.value)); desenhar("todo");
  $("#x-pag").addEventListener("click", () => { baixarCSV("pagamentos.csv", [["Data", "Paciente", "Descrição", "Tipo", "Forma", "Valor", "Unidade"], ...DB.get("pagamentos").map((p) => [fmtData(p.data), DB.find("clientes", p.clienteId)?.nome, p.descricao, p.tipo, p.metodo, String(p.valor).replace(".", ","), p.unidadeId ? nomeUnidade(p.unidadeId) : ""])]); audit("Exportou relatório", "pagamentos"); });
  $("#x-con").addEventListener("click", () => { baixarCSV("consultas.csv", [["Data", "Hora", "Paciente", "Atendimento", "Médico", "Unidade", "Status", "Valor", "Pago"], ...DB.get("consultas").map((c) => [fmtData(c.data), c.horario, c.paciente, nomeServico(c), nomeMedico(c), nomeUnidade(c.unidadeId), STATUS[c.status]?.[0], String(c.valor ?? "").replace(".", ","), c.pago ? "Sim" : "Não"])]); audit("Exportou relatório", "consultas"); });
  $("#x-cli").addEventListener("click", () => { baixarCSV("pacientes.csv", [["Nome", "CPF", "Telefone", "E-mail", "Cidade", "Plano"], ...DB.get("clientes").map((c) => [c.nome, fmtCPF(c.cpf), c.telefone, c.email, c.cidade, (PLANOS[c.plano] || {}).nome || "Particular"])]); audit("Exportou relatório", "pacientes"); });
  $("#x-pdf").addEventListener("click", () => { imprimirDoc("Resumo Financeiro CaisMed", `<h1>Resumo Financeiro</h1><p class="m">Gerado em ${fmtData(hojeISO())}</p>${$("#fin").innerHTML}`); audit("Exportou relatório", "resumo pdf"); });
}

// ---------- AD10 Auditoria ----------
function adminAuditoria() {
  const desenhar = () => {
    const p = $("#fp").value, q = $("#fq").value.toLowerCase();
    const l = DB.get("auditoria").filter((a) => (!p || a.perfil === p) && (!q || `${a.quem} ${a.acao} ${a.alvo}`.toLowerCase().includes(q))).sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 300);
    $("#tab").innerHTML = `<table><thead><tr><th>Quando</th><th>Quem</th><th>Perfil</th><th>Ação</th><th>Alvo</th></tr></thead><tbody>${l.map((a) => `<tr><td>${fmtHora(a.quando)}</td><td>${esc(a.quem)}</td><td>${esc(PERFIL_NOME[a.perfil] || a.perfil)}</td><td>${esc(a.acao)}</td><td>${esc(a.alvo)}</td></tr>`).join("") || '<tr><td colspan="5">Nenhum registro.</td></tr>'}</tbody></table>`;
    return l;
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Auditoria</h1><button class="btn outline" id="csv" type="button">${ico("download")} Exportar CSV</button></div><div class="card stack" style="margin-bottom:16px"><h2>Consultar prontuário</h2><p class="muted">O acesso exige justificativa e fica registrado abaixo.</p><div class="row" style="flex-wrap:nowrap"><input id="bp" type="search" placeholder="Nome ou CPF do paciente" aria-label="Buscar paciente"></div><div id="bp-res" class="stack"></div></div><div class="row" style="margin-bottom:12px"><select id="fp" style="width:auto" aria-label="Filtrar por perfil"><option value="">Todos os perfis</option>${Object.entries(PERFIL_NOME).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><input id="fq" type="search" placeholder="Buscar na auditoria" style="flex:1 1 220px" aria-label="Buscar"></div><div class="table-wrap" id="tab"></div>`;
  $("#fp").addEventListener("change", desenhar); $("#fq").addEventListener("input", desenhar); desenhar();
  $("#bp").addEventListener("input", (e) => { const t = e.target.value.toLowerCase(), d = soDigitos(t); $("#bp-res").innerHTML = t.length < 3 ? "" : DB.get("clientes").filter((c) => c.nome.toLowerCase().includes(t) || (d.length >= 3 && c.cpf.includes(d))).slice(0, 5).map((c) => `<a class="item" href="prontuario.html?paciente=${c.id}"><span class="grow"><b>${esc(c.nome)}</b><small>CPF ${fmtCPF(c.cpf)}</small></span>${ico("right")}</a>`).join(""); });
  $("#csv").addEventListener("click", () => baixarCSV("auditoria.csv", [["Quando", "Quem", "Perfil", "Ação", "Alvo"], ...desenhar().map((a) => [fmtHora(a.quando), a.quem, a.perfil, a.acao, a.alvo])]));
}

// ---------- G09 Ouvidoria (lado administrativo) ----------
function adminOuvidoria() {
  const desenhar = () => {
    const l = DB.get("ouvidoria").sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    $("#lista").innerHTML = l.length ? l.map((o) => `<div class="card stack sm"><div class="row between"><b>${esc(o.assunto)}</b><span class="badge ${o.status === "nova" ? "warn" : "ok"}">${o.status === "nova" ? "Nova" : "Respondida"}</span></div><p class="muted">${esc(o.tipo)}, de ${esc(o.nome)} (${esc(o.email || "sem e-mail")}), ${fmtHora(o.criadoEm)}</p><p>${esc(o.mensagem)}</p>${o.resposta ? `<div class="card pale"><b>Resposta:</b> ${esc(o.resposta)}</div>` : `<button class="btn sm" data-r="${o.id}" type="button">Responder</button>`}</div>`).join("") : vazio("Nenhuma Mensagem", "As mensagens enviadas em Ajuda e Ouvidoria aparecem aqui.");
    $$("[data-r]").forEach((b) => b.addEventListener("click", () => abrirModal({ titulo: "Responder Mensagem", corpo: `<div class="field"><label for="rp">Resposta</label><textarea id="rp"></textarea></div>`, botoes: [{ rotulo: "Cancelar", classe: "outline" }, { rotulo: "Enviar Resposta", aoClicar: () => { const t = $("#rp").value.trim(); if (!t) { toast("Escreva a resposta.", "err"); return false; } const o = DB.upd("ouvidoria", b.dataset.r, { status: "respondida", resposta: t, respondidaEm: new Date().toISOString() }); if (o.clienteId) notificar("cliente:" + o.clienteId, "Resposta da Ouvidoria", t.slice(0, 120), "ajuda.html"); audit("Respondeu ouvidoria", o.assunto); setTimeout(desenhar, 0); } }] })));
  };
  raizPag().innerHTML = `<div class="page-head"><h1>Ouvidoria</h1></div><div class="grid g2" id="lista"></div>`; desenhar();
}

// ---------- AD09 Configurações ----------
function adminConfig() {
  const c = cfg();
  raizPag().innerHTML = `<div class="page-head"><h1>Configurações</h1></div><div class="two-col"><form class="card" id="f"><div class="form-grid"><div class="field"><label for="c-c">Cancelar ou remarcar até (horas antes)</label><input id="c-c" type="number" min="0" value="${c.cancelarAteHoras}"></div><div class="field"><label for="c-l">Lembrete automático (horas antes)</label><input id="c-l" type="number" min="1" value="${c.lembreteHoras}"></div><div class="field"><label for="c-r">Repasse médico (%)</label><input id="c-r" type="number" min="0" max="100" value="${c.repassePct ?? 60}"></div></div><div class="field"><label for="c-m">Mensagem de confirmação</label><textarea id="c-m">${esc(c.msgConfirmacao)}</textarea></div><label class="check"><input type="checkbox" id="c-2" ${c.doisPassos ? "checked" : ""}> Exigir verificação em 2 etapas no login da equipe</label><div class="actions"><button class="btn" type="submit">Salvar Configurações</button></div></form>
  <div class="card stack"><h2>Dados de demonstração</h2><p class="muted">Apaga tudo o que foi cadastrado neste navegador e volta aos dados iniciais.</p><button class="btn danger outline" id="reset" type="button">${ico("trash")} Restaurar Dados de Demonstração</button><p class="hint">A identidade visual (cores e logo) fica no arquivo style.css.</p></div></div>`;
  $("#f").addEventListener("submit", (e) => { e.preventDefault(); DB.set("config", { ...c, cancelarAteHoras: +$("#c-c").value || 0, lembreteHoras: +$("#c-l").value || 24, repassePct: +$("#c-r").value || 0, msgConfirmacao: $("#c-m").value.trim(), doisPassos: $("#c-2").checked }); audit("Alterou configurações"); toast("Configurações salvas.", "ok"); });
  $("#reset").addEventListener("click", async () => { if (await confirmar("Apagar todos os dados e voltar ao estado inicial?", { perigo: true, ok: "Restaurar" })) { localStorage.clear(); sessionStorage.clear(); location.href = "login.html"; } });
}

ready(() => {
  ({ "admin-painel": adminPainel, "admin-unidades": adminUnidades, "admin-usuarios": adminUsuarios, "admin-servicos": adminServicos, "admin-financeiro": adminFinanceiro, "admin-auditoria": adminAuditoria, "admin-ouvidoria": adminOuvidoria, "admin-config": adminConfig })[document.body.dataset.pagina]?.();
});


/* ======================= publico.js ======================= */
"use strict";
/* Telas públicas: G01 landing, G02 busca, G03 login, G05 recuperar senha, G10 estados */

const cartaoUnidade = (u) => `<article class="card stack sm"><div class="row between"><h3>${esc(u.nome)}</h3>${u.ativa === false ? '<span class="badge mute">Inativa</span>' : ""}</div>
  <p>${esc(u.endereco)}, ${esc(u.bairro)}, ${esc(u.cidade)}</p><p class="muted">${esc(u.horario)}</p><p class="muted">${esc(u.fone)}</p>
  <div class="chips" style="margin-top:6px">${(u.especialidades || []).map((e) => `<span class="badge info">${esc(espNome(e))}</span>`).join("")}</div>
  <div class="actions" style="margin-top:10px"><a class="btn outline sm" href="${mapaURL(u)}" target="_blank" rel="noopener">${ico("pin")} Como Chegar</a></div></article>`;
const cartaoMedico = (m, p) => `<article class="doc-card" style="cursor:default"><span class="avatar lg">${esc(iniciais(m.nome))}</span><div class="grow"><b>${esc(m.nome)}</b><small>${esc((m.especialidades || []).map(espNome).join(", "))} · ${esc(m.crm || "")}</small>
  <small class="rating">★ ${(m.nota || 5).toFixed(1)}</small>${m.tele ? '<span class="badge info">Faz Teleconsulta</span>' : ""}
  <small>${p ? `Próximo horário: <b>${rotuloDia(p.data)} às ${p.h}</b>, ${esc(nomeUnidade(p.unidadeId))}` : "Sem horários nos próximos dias"}</small></div>
  <a class="btn sm" href="agendamento.html?especialidade=${(m.especialidades || [])[0]}&medico=${m.id}">Agendar</a></article>`;

function landing() {
  const un = DB.get("unidades").filter((u) => u.ativa !== false);
  $("#numeros").style.gridTemplateColumns = "repeat(3,1fr)";
  $("#numeros").innerHTML = `<div class="stat"><b>${un.length}</b><span>Unidades</span></div><div class="stat"><b>${medicosAtivos().length}</b><span>Médicos</span></div><div class="stat"><b>${espLista().length}</b><span>Especialidades</span></div>`;
  $("#esp-grid").innerHTML = espLista().map((e) => `<div class="esp"><b>${esc(e.nome)}</b><small>${medicosAtivos().filter((m) => m.especialidades.includes(e.id)).length} médico(s)</small></div>`).join("");
  $("#unidades-lista").innerHTML = un.map(cartaoUnidade).join("");
}

function buscar() {
  const q = new URLSearchParams(location.search);
  const fe = $("#b-esp"), fc = $("#b-cidade"), ft = $("#b-texto"), fm = $("#b-tele");
  fe.innerHTML = `<option value="">Todas as Especialidades</option>` + espLista().map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join("");
  const cidades = [...new Set(DB.get("unidades").map((u) => u.cidade))];
  fc.innerHTML = `<option value="">Todas as Cidades</option>` + cidades.map((c) => `<option>${esc(c)}</option>`).join("");
  fe.value = q.get("especialidade") || "";
  const desenhar = () => {
    const t = ft.value.trim().toLowerCase();
    const un = DB.get("unidades").filter((u) => u.ativa !== false && (!fc.value || u.cidade === fc.value) && (!fe.value || u.especialidades.includes(fe.value)) && (!t || `${u.nome} ${u.bairro} ${u.cidade}`.toLowerCase().includes(t) || u.especialidades.some((e) => espNome(e).toLowerCase().includes(t))));
    const ids = new Set(un.map((u) => u.id));
    const md = medicosAtivos().filter((m) => (!fe.value || m.especialidades.includes(fe.value)) && (!fm.checked || m.tele) && (!fc.value || m.unidades.some((x) => ids.has(x))) && (!t || `${m.nome} ${m.especialidades.map(espNome).join(" ")}`.toLowerCase().includes(t) || m.unidades.some((x) => nomeUnidade(x).toLowerCase().includes(t))));
    $("#b-med").innerHTML = md.length ? md.map((m) => cartaoMedico(m, proximoLivre(m))).join("") : vazio("Nenhum Médico Encontrado", "Tente tirar algum filtro ou buscar por outro nome.");
    $("#b-uni").innerHTML = un.length ? un.map(cartaoUnidade).join("") : vazio("Nenhuma Unidade Encontrada", "Tente outra cidade ou especialidade.");
    $("#b-total").textContent = `${md.length} médico(s) e ${un.length} unidade(s)`;
  };
  [fe, fc, fm].forEach((e) => e.addEventListener("change", desenhar)); ft.addEventListener("input", desenhar); desenhar();
}

function login() {
  const q = new URLSearchParams(location.search);
  if (q.get("expirada")) $("#aviso-sessao").hidden = false;
  const abas = $$("#abas-perfil button"); let perfil = q.get("perfil") || "cliente";
  const f = $("#login-form"), erro = $("#erro-login");
  const trocar = (p) => {
    perfil = p; erro.hidden = true;
    abas.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.perfil === p)));
    $("#campo-cpf").hidden = p !== "cliente"; $("#campo-mat").hidden = p === "cliente";
    $("#cpf").required = p === "cliente"; $("#matricula").required = p !== "cliente";
    $("#mais-cliente").hidden = p !== "cliente"; $("#demo-box").hidden = p === "cliente";
    $("#titulo-login").textContent = p === "cliente" ? "Acesse Sua Conta" : `Área ${p === "medico" ? "do Médico" : p === "admin" ? "do Administrador" : "do Atendente"}`;
  };
  abas.forEach((b) => b.addEventListener("click", () => trocar(b.dataset.perfil)));
  trocar(["cliente", "atendente", "medico", "admin"].includes(perfil) ? perfil : "cliente");
  $("#ver-senha").addEventListener("click", () => { const s = $("#senha"); const mostrar = s.type === "password"; s.type = mostrar ? "text" : "password"; $("#ver-senha").setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha"); });
  const falha = (msg) => { erro.textContent = msg; erro.hidden = false; erro.scrollIntoView({ block: "center", behavior: "smooth" }); toast(msg, "err"); };
  $("#btn-demo").addEventListener("click", () => { garantirDemo(); const d = { cliente: ["390.533.447-05", "123456"], atendente: ["1001", "caismed123"], medico: ["2001", "caismed123"], admin: ["9001", "caismed123"] }[perfil]; if (perfil === "cliente") $("#cpf").value = d[0]; else $("#matricula").value = d[0]; $("#senha").value = d[1]; f.requestSubmit(); });
  const destino = (p) => { const v = q.get("volta"); return v && /^[a-z0-9-]+\.html(\?.*)?$/i.test(v) && p === "cliente" ? v : HOME[p]; };
  const concluir = (id) => { Sessao.entrar(perfil, id); audit("Entrou no sistema"); location.href = destino(perfil); };
  f.addEventListener("submit", (e) => {
    e.preventDefault(); erro.hidden = true;
    const senha = $("#senha").value;
    if (perfil === "cliente") {
      // TODO: trocar por POST /auth/login (back-end)
      const cpf = soDigitos($("#cpf").value);
      if (!cpfValido(cpf)) return falha("CPF inválido. Confira os 11 números.");
      const c = DB.get("clientes").find((x) => x.cpf === cpf);
      if (!c) return falha("CPF não encontrado. Procure a recepção da clínica para fazer seu cadastro.");
      if (!c.senha) return falha("Você ainda não criou sua senha. Use o Primeiro Acesso.");
      if (c.senha !== senha) return falha("CPF ou senha incorretos.");
      return concluir(c.id);
    }
    // TODO: trocar por POST /auth/profissional/login (back-end)
    const u = DB.get("usuarios").find((x) => x.perfil === perfil && x.matricula === $("#matricula").value.trim() && x.ativo !== false);
    if (!u || u.senha !== senha) return falha("Matrícula ou senha incorretas.");
    if (cfg().doisPassos) {
      abrirModal({ titulo: "Verificação em 2 Etapas", corpo: `<p class="muted">Digite o código de 6 dígitos enviado ao seu e-mail. Na demonstração, o código é <b>123456</b>.</p><div class="field" style="margin-top:12px"><label for="cod">Código</label><input id="cod" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><p class="err-msg" id="cod-erro" hidden>Código incorreto.</p>`,
        botoes: [{ rotulo: "Confirmar", aoClicar: () => { if ($("#cod").value !== "123456") { $("#cod-erro").hidden = false; return false; } concluir(u.id); } }] });
      return;
    }
    concluir(u.id);
  });
}

function primeiroAcesso() {
  const f = $("#primeiro-acesso-form"), erro = $("#erro-pa");
  f.addEventListener("submit", (e) => {
    e.preventDefault(); erro.hidden = true;
    const falha = (m) => { erro.textContent = m; erro.hidden = false; };
    if (!formularioValido(f)) return;
    // TODO: trocar por POST /auth/primeiro-acesso (back-end)
    const cpf = soDigitos($("#cpf").value), senha = $("#senha").value;
    if (senha !== $("#senha2").value) return falha("As senhas não são iguais.");
    const todos = DB.get("clientes"), cli = todos.find((c) => c.cpf === cpf);
    if (!cli) return falha("CPF não encontrado. Procure a recepção da clínica para fazer seu cadastro.");
    if (cli.senha) return falha("Este CPF já tem senha. Volte e faça o login.");
    if (!$("#aceite").checked) return falha("Aceite os termos e o tratamento de dados (LGPD) para continuar.");
    cli.senha = senha; cli.consentimentos = { termos: true, lgpd: true, notificacoes: true, marketing: $("#marketing").checked, aceitoEm: new Date().toISOString() };
    DB.set("clientes", todos);
    Sessao.entrar("cliente", cli.id); audit("Criou a senha (primeiro acesso)");
    notificar("cliente:" + cli.id, "Conta Ativada", "Sua senha foi criada. Já pode agendar consultas e ver sua carteirinha.", "home.html");
    toast("Senha criada com sucesso!", "ok");
    setTimeout(() => (location.href = "home.html"), 700);
  });
}

function recuperar() {
  $("#recuperar-form").addEventListener("submit", (e) => {
    e.preventDefault(); if (!formularioValido(e.target)) return;
    // TODO: POST /auth/recuperar-senha (back-end envia o e-mail)
    audit("Pediu redefinição de senha", soDigitos($("#cpf-recuperar").value));
    location.href = "confirmacao.html";
  });
}

const ESTADOS = {
  vazio: ["list", "Nada por Aqui Ainda", "Quando houver informações, elas aparecem nesta tela.", "Voltar ao Início"],
  erro: ["alert", "Algo Deu Errado", "Não foi possível carregar esta tela. Tente de novo em alguns instantes.", "Tentar Novamente"],
  "sem-permissao": ["lock", "Sem Permissão", "Seu perfil não tem acesso a esta tela. Se precisar, fale com o administrador da clínica.", "Ir para Minha Área"],
  manutencao: ["wrench", "Em Manutenção", "Estamos melhorando o sistema. Volte em alguns minutos.", "Voltar ao Início"],
  "sessao-expirada": ["clock", "Sessão Expirada", "Por segurança, você precisa entrar de novo.", "Entrar Novamente"],
  "404": ["search", "Página Não Encontrada", "O endereço que você abriu não existe ou foi movido.", "Voltar ao Início"],
};
function estado() {
  const t = new URLSearchParams(location.search).get("tipo");
  const [ic, titulo, texto, rot] = ESTADOS[t] || ESTADOS["404"];
  const destino = t === "sem-permissao" && Sessao.perfil ? HOME[Sessao.perfil] : t === "sessao-expirada" ? "login.html" : t === "erro" ? "javascript:location.reload()" : "index.html";
  $("#estado").innerHTML = `<div class="state-box"><span class="big">${ico(ic)}</span><h1>${titulo}</h1><p class="lead">${texto}</p><a class="btn" href="${destino}">${rot}</a></div>`;
}

ready(() => {
  const p = document.body.dataset.pagina;
  ({ landing, buscar, login, "primeiro-acesso": primeiroAcesso, recuperar, estado })[p]?.();
});
