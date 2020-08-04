const BIG_ENDIAN = false;
const LITTLE_ENDIAN = true;

export const mimeTypeMap = new Map([
  ['image/png', {test: isPng, getSize: getPngSize}],
  ['image/jpeg', {test: isJpeg, getSize: getJpegSize}],
  ['image/gif', {test: isGif, getSize: getGifSize}],
  ['image/bmp', {test: isBmp, getSize: getBmpSize}]
]);

// PNG

function isPng(dataView) {
  // Check file contains the first 4 bytes of the PNG signature.
  return dataView.byteLength >= 24 && dataView.getUint32(0, BIG_ENDIAN) === 0x89504e47;
}

function getPngSize(dataView) {
  // Extract size from a binary PNG file
  return {
    width: dataView.getUint32(16, BIG_ENDIAN),
    height: dataView.getUint32(20, BIG_ENDIAN)
  };
}

// GIF

function isGif(dataView) {
  // Check first 4 bytes of the GIF signature ("GIF8").
  return dataView.byteLength >= 10 && dataView.getUint32(0, BIG_ENDIAN) === 0x47494638;
}

// Extract size from a binary GIF file
// TODO: GIF is not this simple
function getGifSize(dataView) {
  // GIF is little endian.
  return {
    width: dataView.getUint16(6, LITTLE_ENDIAN),
    height: dataView.getUint16(8, LITTLE_ENDIAN)
  };
}

// BMP

// TODO: BMP is not this simple
function isBmp(dataView) {
  // Check magic number is valid (first 2 characters should be "BM").
  // The mandatory bitmap file header is 14 bytes long.
  return (
    dataView.byteLength >= 14 &&
    dataView.getUint16(0, BIG_ENDIAN) === 0x424d &&
    dataView.getUint32(2, LITTLE_ENDIAN) === dataView.byteLength
  );
}

function getBmpSize(dataView) {
  // BMP is little endian.
  return {
    width: dataView.getUint32(18, LITTLE_ENDIAN),
    height: dataView.getUint32(22, LITTLE_ENDIAN)
  };
}

// JPEG

function isJpeg(dataView) {
  // Check file contains the JPEG "start of image" (SOI) marker
  // followed by another marker.
  return (
    dataView.byteLength >= 3 &&
    dataView.getUint16(0, BIG_ENDIAN) === 0xffd8 &&
    dataView.getUint8(2, BIG_ENDIAN) === 0xff &&
    dataView.getUint16(dataView.byteLength - 2, BIG_ENDIAN) === 0xffd9
  );
}

// Extract width and height from a binary JPEG file
function getJpegSize(dataView) {
  // Check file contains the JPEG "start of image" (SOI) marker.
  if (dataView.byteLength < 2 || dataView.getUint16(0, BIG_ENDIAN) !== 0xffd8) {
    return null;
  }

  const {tableMarkers, sofMarkers} = getJpegMarkers();

  // Exclude the two byte SOI marker.
  let i = 2;
  while (i < dataView.byteLength) {
    const marker = dataView.getUint16(i, BIG_ENDIAN);

    // The frame that contains the width and height of the JPEG image.
    if (sofMarkers.has(marker)) {
      return {
        height: dataView.getUint16(i + 5, BIG_ENDIAN), // Number of lines
        width: dataView.getUint16(i + 7, BIG_ENDIAN) // Number of pixels per line
      };
    }

    // Miscellaneous tables/data preceding the frame header.
    if (!tableMarkers.has(marker)) {
      return null;
    }

    // Length includes size of length parameter but not the two byte header.
    i += 2;
    i += dataView.getUint16(i, BIG_ENDIAN);
  }

  return null;
}

function getJpegMarkers() {
  // Tables/misc header markers.
  // DQT, DHT, DAC, DRI, COM, APP_n
  const tableMarkers = new Set([0xffdb, 0xffc4, 0xffcc, 0xffdd, 0xfffe]);
  for (let i = 0xffe0; i < 0xfff0; ++i) {
    tableMarkers.add(i);
  }

  // SOF markers and DHP marker.
  // These markers are after tables/misc data.
  const sofMarkers = new Set([
    0xffc0,
    0xffc1,
    0xffc2,
    0xffc3,
    0xffc5,
    0xffc6,
    0xffc7,
    0xffc9,
    0xffca,
    0xffcb,
    0xffcd,
    0xffce,
    0xffcf,
    0xffde
  ]);

  return {tableMarkers, sofMarkers};
}
