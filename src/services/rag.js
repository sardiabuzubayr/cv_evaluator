import { ChromaClient } from "chromadb"
import dotenv from "dotenv"
import { ai } from "./geminiAi.js"

dotenv.config()
const client = new ChromaClient({ host: process.env.CHROMA_HOST, port: process.env.CHROMA_PORT})

class GoogleEmbeddingFunction {
   async generate(texts) {
      if (!Array.isArray(texts)) {
         texts = [texts]
      }

      if (texts.length === 1 && typeof texts[0] === 'string' && texts[0].startsWith('[')) {
         try {
            texts = JSON.parse(texts[0].replace(/'/g, '"'))
         } catch (e) {
         }
      }

      const response = await ai.models.embedContent({
         model: 'text-embedding-004', // gemini text embeding
         contents: texts,
         config: {
            outputDimensionality: 384,
         },
      })

      return response.embeddings.map(e => e.values)
   }
}

export async function getCollection(name = "job") {
   return await client.getOrCreateCollection({
      name,
      embeddingFunction: new GoogleEmbeddingFunction()
   })
}

export async function createDocs(collection, docs) {
   const res = await collection.add({
      ids: docs.map((_, i) => `doc-${Date.now()}-${i}`),
      documents: docs,
      metadatas: docs.map(() => ({ type: "job" }))
   })
   console.log("Success ", res)
}

export async function findDocs(collection, query, limit) {
   const results = await collection.query({
      queryTexts: [query],
      nResults: limit
   })
   return results.documents
}

// Initialize
//vector docs chunck
const docs = [
   "Job Description: Backend with responsible for building scalable services with Node.js, Go, Docker.",
   "Experiences in backend languages and frameworks such as (Node.js, Django, Rails) nice to have experience with LLMs such as OpenAI or Gemini for AI-powered backend solutions",
   "Evaluation Rubric: Correctness, Code Quality, Resilience, Documentation, Creativity."
]

try {
   await client.deleteCollection({ name: "job" })
} catch (err) {

}
const collection = await getCollection("job")
await createDocs(collection, docs)
// console.log("Example Query : ", await findDocs(collection, "backend experience", 2))
