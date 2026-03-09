import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getGitHubRepos(githubToken, username) {
    if (!githubToken || !username) {
        throw new Error('GitHub Token and Username are required.');
    }
    const reposRes = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator`, {
        headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!reposRes.ok) throw new Error(`Failed to fetch repositories`);

    let repos = await reposRes.json();
    // Filter out forks, but allow repos without descriptions so user sees everything to choose from
    return repos.filter(repo => !repo.fork).map(r => ({
        name: r.name,
        full_name: r.full_name,
        description: r.description,
        language: r.language
    }));
}

export async function syncGitHubProjects(githubToken, username, selectedRepos = []) {
    if (!githubToken || !username) {
        throw new Error('GitHub Token and Username are required for syncing.');
    }

    if (!process.env.GEMINI_API_KEY) {
        throw new Error('Gemini API key is required to analyze GitHub projects.');
    }

    if (selectedRepos.length === 0) {
        return { success: true, totalSynced: 0, message: "No repositories selected." };
    }

    console.log(`Fetching repositories for ${username}...`);
    // 1. Fetch Repos from GitHub
    const reposRes = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator`, {
        headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!reposRes.ok) {
        throw new Error(`Failed to fetch repositories: ${reposRes.statusText}`);
    }

    let repos = await reposRes.json();

    // Filter out forks, and MUST be in the selectedRepos array
    repos = repos.filter(repo => !repo.fork && selectedRepos.includes(repo.name));

    console.log(`Found ${repos.length} eligible repositories. Processing...`);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const newProjects = [];

    // 2. Process repos concurrently (batch of 5 at a time to prevent rate limits)
    const batchSize = 5;
    for (let i = 0; i < repos.length; i += batchSize) {
        const batch = repos.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(repos.length / batchSize)}...`);

        const batchPromises = batch.map(async (repo) => {
            try {
                // Fetch Languages
                const langRes = await fetch(repo.languages_url, {
                    headers: { 'Authorization': `token ${githubToken}` }
                });
                const languages = await langRes.json();
                const techStack = Object.keys(languages);

                if (techStack.length === 0) return null; // Skip if no code

                // Fetch README
                let readmeContent = '';
                const readmeRes = await fetch(`https://api.github.com/repos/${repo.full_name || username + '/' + repo.name}/readme`, {
                    headers: {
                        'Authorization': `token ${githubToken}`,
                        'Accept': 'application/vnd.github.v3.raw'
                    }
                });

                if (readmeRes.ok) {
                    readmeContent = await readmeRes.text();
                } else {
                    readmeContent = repo.description;
                }

                // AI Analysis
                const prompt = `
You are an expert technical recruiter analyzing a candidate's GitHub project to create a resume entry.

Project Name: ${repo.name}
Description: ${repo.description}
Detected Technologies: ${techStack.join(', ')}

README CONTENT:
${readmeContent.substring(0, 3000)} // Truncating to avoid massive token usage

TASK:
Return a JSON object representing this project. 
Extract 3 impactful, action-oriented bullet points outlining the engineering achievements, architecture, or features based on the README. 
Filter the technologies to only include the core, most relevant stack.

OUTPUT FORMAT (JSON ONLY, NO MARKDOWN TAGS):
{
  "name": "...", 
  "description": "...", 
  "technologies": ["...", "..."],
  "highlights": [
    "...",
    "...",
    "..."
  ]
}
                `;

                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        responseMimeType: "application/json",
                    }
                });

                const parsedProject = JSON.parse(result.response.text());

                if (parsedProject.name.toLowerCase() === repo.name.toLowerCase()) {
                    parsedProject.name = repo.name.replace(/-/g, ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase()); // Title Case
                }

                return parsedProject;
            } catch (err) {
                console.error(`Failed to process repository ${repo.name}:`, err.message);
                return null;
            }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(r => r !== null);
        newProjects.push(...validResults);
    }

    console.log(`Successfully generated ${newProjects.length} projects. Updating Master Profile...`);

    // 4. Update Master Profile
    const masterPath = path.join(__dirname, '../data/master_profile.json');
    const masterRaw = await fs.readFile(masterPath, 'utf8');
    const masterProfile = JSON.parse(masterRaw);

    // Completely replace or append? We will intelligently merge.
    // If a project with the same generated name (or similar) exists, we update it, otherwise append.
    newProjects.forEach(newProj => {
        const existingIndex = masterProfile.projects.findIndex(p => p.name.toLowerCase() === newProj.name.toLowerCase());
        if (existingIndex !== -1) {
            masterProfile.projects[existingIndex] = newProj; // Update
        } else {
            masterProfile.projects.push(newProj); // Append
        }
    });

    await fs.writeFile(masterPath, JSON.stringify(masterProfile, null, 2));

    return {
        success: true,
        totalSynced: newProjects.length
    };
}
