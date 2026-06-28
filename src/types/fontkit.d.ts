declare module 'fontkit' {
  interface Font {
    type: string
    postscriptName: string
    fullName: string
    familyName: string
    subfamilyName: string
    unitsPerEm: number
    ascent: number
    descent: number
    lineGap: number
  }
  export function create(buffer: ArrayBuffer | Uint8Array | Buffer, postscriptName?: string): Font
}
