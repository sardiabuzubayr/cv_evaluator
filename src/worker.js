import dotenv from "dotenv"
dotenv.config()

import { connectQueue, QUEUE_EVALUATE, QUEUE_EXTRACT_CV } from "./queue.js"
import { runEvaluation } from "./services/evaluator.js"
import { db } from "./db.js"
import { extractText } from "./services/fileParser.js"
import fs from "fs/promises"

async function startWorker() {
	const channel = await connectQueue()
	channel.consume(QUEUE_EVALUATE, async (msg) => {
		const job = JSON.parse(msg.content.toString())
		console.log(`Processing ${QUEUE_EVALUATE} :`, job.id)
		try {
			await db.query(
				"UPDATE jobs SET status = ? WHERE id = ?",
				['processing', job.id]
			)
			
			const result = await runEvaluation(job)
			console.log("Result:", result)

			await db.query(
				"UPDATE jobs SET status = ?, result = ? WHERE id = ?",
				[result.status, JSON.stringify(result.result), result.id]
			)
		} catch (err) {
			console.error("Job failed:", err)
		}

		channel.ack(msg)
	})

	channel.consume(QUEUE_EXTRACT_CV, async (msg) => {
		const cv = JSON.parse(msg.content.toString())
		console.log(`Processing ${QUEUE_EXTRACT_CV} :`, cv.id)

		try {
			const cvText = await extractText(cv.cvFile)
			console.log(`CV Text : \n${cvText}`)
			const projectText = await extractText(cv.projectFile)
			console.log(`project Text : \n${projectText}`)

			await db.query(
				"UPDATE jobs SET cv_text = ?, project_text =? WHERE id = ?",
				[cvText, projectText, cv.id]
			)
			await fs.unlink(cv.cvFile)
			await fs.unlink(cv.projectFile)
		} catch (err) {
			console.error("Job failed:", err)
			await db.query(
				"UPDATE jobs SET status = ? WHERE id = ?",
				['failed', cv.id]
			)
		}

		channel.ack(msg)
	})
}

startWorker()
