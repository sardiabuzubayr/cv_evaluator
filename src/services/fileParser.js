import fs from 'fs/promises'
import path from 'path'
import PDFParser from 'pdf2json'
import mammoth from 'mammoth'

function readPdf(filePath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, 1)

        pdfParser.on("pdfParser_dataError", (errData) => {
            console.error('Error extracting text from PDF:', errData.parserError)
            resolve(null)
        })

        pdfParser.on("pdfParser_dataReady", () => {
            const extractedText = pdfParser.getRawTextContent()
            resolve(extractedText)
        })

        pdfParser.loadPDF(filePath)
    })
}

export async function extractText(filePath) {
    if (!await fs.stat(filePath).catch(() => null)) {
        console.error(`Error: File not found at path: ${filePath}`)
        return null
    }

    const extension = path.extname(filePath).toLowerCase()
    let extractedText = null

    try {
        if (extension === '.pdf') {
            extractedText = await readPdf(filePath)

        } else if (extension === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath })
            extractedText = result.value

        } else if (extension === '.txt' || extension === '.md') {
            extractedText = await fs.readFile(filePath, { encoding: 'utf-8' })

        } else {
            console.warn(`Warning: Unsupported file type: ${extension}. Skipping extraction.`)
            return null
        }

        return extractedText

    } catch (error) {
        console.error(`An error occurred during extraction for ${extension}:`, error.message)
        return null
    }
}