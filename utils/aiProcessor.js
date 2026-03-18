import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const JD_TRACK = {
  CLOUD_DEVOPS_INFRA: 'cloud_devops_infra',
  SOFTWARE_ENGINEERING: 'software_engineering',
  UNKNOWN: 'unknown'
};

const CLOUD_KEYWORDS = [
  'cloud', 'aws', 'azure', 'gcp', 'devops', 'sre', 'site reliability',
  'infrastructure', 'infra', 'terraform', 'kubernetes', 'docker', 'helm',
  'ci/cd', 'jenkins', 'github actions', 'gitlab ci', 'observability',
  'prometheus', 'grafana', 'ansible', 'iam', 'vpc'
];

const SOFTWARE_KEYWORDS = [
  'software engineer', 'backend', 'full stack', 'fullstack', 'java',
  'spring', 'node.js', 'typescript', 'react', 'api', 'microservice'
];

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function countKeywordHits(text, keywords) {
  return keywords.reduce((count, keyword) => {
    return count + (text.includes(keyword) ? 1 : 0);
  }, 0);
}

function classifyJDTrack(jdText) {
  const normalizedJD = normalizeText(jdText);
  const cloudHits = countKeywordHits(normalizedJD, CLOUD_KEYWORDS);
  const softwareHits = countKeywordHits(normalizedJD, SOFTWARE_KEYWORDS);

  if (cloudHits >= 2 && cloudHits >= softwareHits) {
    return JD_TRACK.CLOUD_DEVOPS_INFRA;
  }

  if (softwareHits >= 2) {
    return JD_TRACK.SOFTWARE_ENGINEERING;
  }

  return JD_TRACK.UNKNOWN;
}

function normalizeCertifications(certifications) {
  if (!Array.isArray(certifications)) {
    return [];
  }

  return certifications
    .map(cert => {
      if (typeof cert === 'string') {
        return { name: cert, issuer: '', date: '' };
      }
      return {
        name: cert?.name || '',
        issuer: cert?.issuer || '',
        date: cert?.date || ''
      };
    })
    .filter(cert => cert.name.trim().length > 0);
}

function dedupeCertifications(certifications) {
  const seen = new Set();
  const deduped = [];

  for (const cert of certifications) {
    const key = `${normalizeText(cert.name)}|${normalizeText(cert.issuer)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(cert);
    }
  }

  return deduped;
}

function extractAwsCertifications(masterProfile) {
  const directCerts = normalizeCertifications(masterProfile?.certifications || []);
  const educationDerived = Array.isArray(masterProfile?.education)
    ? masterProfile.education
      .filter(edu => {
        const blob = normalizeText(`${edu?.degree || ''} ${edu?.institution || ''}`);
        return blob.includes('aws') || blob.includes('amazon web services');
      })
      .map(edu => ({
        name: edu?.degree || 'AWS Certification',
        issuer: edu?.institution || 'AWS',
        date: edu?.graduationYear || ''
      }))
    : [];

  return dedupeCertifications([...directCerts, ...educationDerived])
    .filter(cert => {
      const blob = normalizeText(`${cert.name} ${cert.issuer}`);
      return blob.includes('aws') || blob.includes('amazon web services');
    });
}

function tokenize(text) {
  return new Set(
    normalizeText(text)
      .split(/[^a-z0-9+#.]+/)
      .filter(token => token.length >= 3)
  );
}

function scoreProject(project, jdTokens) {
  const nameText = normalizeText(project?.name);
  const descText = normalizeText(project?.description);
  const technologies = Array.isArray(project?.technologies)
    ? project.technologies.map(tech => normalizeText(tech))
    : [];
  const highlights = Array.isArray(project?.highlights)
    ? project.highlights.map(item => normalizeText(item)).join(' ')
    : '';

  let score = 0;

  for (const token of jdTokens) {
    if (nameText.includes(token)) score += 4;
    if (descText.includes(token)) score += 2;
    if (highlights.includes(token)) score += 1;
    if (technologies.some(tech => tech.includes(token))) score += 3;
  }

  return score;
}

function dedupeProjects(projects) {
  const seen = new Set();
  const deduped = [];

  for (const project of projects) {
    const key = normalizeText(project?.name);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(project);
  }

  return deduped;
}

function selectCoreProjects(masterProjects, jdText, count) {
  if (!Array.isArray(masterProjects) || masterProjects.length === 0 || count <= 0) {
    return [];
  }

  const jdTokens = tokenize(jdText);
  const ranked = masterProjects
    .map((project, index) => ({
      project,
      score: scoreProject(project, jdTokens) + (index < 6 ? 0.25 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.project);

  return dedupeProjects(ranked).slice(0, count);
}

function applyTrackRules(optimizedData, masterProfile, jdText) {
  const safeData = optimizedData && typeof optimizedData === 'object' ? optimizedData : {};
  const safeCV = safeData.cv && typeof safeData.cv === 'object' ? safeData.cv : {};
  const safeMasterProjects = Array.isArray(masterProfile?.projects) ? masterProfile.projects : [];

  safeCV.projects = Array.isArray(safeCV.projects) ? dedupeProjects(safeCV.projects) : [];
  safeCV.certifications = normalizeCertifications(safeCV.certifications);

  const track = classifyJDTrack(jdText);

  if (track === JD_TRACK.CLOUD_DEVOPS_INFRA) {
    const awsCerts = extractAwsCertifications(masterProfile);
    if (awsCerts.length > 0) {
      safeCV.certifications = dedupeCertifications([...awsCerts, ...safeCV.certifications]);
    }
  }

  if (track === JD_TRACK.SOFTWARE_ENGINEERING) {
    const TARGET_PROJECT_COUNT = 3;
    const aiProjects = safeCV.projects.slice(0, TARGET_PROJECT_COUNT);

    if (aiProjects.length < TARGET_PROJECT_COUNT) {
      const candidateProjects = selectCoreProjects(safeMasterProjects, jdText, TARGET_PROJECT_COUNT + 3);
      const merged = dedupeProjects([...aiProjects, ...candidateProjects]);
      safeCV.projects = merged.slice(0, TARGET_PROJECT_COUNT);
    } else {
      safeCV.projects = aiProjects;
    }
  }

  safeData.cv = safeCV;
  return safeData;
}

export async function alignProfileToJD(jdText, masterProfile) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key is missing. Please configure it in the .env file.');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const jdTrack = classifyJDTrack(jdText);

  const systemInstructions = `
You are an expert technical recruiter and resume writer.
Your task is to take a Master Profile (JSON) and a Job Description (JD), and produce an Optimized Profile (JSON) specifically tailored for this JD.

STRICT CONSTRAINTS & RULES:
1. ONE PAGE LIMIT: keep the CV concise enough to stay on one page.
2. Pick the most relevant projects from the Master Profile based on the JD.
3. Filter skills to only relevant skills found in Master Profile (no hallucinations).
4. Rewrite bullets to match JD keywords while staying objective and human.
5. Extract and format certifications from the Master Profile.
6. Generate a concise professional CV title (max 5 words).
7. Generate a professional cover letter.

TRACK-SPECIFIC RULES:
- Active track for this request: ${jdTrack}
- If track is cloud_devops_infra: ensure AWS certifications from master profile are included in cv.certifications when available.
- If track is software_engineering: include 3 core projects in cv.projects (or all available if fewer than 3 exist in master profile).

OUTPUT FORMAT (JSON ONLY, NO MARKDOWN TAGS LIKE \`\`\`json):
{
  "cv": {
    "personalInfo": { ... },
    "title": "...",
    "summary": "...",
    "skills": ["..."],
    "experience": [
      {
        "company": "...",
        "position": "...",
        "startDate": "...",
        "endDate": "...",
        "highlights": ["..."]
      }
    ],
    "projects": [ ... ],
    "certifications": [
      {
         "name": "...",
         "issuer": "...",
         "date": "..."
      }
    ],
    "education": [ ... ]
  },
  "coverLetter": {
    "content": "..."
  }
}
`;

  const userPrompt = `
System Instructions:\n${systemInstructions}

Job Description:\n${jdText}

Master Profile:\n${JSON.stringify(masterProfile, null, 2)}
`;

  const reqConfig = {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(reqConfig);
    const responseText = result.response.text();
    return applyTrackRules(JSON.parse(responseText), masterProfile, jdText);
  } catch (error) {
    if (error.status === 429 || error.message.includes('429')) {
      console.warn('Rate limit hit on gemini-2.5-flash! Falling back to gemini-1.5-flash...');
      try {
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const fallbackResult = await fallbackModel.generateContent(reqConfig);
        return applyTrackRules(JSON.parse(fallbackResult.response.text()), masterProfile, jdText);
      } catch (fallbackError) {
        console.error('Fallback Model also failed:', fallbackError);
        throw new Error('Google AI Free Tier Quota Exceeded. Please try again in 1 minute or upgrade your API Key.');
      }
    }
    console.error('Error in AI processing:', error);
    throw error;
  }
}
