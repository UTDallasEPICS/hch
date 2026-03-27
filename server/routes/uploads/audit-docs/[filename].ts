import { createError, defineEventHandler, setHeader } from 'h3'
import { promises as fs } from 'fs'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const filename = event.context.params?.filename
  if (!filename) {
    throw createError({ statusCode: 400, statusMessage: 'Missing filename' })
  }

  // Security: only allow PDF and Word files, no directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }
  
  const allowedExtensions = ['.pdf', '.doc', '.docx']
  const hasValidExt = allowedExtensions.some(ext => filename.toLowerCase().endsWith(ext))
  if (!hasValidExt) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file type' })
  }

  const filePath = join(process.cwd(), 'uploads', 'audit-docs', filename)

  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      throw createError({ statusCode: 404, statusMessage: 'File not found' })
    }

    const buffer = await fs.readFile(filePath)
    
    // Set content type based on extension
    let contentType = 'application/octet-stream'
    if (filename.endsWith('.pdf')) contentType = 'application/pdf'
    else if (filename.endsWith('.doc')) contentType = 'application/msword'
    else if (filename.endsWith('.docx')) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Content-Length', buffer.length.toString())
    setHeader(event, 'Content-Disposition', `inline; filename="${filename}"`)

    return buffer
  } catch (err) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }
})
