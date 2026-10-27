// Wyciąga mapę głębi zapisaną przez iPhone'a w pliku HEIC i zapisuje ją jako szary PNG.
// Użycie: swift tools/depth-from-heic.swift public/mug.HEIC public/depth.png
import Foundation
import AVFoundation
import CoreImage
import ImageIO

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
guard let src = CGImageSourceCreateWithURL(input as CFURL, nil) else { fatalError("cannot open") }

var info = CGImageSourceCopyAuxiliaryDataInfoAtIndex(src, 0, kCGImageAuxiliaryDataTypeDisparity) as? [AnyHashable: Any]
var kind = "disparity"
if info == nil {
  info = CGImageSourceCopyAuxiliaryDataInfoAtIndex(src, 0, kCGImageAuxiliaryDataTypeDepth) as? [AnyHashable: Any]
  kind = "depth"
}
guard let info else { print("NO DEPTH DATA"); exit(1) }

var data = try AVDepthData(fromDictionaryRepresentation: info)
// Zawsze dysparycja (1/odległość): blisko = jasne, daleko = ciemne.
data = data.converting(toDepthDataType: kCVPixelFormatType_DisparityFloat32)
let buf = data.depthDataMap
CVPixelBufferLockBaseAddress(buf, .readOnly)
let w = CVPixelBufferGetWidth(buf), h = CVPixelBufferGetHeight(buf)
let rowBytes = CVPixelBufferGetBytesPerRow(buf)
let base = CVPixelBufferGetBaseAddress(buf)!
var values = [Float](repeating: 0, count: w * h)
for y in 0..<h {
  let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
  for x in 0..<w { values[y * w + x] = row[x] }
}
CVPixelBufferUnlockBaseAddress(buf, .readOnly)
let finite = values.filter { $0.isFinite }
let lo = finite.min()!, hi = finite.max()!
print("source=\(kind) size=\(w)x\(h) disparity min=\(lo) max=\(hi) (1/m) -> \(1/hi)m .. \(1/lo)m")

var bytes = [UInt8](repeating: 0, count: w * h)
for i in 0..<values.count {
  let v = values[i].isFinite ? (values[i] - lo) / (hi - lo) : 0
  bytes[i] = UInt8(max(0, min(255, v * 255)))
}
let provider = CGDataProvider(data: Data(bytes) as CFData)!
let img = CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 8, bytesPerRow: w,
                  space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGBitmapInfo(rawValue: 0),
                  provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
let dest = CGImageDestinationCreateWithURL(output as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(dest, img, nil)
CGImageDestinationFinalize(dest)
