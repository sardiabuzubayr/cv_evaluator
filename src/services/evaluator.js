import { extractCV, callLLM } from "./llm.js"
import { getCollection, findDocs } from "./rag.js"

export async function runEvaluation(job) {
   const collection = await getCollection("job")

   const cvData = await extractCV(job.id, job.cvText || "No CV data provided")

   const jobDesc = await findDocs(collection, "Backend job description", 2)
   const rubric = await findDocs(collection, "Project evaluation rubric for Backend role", 1)

   const jobContext = [...jobDesc, ...rubric].join("\n")

   const cvEvalPrompt = `
    You are an evaluator. Compare this candidate info with the job requirements for the Backend. Focus on skills Node.js or Django or Rails.
    Return JSON: { "match_rate": float (0-1), "feedback": string }

    Candidate: ${JSON.stringify(cvData)}
    Job Description: ${jobContext}
  `

   console.log(`cvEvalPrompt :\n ${cvEvalPrompt}`)
   const cvEvalSchema = {
      type: "object",
      properties: {
         match_rate: {
            type: "number",
            description: "A float value between 0 and 1 representing how well the candidate matches the job requirements."
         },
         feedback: {
            type: "string",
            description: "A detailed string providing feedback on the candidate's strengths and weaknesses relative to the job requirements."
         }
      },
      required: ["match_rate", "feedback"]
   }

   const cvEval = await callLLM(job.id, cvEvalPrompt, cvEvalSchema)
   let projectEval = {
      correctness: 0,
      code_quality: 0,
      resilience: 0,
      documentation: 0,
      creativity: 0,
      weighted_average: 0,
      feedback: "No project report provided for evaluation."
   }

   if (job.projectText && job.projectText.trim().length > 0) {
      const projectEvalPrompt = `
      You are a technical evaluator for a Backend Product Engineer role. 
      Evaluate the Project Report using the given Rubric. 

      ### OUTPUT RULES:
      - Return ONLY a valid JSON object. 
      - JSON must contain: correctness, code_quality, resilience, documentation, creativity (scores 1-5), and feedback (detailed analysis).
      - Feedback must explain the reasoning for each score.

      ### RUBRIC:
      - Correctness (1-5): Accuracy of implementation, use of prompts/chaining, context injection.
      - Code Quality (1-5): Modularity, reusability, testing quality.
      - Resilience (1-5): Error handling, retries, robustness for long jobs.
      - Documentation (1-5): Clarity of README, setup steps, trade-offs explained.
      - Creativity (1-5): Enhancements beyond basic requirements.

      ### INPUT:
      Project Report:
      ${job.projectText}

      Rubric & Job Requirements:
      ${jobContext}
      `

      const projectEvalSchema = {
         type: "object",
         properties: {
            correctness: {
               type: "number",
               description: "Score from 1-5 for Prompt Design, LLM Chaining, and RAG context injection, based on the provided rubric."
            },
            code_quality: {
               type: "number",
               description: "Score from 1-5 for code structure, modularity, reusability, and testing."
            },
            resilience: {
               type: "number",
               description: "Score from 1-5 for handling long jobs, retries, exponential back-off, and randomness control."
            },
            documentation: {
               type: "number",
               description: "Score from 1-5 for README clarity, setup instructions, and trade-off explanations."
            },
            creativity: {
               type: "number",
               description: "Score from 1-5 for extra features beyond the core requirements."
            },
            feedback: {
               type: "string",
               description: "Detailed feedback justifying all five scores given above."
            }
         },
         required: ["correctness", "code_quality", "resilience", "documentation", "creativity", "feedback"]
      }
      console.log(`projectEvalPrompt \n: ${projectEvalPrompt}`)
      projectEval = await callLLM(job.id, projectEvalPrompt, projectEvalSchema)
      projectEval = typeof llmResult === 'object' && llmResult !== null ? llmResult : projectEval

      if (projectEval.correctness) {
         projectEval.weighted_average = parseFloat((
            (0.3 * (projectEval.correctness || 0)) + 
            (0.25 * (projectEval.code_quality || 0)) +
            (0.2 * (projectEval.resilience || 0)) +
            (0.15 * (projectEval.documentation || 0)) +
            (0.1 * (projectEval.creativity || 0))
         ).toFixed(2))
      }
   }

   const summaryPrompt = `
    Summarize the candidate evaluation in 3-5 sentences.
    Mention strengths (e.g., backend expertise, AI skills), gaps (e.g., missing skills or experience), and recommendation (e.g., hire, further assessment).
    Candidate Match: ${JSON.stringify(cvEval)}
    Project Evaluation: ${JSON.stringify(projectEval)}
  `
   console.log(`Summary prompt ${JSON.stringify(summaryPrompt)}`)
   const summary = await callLLM(job.id, summaryPrompt)

   const evalResult = {
      cv_match_rate: cvEval.match_rate || 0,
      cv_feedback: cvEval.feedback || "No feedback available",
      project_score: projectEval.weighted_average,
      project_feedback: projectEval.feedback || "No project feedback available",
      overall_summary: summary || "No summary available"
   }

   return {
      id: job.id,
      status: "completed",
      result: evalResult
   }
}