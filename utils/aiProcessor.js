import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

export async function alignProfileToJD(jdText, masterProfile) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key is missing. Please configure it in the .env file.');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const systemInstructions = `
You are an expert technical recruiter and resume writer. 
Your task is to take a Master Profile (JSON) and a Job Description (JD), and produce an Optimized Profile (JSON) specifically tailored for this JD.

STRICT CONSTRAINTS & RULES:
1. Pick exactly the top 3 most relevant projects from the Master Profile based on the JD.
2. Filter the skills list to only highlight relevant skills. 
   CRITICAL: Do NOT hallucinate skills. If a skill isn't in the Master Profile, do NOT add it to the Optimized Profile, even if the JD asks for it!
3. Rewrite the bullet points for experiences and selected projects to match the JD keywords and emphasize relevant achievements. Keep the tone professional, objective, and "Human-made". Do not sound overly robotic or use buzzwords excessively.
4. Generate a concise, professional job title for the CV header based on the JD (e.g., "Fullstack Engineer", "DevOps Engineer"). Maximum 5 words.
5. Generate a professional Cover Letter based on the master profile and the JD.

OUTPUT FORMAT (JSON ONLY, NO MARKDOWN TAGS LIKE \`\`\`json):
{
  "cv": {
    "personalInfo": { ... }, // Same as master
    "title": "...", // The concise job title (max 5 words)
    "summary": "...", // Tailored professional summary (3-4 sentences)
    "skills": ["..."], // Filtered skills list
    "experience": [
      {
        "company": "...",
        "position": "...",
        "startDate": "...",
        "endDate": "...",
        "highlights": ["..."] // Rewritten bullet points
      }
    ],
    "projects": [ ... ], // Exactly 3 most relevant projects with rewritten highlights
    "education": [ ... ] // Same as master
  },
  "coverLetter": {
    "content": "..." // Ensure paragraphs are separated by \n\n. Address the hiring manager appropriately.
  }
}
`;

  const userPrompt = `
System Instructions:\n${systemInstructions}

Job Description:\n${jdText}

Master Profile:\n${JSON.stringify(masterProfile, null, 2)}
`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.error("Error in AI processing:", error);
    throw error;
  }
}
