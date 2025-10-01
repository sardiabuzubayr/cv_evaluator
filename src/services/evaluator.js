import { extractCV, callLLM } from "./llm.js"
import { getCollection, findDocs } from "./rag.js"

export async function runEvaluation(job) {
   const collection = await getCollection("job")

   const cvData = await extractCV(job.id, job.cvText || "No CV data provided")

   const jobDesc = await findDocs(collection, "Backend job description", 2)
   const rubric = await findDocs(collection, "Project evaluation rubric for Backend role", 1)

   const jobContext = [...jobDesc, ...rubric].join("\n")
   
   const cvEvalPrompt = `
    You are an evaluator for a Backend Developer role. Your task is to score the candidate's CV against the Job Description and Rubric.

    Score the candidate 1-5 on the following four weighted parameters:
    1. Technical Skills Match (40%)
    2. Experience Level (25%)
    3. Relevant Achievements (20%)
    4. Cultural/Collaboration Fit (15%)

    ### OUTPUT RULES:
    - Return ONLY a valid JSON object strictly following the provided schema.
    - Scores must be between 1 and 5.

    Candidate Info: ${JSON.stringify(cvData)}
    Job Description & Context: ${jobContext}`

   console.log(`cvEvalPrompt :\n ${cvEvalPrompt}`)

   const cvEvalSchema = {
      type: "object",
      properties: {
         technical_skills_score: {
            type: "number",
            description: "Score 1-5 for Technical Skills Match (Weight: 40%). Focus on backend, databases, APIs, cloud, and AI/LLM exposure."
         },
         experience_level_score: {
            type: "number",
            description: "Score 1-5 for Experience Level (Weight: 25%). Focus on years of experience and project complexity."
         },
         relevant_achievements_score: {
            type: "number",
            description: "Score 1-5 for Relevant Achievements (Weight: 20%). Focus on the impact and scale of past work."
         },
         cultural_fit_score: {
            type: "number",
            description: "Score 1-5 for Cultural/Collaboration Fit (Weight: 15%). Focus on communication, learning mindset, and teamwork."
         },
         overall_feedback: {
            type: "string",
            description: "Detailed feedback summarizing candidate strengths, weaknesses, and key findings based on these four scored parameters."
         }
      },
      required: ["technical_skills_score", "experience_level_score", "relevant_achievements_score", "cultural_fit_score", "overall_feedback"]
   }

   const cvEval = await callLLM(job.id, cvEvalPrompt, cvEvalSchema)
   console.log(`CV Response LLM : ${JSON.stringify(cvEval)}`)
   let cv_match_rate = 0
   let cv_feedback = cvEval.overall_feedback || "No CV feedback available"

   if (cvEval.technical_skills_score) {
      const WEIGHTS = {
         TS: 0.40, // Technical Skills
         EL: 0.25, // Experience Level
         RA: 0.20, // Relevant Achievements
         CF: 0.15  // Cultural Fit
      }

      const totalWeightedScore = (
         (cvEval.technical_skills_score || 0) * WEIGHTS.TS +
         (cvEval.experience_level_score || 0) * WEIGHTS.EL +
         (cvEval.relevant_achievements_score || 0) * WEIGHTS.RA +
         (cvEval.cultural_fit_score || 0) * WEIGHTS.CF
      )
      cv_match_rate = parseFloat((totalWeightedScore * 20).toFixed(2))
   }

   let projectEval = {
      correctness_score: 0,
      code_quality_score: 0,
      resilience_score: 0,
      documentation_score: 0,
      creativity_score: 0,
      weighted_average: 0,
      feedback: "No project report provided for evaluation."
   }

   if (job.projectText && job.projectText.trim().length > 0) {
      const projectEvalPrompt = `
         You are a technical evaluator for a Backend Developer role. Evaluate the Project Report based on the provided text, using the following Rubric.

         Score the project on these five weighted parameters:
         1. Correctness (Prompt & Chaining) - 30%
         2. Code Quality & Structure - 25%
         3. Resilience & Error Handling - 20%
         4. Documentation & Explanation - 15%
         5. Creativity / Bonus - 10%

         ### OUTPUT RULES:
         - Return ONLY a valid JSON object strictly following the provided schema.
         - All scores must be integers between 1 and 5.

         Project Report Text: ${job.projectText}
         Context / Rubric Details: ${jobContext}
`

      const projectEvalSchema = {
         type: "object",
         properties: {
            correctness_score: {
               type: "number",
               description: "Score 1-5 for Correctness (Weight: 30%). Focus on implementation of LLM chaining, RAG, and prompt design."
            },
            code_quality_score: {
               type: "number",
               description: "Score 1-5 for Code Quality & Structure (Weight: 25%). Focus on clean, modular, and reusable code."
            },
            resilience_score: {
               type: "number",
               description: "Score 1-5 for Resilience & Error Handling (Weight: 20%). Focus on handling long jobs, retries, and API failures."
            },
            documentation_score: {
               type: "number",
               description: "Score 1-5 for Documentation & Explanation (Weight: 15%). Focus on README clarity and setup instructions."
            },
            creativity_score: {
               type: "number",
               description: "Score 1-5 for Creativity / Bonus (Weight: 10%). Focus on extra features beyond core requirements."
            },
            feedback: {
               type: "string",
               description: "Detailed feedback summarizing the score rationale for all five parameters."
            }
         },
         required: ["correctness_score", "code_quality_score", "resilience_score", "documentation_score", "creativity_score", "feedback"]
      }

      console.log(`projectEvalPrompt \n: ${projectEvalPrompt}`)
      projectEval = await callLLM(job.id, projectEvalPrompt, projectEvalSchema)
      projectEval = typeof llmResult === 'object' && llmResult !== null ? llmResult : projectEval
      console.log(`Project Report Response LLM : ${JSON.stringify(projectEval)}`)
      
      if (projectEval.correctness_score) {
         const WEIGHTS = {
            C: 0.30,
            Q: 0.25,
            R: 0.20,
            D: 0.15,
            T: 0.10 
         }

         const totalWeightedScore = (
            (Math.max(1, Math.min(5, projectEval?.correctness_score || 0))) * WEIGHTS.C +
            (Math.max(1, Math.min(5, projectEval?.code_quality_score || 0))) * WEIGHTS.Q +
            (Math.max(1, Math.min(5, projectEval?.resilience_score || 0))) * WEIGHTS.R +
            (Math.max(1, Math.min(5, projectEval?.documentation_score || 0))) * WEIGHTS.D +
            (Math.max(1, Math.min(5, projectEval?.creativity_score || 0))) * WEIGHTS.T
         )

         projectEval.weighted_average = parseFloat((totalWeightedScore).toFixed(2))
      } else {
         projectEval.weighted_average = 0
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
      cv_match_rate: cv_match_rate || 0,
      cv_feedback: cv_feedback || "No feedback available",
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