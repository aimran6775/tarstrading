// Renders the Tars orbital mark to AppIcon PNGs. Run: swift scripts/gen-icon.swift
import AppKit
import CoreGraphics

let size = 1024.0
let rect = CGRect(x: 0, y: 0, width: size, height: size)
let ctx = CGContext(data: nil, width: Int(size), height: Int(size),
                    bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!,
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

// Background: deep void with a subtle radial aurora.
ctx.setFillColor(CGColor(red: 0.031, green: 0.035, blue: 0.055, alpha: 1))
ctx.fill(rect)
let auroraColors = [CGColor(red: 0.42, green: 0.62, blue: 1.0, alpha: 0.32),
                    CGColor(red: 0.66, green: 0.50, blue: 1.0, alpha: 0.10),
                    CGColor(red: 0.031, green: 0.035, blue: 0.055, alpha: 0.0)] as CFArray
let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB)!,
                          colors: auroraColors, locations: [0, 0.55, 1])!
ctx.drawRadialGradient(gradient,
                       startCenter: CGPoint(x: size * 0.5, y: size * 0.58), startRadius: 0,
                       endCenter: CGPoint(x: size * 0.5, y: size * 0.58), endRadius: size * 0.62,
                       options: [])

// Constellation dots on the upper field.
srand48(42)
for _ in 0..<26 {
    let x = drand48() * size, y = size * (0.55 + drand48() * 0.4)
    let r = 2.0 + drand48() * 4.0
    ctx.setFillColor(CGColor(red: 0.42, green: 0.62, blue: 1.0, alpha: 0.25 + drand48() * 0.4))
    ctx.fillEllipse(in: CGRect(x: x, y: y, width: r, height: r))
}

// The orbital mark: ellipse ring + core, tilted.
ctx.saveGState()
ctx.translateBy(x: size / 2, y: size * 0.52)
ctx.rotate(by: -0.32)
ctx.setStrokeColor(CGColor(red: 0.42, green: 0.62, blue: 1.0, alpha: 0.95))
ctx.setLineWidth(26)
ctx.strokeEllipse(in: CGRect(x: -size * 0.33, y: -size * 0.125, width: size * 0.66, height: size * 0.25))
ctx.restoreGState()

// Core.
ctx.setFillColor(CGColor(red: 0.42, green: 0.62, blue: 1.0, alpha: 1))
ctx.fillEllipse(in: CGRect(x: size / 2 - 62, y: size * 0.52 - 62, width: 124, height: 124))
ctx.setFillColor(CGColor(red: 0.93, green: 0.94, blue: 0.97, alpha: 1))
ctx.fillEllipse(in: CGRect(x: size / 2 - 26, y: size * 0.52 - 26, width: 52, height: 52))

// Rising candle silhouettes along the bottom, very subtle.
let candles: [(Double, Double, Double)] = [(0.16, 0.10, 0.05), (0.30, 0.16, 0.08),
                                           (0.44, 0.13, 0.20), (0.58, 0.22, 0.14),
                                           (0.72, 0.30, 0.22), (0.86, 0.40, 0.30)]
for (cx, h, wick) in candles {
    ctx.setFillColor(CGColor(red: 0.20, green: 0.84, blue: 0.51, alpha: 0.30))
    ctx.fill(CGRect(x: size * cx - 22, y: size * 0.06, width: 44, height: size * h))
    ctx.setStrokeColor(CGColor(red: 0.20, green: 0.84, blue: 0.51, alpha: 0.30))
    ctx.setLineWidth(8)
    ctx.move(to: CGPoint(x: size * cx, y: size * 0.06))
    ctx.addLine(to: CGPoint(x: size * cx, y: size * (0.06 + h + wick)))
    ctx.strokePath()
}

let image = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: image)
let png = rep.representation(using: .png, properties: [:])!
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "AppIcon-1024.png"
try! png.write(to: URL(fileURLWithPath: out))
print("wrote \(out)")
