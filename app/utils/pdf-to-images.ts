/**
 * Client-side utility to convert PDF pages to base64 PNG images.
 * Uses pdfjs-dist with DOM canvas for Vision API consumption.
 *
 * Usage: Call from browser only (requires document, canvas).
 */
import * as pdfjsLib from 'pdfjs-dist'

// Configure worker for pdf.js (required in browser)
// Use jsDelivr for reliable worker loading across bundlers (Vite/Nuxt)
if (import.meta.client) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

const DEFAULT_SCALE = 2 // Higher scale = better quality for Vision API

export interface PdfToImagesOptions {
  scale?: number
  maxPages?: number
}

/**
 * Convert a PDF File to an array of base64 PNG data URLs (one per page).
 * @param file - PDF file from file input
 * @param options - Optional scale (default 2) and maxPages limit
 */
export async function pdfToBase64Images(
  file: File,
  options: PdfToImagesOptions = {}
): Promise<string[]> {
  const { scale = DEFAULT_SCALE, maxPages = 50 } = options

  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise
  const numPages = Math.min(pdf.numPages, maxPages)
  const results: string[] = []

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context not available')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise
    const dataUrl = canvas.toDataURL('image/png')
    results.push(dataUrl)
  }

  return results
}
