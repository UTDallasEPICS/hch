import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOADS_DIR = join(process.cwd(), 'uploads', 'audit-docs')

export async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
}

export interface SavedFile {
  path: string
  originalName: string
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

export async function saveBase64File(
  base64DataUrl: string,
  originalFilename: string
): Promise<SavedFile> {
  await ensureUploadsDir()

  const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) {
    throw new Error('Invalid base64 data URL format')
  }

  const mimeType = matches[1]
  const base64Data = matches[2]
  const buffer = Buffer.from(base64Data, 'base64')

  const ext = getExtensionFromMime(mimeType) || getExtensionFromFilename(originalFilename)
  const uniqueId = randomUUID()
  const filename = `${uniqueId}${ext}`
  const filePath = join(UPLOADS_DIR, filename)

  await fs.writeFile(filePath, buffer)

  return {
    path: `${BASE_URL}/uploads/audit-docs/${filename}`,
    originalName: originalFilename,
  }
}

function extractRelativePath(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    try {
      const url = new URL(pathOrUrl)
      return url.pathname.slice(1)
    } catch {
      return pathOrUrl
    }
  }
  return pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl
}

export async function deleteFile(pathOrUrl: string): Promise<void> {
  const relativePath = extractRelativePath(pathOrUrl)
  const fullPath = join(process.cwd(), relativePath)
  try {
    await fs.unlink(fullPath)
  } catch {
    // File may not exist, ignore error
  }
}

export async function readFile(pathOrUrl: string): Promise<Buffer> {
  const relativePath = extractRelativePath(pathOrUrl)
  const fullPath = join(process.cwd(), relativePath)
  return fs.readFile(fullPath)
}

export async function fileExists(pathOrUrl: string): Promise<boolean> {
  const relativePath = extractRelativePath(pathOrUrl)
  const fullPath = join(process.cwd(), relativePath)
  try {
    await fs.access(fullPath)
    return true
  } catch {
    return false
  }
}

function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  }
  return mimeMap[mimeType] || ''
}

function getExtensionFromFilename(filename: string): string {
  const match = filename.match(/\.[^.]+$/)
  return match ? match[0].toLowerCase() : '.bin'
}

export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase()
  if (ext.endsWith('.pdf')) return 'application/pdf'
  if (ext.endsWith('.doc')) return 'application/msword'
  if (ext.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}
