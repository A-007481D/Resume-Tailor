import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { alignProfileToJD } from './utils/aiProcessor.js';
import { generatePDFs } from './utils/pdfBridge.js';
import { syncGitHubProjects, getGitHubRepos } from './utils/githubSync.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/generate', async (req, res) => {
    try {
        const { jdText } = req.body;

        if (!jdText) {
            return res.status(400).json({ error: 'Job Description is required' });
        }

        console.log('Reading Master Profile...');
        const masterProfileRaw = await fs.readFile(path.join(__dirname, 'data/master_profile.json'), 'utf8');
        const masterProfile = JSON.parse(masterProfileRaw);

        console.log('Aligning Profile to JD via AI...');
        const optimizedData = await alignProfileToJD(jdText, masterProfile);

        console.log('Generating PDFs...');
        const { cvPdf, clPdf } = await generatePDFs(optimizedData);

        console.log('Saving PDFs to public/output...');
        const outputDir = path.join(__dirname, 'public/output');
        await fs.mkdir(outputDir, { recursive: true });

        const cvPath = path.join(outputDir, 'cv.pdf');
        const clPath = path.join(outputDir, 'cover_letter.pdf');

        await fs.writeFile(cvPath, cvPdf);
        await fs.writeFile(clPath, clPdf);

        console.log('Finished Generation successfully.');
        res.json({
            success: true,
            cvUrl: '/output/cv.pdf',
            clUrl: '/output/cover_letter.pdf'
        });
    } catch (error) {
        console.error('Error in /api/generate:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

app.get('/api/github-repos', async (req, res) => {
    try {
        const repos = await getGitHubRepos(process.env.GITHUB_TOKEN, process.env.GITHUB_USERNAME);
        res.json({ success: true, repos });
    } catch (error) {
        console.error('Error fetching GitHub repos:', error);
        res.status(500).json({ error: error.message || 'Error fetching repositories' });
    }
});

app.post('/api/sync-projects', async (req, res) => {
    try {
        const { selectedRepos } = req.body;
        if (!selectedRepos || !Array.isArray(selectedRepos)) {
            return res.status(400).json({ error: 'Valid selectedRepos array is required.' });
        }

        console.log(`Starting GitHub Sync Process for ${selectedRepos.length} repos...`);
        const result = await syncGitHubProjects(process.env.GITHUB_TOKEN, process.env.GITHUB_USERNAME, selectedRepos);
        res.json(result);
    } catch (error) {
        console.error('Error in /api/sync-projects:', error);
        res.status(500).json({ error: error.message || 'Internal server error during sync' });
    }
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
    console.error('Server failed to start:', err);
});
