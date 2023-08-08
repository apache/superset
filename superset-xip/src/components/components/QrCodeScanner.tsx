import QrScanner from "qr-scanner";
import React, {useEffect} from "react";

export function QrCodeScanner({ onScan }) {
  const qrCodeScannerRef = React.useRef(null);
  let qrScanner: QrScanner | null = null;

  useEffect(() => {
    if (qrCodeScannerRef.current) {
      qrScanner = new QrScanner(
        qrCodeScannerRef.current,
        result => onScan(result.data),
        {
          highlightScanRegion: true,
        },
      );

      qrScanner.start();
    }

    return () => {
      if (qrScanner) {
        qrScanner.destroy();
      }
    }
  }, [qrCodeScannerRef]);

  return (
    <video style={{ width: '100%' }} ref={qrCodeScannerRef}></video>
  )
}
