import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

export async function alignProfileToJD(jdText, masterProfile) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key is missing. Please configure it in the .env file.');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // We will initialize the model dynamically in the try/catch block

  const systemInstructions = `
You are an expert technical recruiter and resume writer. 
Your task is to take a Master Profile (JSON) and a Job Description (JD), and produce an Optimized Profile (JSON) specifically tailored for this JD.

STRICT CONSTRAINTS & RULES:
1. **ONE PAGE LIMIT**: You must dynamically adjust the number of projects (1 to 3 maximum) and the length/number of bullet points so that the TOTAL resume length fits strictly on ONE page. If the candidate has extensive experience, pick fewer projects. Keep it concise.
2. Pick the most relevant projects from the Master Profile based on the JD.
3. Filter the skills list to only highlight relevant skills. 
   CRITICAL: Do NOT hallucinate skills. If a skill isn't in the Master Profile, do NOT add it to the Optimized Profile, even if the JD asks for it!
4. Rewrite the bullet points for experiences and selected projects to match the JD keywords and emphasize relevant achievements. Keep the tone professional, objective, and "Human-made". Do not sound overly robotic or use buzzwords excessively.
5. Extract and format any Certifications from the Master Profile (they might be listed under Education, or in a dedicated certifications array).
6. Generate a concise, professional job title for the CV header based on the JD (e.g., "Fullstack Engineer", "DevOps Engineer"). Maximum 5 words.
7. Generate a professional Cover Letter based on the master profile and the JD.

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
    "projects": [ ... ], // Dynamically chosen amount of projects (1-3) to fit 1 page
    "certifications": [
      {
         "name": "...",
         "issuer": "...",
         "date": "..."
      }
    ],
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

  const reqConfig = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
    }
  };

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(reqConfig);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    if (error.status === 429 || error.message.includes('429')) {
      console.warn('Rate limit hit on gemini-2.5-flash! Falling back to gemini-1.5-flash...');
      try {
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const fallbackResult = await fallbackModel.generateContent(reqConfig);
        return JSON.parse(fallbackResult.response.text());
      } catch (fallbackError) {
        console.error("Fallback Model also failed:", fallbackError);
        throw new Error("Google AI Free Tier Quota Exceeded. Please try again in 1 minute or upgrade your API Key.");
      }
    }
    console.error("Error in AI processing:", error);
    throw error;
  }
}
