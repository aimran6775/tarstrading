import AppKit
import CoreGraphics

/*
  The Tars mark — one idea, one color.

  A condensed geometric T whose right arm steps UP: the monogram and the
  chart gesture are the same shape. Gold on the house blue-black. Flat
  layers, no baked lighting — depth is the system's job now (Liquid
  Glass), and starfields/candlesticks/orbits are three ideas too many,
  which is exactly what the old icon was.

  Usage: swift scripts/gen-icon-mark.swift <out.png>
*/

let size = 1024
guard let ctx = CGContext(data: nil, width: size, height: size,
                          bitsPerComponent: 8, bytesPerRow: 0,
                          space: CGColorSpace(name: CGColorSpace.displayP3)!,
                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fatalError("no context")
}
let S = CGFloat(size)

// Field: near-black with the house blue-violet cast, barely graded so the
// flat color doesn't read dead. (CG y-axis: 0 = bottom.)
let bgTop = CGColor(colorSpace: CGColorSpace(name: CGColorSpace.displayP3)!,
                    components: [0.055, 0.063, 0.098, 1.0])!
let bgBottom = CGColor(colorSpace: CGColorSpace(name: CGColorSpace.displayP3)!,
                       components: [0.016, 0.020, 0.035, 1.0])!
let grad = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.displayP3)!,
                      colors: [bgTop, bgBottom] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(grad, start: CGPoint(x: S/2, y: S), end: CGPoint(x: S/2, y: 0), options: [])

// A whisper of warmth behind the mark — felt, not seen.
let glow = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.displayP3)!,
                      colors: [CGColor(colorSpace: CGColorSpace(name: CGColorSpace.displayP3)!,
                                       components: [1.0, 0.72, 0.20, 0.10])!,
                               CGColor(colorSpace: CGColorSpace(name: CGColorSpace.displayP3)!,
                                       components: [1.0, 0.72, 0.20, 0.0])!] as CFArray,
                      locations: [0, 1])!
ctx.drawRadialGradient(glow, startCenter: CGPoint(x: S/2, y: S*0.58), startRadius: 0,
                       endCenter: CGPoint(x: S/2, y: S*0.58), endRadius: S*0.52, options: [])

// The mark. Grid: stem 132 wide; arms 132 tall; the right arm rides 96
// higher than the left — the tick up.
let gold = CGColor(colorSpace: CGColorSpace(name: CGColorSpace.displayP3)!,
                   components: [1.0, 0.72, 0.20, 1.0])!
ctx.setFillColor(gold)

let cx = S/2
let barH: CGFloat = 150
let stemW: CGFloat = 150
let armSpan: CGFloat = 270     // how far each arm reaches from center
let step: CGFloat = 104        // the rise
let topY: CGFloat = 712        // left arm TOP edge (CG: y up)
let stemBottom: CGFloat = 240

func bar(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, r: CGFloat = 30) {
    ctx.addPath(CGPath(roundedRect: CGRect(x: x, y: y, width: w, height: h),
                       cornerWidth: r, cornerHeight: r, transform: nil))
}

// Stem: from the LEFT arm's underside down — the T reads instantly.
bar(cx - stemW/2, stemBottom, stemW, topY - stemBottom)
// Left arm, level. Right arm, one step up — both overlap the stem column
// so the three bars read as one mark. Symmetric reach keeps it centered.
bar(cx - armSpan, topY - barH, armSpan + stemW/2, barH)
bar(cx - stemW/2, topY - barH + step, armSpan + stemW/2, barH)
ctx.fillPath()

let img = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: img)
let png = rep.representation(using: .png, properties: [:])!
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon.png"
try! png.write(to: URL(fileURLWithPath: out))
print("wrote \(out)")
