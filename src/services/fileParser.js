import fs from 'fs/promises'
import path from 'path'
import mammoth from 'mammoth'
import { ai } from "./geminiAi.js"

export async function readPdf(filePath) {
    try {
        const buffer = await fs.readFile(filePath);
        const base64data = buffer.toString("base64");

        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL, 
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType: "application/pdf",
                                data: base64data
                            }
                        },
                        {
                            text: `
                            Extract all readable text from this PDF.
                            - Remove non-standard symbols, bullet icons, and decorative characters.
                            - Return clean plain text only, without JSON or markdown.
                            - Preserve logical structure by keeping section titles (e.g., Skills, Experience, Projects, Education, Introduction, Implementation, Conclusion).
                            - Separate sections with a blank line for readability.
                            - Do not add extra commentary or explanations.
                            `
                        }
                    ]
                }
            ]
        })

        return response.text || "";
    } catch (err) {
        console.error("Error extracting text with Gemini:", err)
        throw err
    }
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

        console.log(extractedText)

        return extractedText

    } catch (error) {
        console.error(`An error occurred during extraction for ${extension}:`, error.message)
        return null
    }
}