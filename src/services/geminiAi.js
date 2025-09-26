import dotenv from "dotenv"
import { GoogleGenAI } from '@google/genai'
dotenv.config()
const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
    console.error("Failed. The api key doesn't exists")
}

const ai = new GoogleGenAI({ apiKey: apiKey })

export { ai }