import { db } from "../db.js"
import { ai } from "./geminiAi.js"

const cvSchema = {
	type: "object",
	properties: {
		skills: {
			type: "array",
			description: "List of skills technical or non-technical.",
			items: { type: "string" }
		},
		experiences: {
			type: "array",
			description: "Working experiences.",
			items: {
				type: "object",
				properties: {
					title: { type: "string", description: "Role." },
					company: { type: "string", description: "Company name or organization." },
					duration: { type: "string", description: "Working range." },
					description: { type: "string", description: "Short description about responsibilities and achievment." }
				},
				required: ["title", "company", "duration"]
			}
		},
		projects: {
			type: "array",
			description: "List of projects that have been worked on.",
			items: {
				type: "object",
				properties: {
					name: { type: "string", description: "Nama Proyek" },
					technologies: { type: "array", items: { type: "string" }, description: "Technology stack" },
					summary: { type: "string", description: "Project summary" }
				},
				required: ["name", "summary"]
			}
		}
	},
	required: ["skills", "experiences", "projects"]
}

export async function extractCV(id, cvText) {
	try {
		const response = await ai.models.generateContent({
			model: process.env.GEMINI_MODEL,
			config: {
				temperature: 0.2, // Dont not need creativity so need to set lower
				responseMimeType: "application/json",
				responseSchema: cvSchema
			},

			contents: [
				{
					role: "user",
					parts: [
						{ text: "Extract structured info (skills, experiences, projects) from this CV. Strictly adhere to the provided JSON schema. Do not add any conversational text outside the JSON object." },
						{ text: cvText }
					]
				}
			]
		})
		return safeJSON(response.text)
	} catch (err) {
		console.error("extractCV failed:", err.message)
		await db.query(
			"UPDATE jobs SET status = ? WHERE id = ?",
			["failed", id]
		)

		return {
			skills: [],
			experiences: [],
			projects: [],
			error: "LLM request failed, could not extract CV"
		}
	}
}

export async function callLLM(id, prompt, schema = null, retries = 2) {
	let attempt = 0
	while (attempt <= retries) {
		try {
			const response = await ai.models.generateContent({
				model: process.env.GEMINI_MODEL,
				config: {
					temperature: 0.2,
					responseMimeType: "application/json",
					responseSchema: schema
				},
				contents: [
					{
						role: "user",
						parts: [
							{ text: "You are an evaluator. Based on the following request, provide a response only as a valid JSON object that strictly follows the provided schema. Request: " + prompt }
						]
					}
				]
			})

			return safeJSON(response.text)
		} catch (err) {
			console.error(`⚠️ callLLM attempt ${attempt + 1} failed:`, err.message)
			attempt++

			if (attempt <= retries) {
				await new Promise(res => setTimeout(res, 1000 * attempt))
			} else {
				await db.query(
					"UPDATE jobs SET status = ? WHERE id = ?",
					["failed", id]
				)
				return {
					error: "LLM request failed after retries",
					raw: prompt
				}
			}
		}
	}
}

function safeJSON(str) {
	try {
		return JSON.parse(str)
	} catch (e) {
		console.error("Invalid JSON from LLM:", str)
		return {}
	}
}
