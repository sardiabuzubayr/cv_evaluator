import { QUEUE_EVALUATE, QUEUE_EXTRACT_CV, sendJob } from "./queue.js"
import { v4 as uuidv4 } from "uuid"
import { db } from "./db.js"
import path from 'path'

export default {
	upload: async (req, res) => {
		try {
			const id = uuidv4()

			const cvFile = req.files["cv"]?.[0]
			const projectFile = req.files["project"]?.[0]

			if (!cvFile || !projectFile) {
				return res.status(400).json({ error: "CV and Project Report are required", status:"failed" })
			}

			const extension = path.extname(cvFile.path).toLowerCase()
			if (extension !== '.pdf' || extension === '.docx' || extension === '.txt') {
				return res.status(500).json({ error: "Wrong file type", status:"failed" })
			}

			await db.query(
				"INSERT INTO jobs (id, cv_text, project_text, status) VALUES (?, ?, ?, ?)",
				[id, null, null, "uploaded"]
			)

			const job = { id, cvFile: cvFile.path, projectFile: projectFile.path }

			await sendJob(QUEUE_EXTRACT_CV, job)
			res.json({ id, status: "uploaded" })
		} catch (err) {
			console.error(err)
			res.status(500).json({ error: "Failed to process files", status:"failed" })
		}
	},

	evaluate: async (req, res) => {
		try {
			const { id } = req.body
			if (!id) return res.status(400).json({ error: "Job ID required" })

			const [rows] = await db.query("SELECT * FROM jobs WHERE id = ?", [id])
			if (rows.length === 0) {
				return res.status(404).json({ error: "Job not found" })
			}

			if(rows[0].status === 'processing' || rows[0].status === 'completed'){
				return res.json({ id, status: rows[0].status })
			}
			await db.query("UPDATE jobs SET status = ? WHERE id = ?", ["queued", id])

			const job = { id, cvText: rows[0].cv_text, projectText: rows[0].project_text }
			await sendJob(QUEUE_EVALUATE,job)

			res.json({ id, status: "queued" })
		} catch (err) {
			console.error(err)
			res.status(500).json({ error: "Failed to queue evaluation" })
		}
	},

	result: async (req, res) => {
		const [rows] = await db.query("SELECT * FROM jobs WHERE id = ?", [req.params.id])
		if (rows.length > 0) {
			const row = rows[0]
			if (row.status === 'completed') {
				return res.status(200).json({
					id: req.params.id,
					status: row.status,
					result: JSON.parse(row.result)
				})
			}
			return res.status(404).json({
				id: req.params.id,
				status: row.status,
			})
		}
		return res.status(404).json({ error: "Job not found" })
	}
}
