import express from "express"
import multer from "multer"
import dotenv from "dotenv"
import routes from "./routes.js"
import path from "path"
import { connectQueue } from "./queue.js"

dotenv.config()
const app = express()
connectQueue()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/")
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext
    cb(null, uniqueName)
  }
})

const upload = multer({ storage })

app.use(express.json())
app.post("/upload", upload.fields([{ name: "cv" }, { name: "project" }]), routes.upload)
app.post("/evaluate", routes.evaluate)
app.get("/result/:id", routes.result)

const PORT = process.env.SERVER_PORT || 3000
app.listen(PORT, () => console.log(`Server running on ${PORT}`))
