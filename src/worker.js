import dotenv from "dotenv"
dotenv.config()

import { connectQueue } from "./queue.js"
import { runEvaluation } from "./services/evaluator.js"
import { db } from "./db.js"

async function startWorker() {
	const channel = await connectQueue()
	channel.consume("evaluation_jobs", async (msg) => {
		const job = JSON.parse(msg.content.toString())
		console.log("Processing job:", job.id)
		try {
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
}

startWorker()
