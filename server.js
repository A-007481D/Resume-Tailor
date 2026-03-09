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

app.post('/api/generate-content', async (req, res) => {
    try {
        const { jdText } = req.body;

        if (!jdText) {
            return res.status(400).json({ error: 'Job description text is required' });
        }

        console.log('Received JD. Processing through AI...');
        const masterPath = path.join(__dirname, 'data/master_profile.json');

        let masterProfile;
        try {
            const masterRaw = await fs.readFile(masterPath, 'utf8');
            masterProfile = JSON.parse(masterRaw);
        } catch (err) {
            throw new Error(`Failed to load master_profile.json. Ensure it exists in data/: ${err.message}`);
        }

        const optimizedData = await alignProfileToJD(jdText, masterProfile);

        console.log('AI Processing complete. Sending content to frontend for review.');
        res.json({ success: true, optimizedData });

    } catch (error) {
        console.error('Error in /api/generate-content:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { optimizedData } = req.body;

        if (!optimizedData) {
            return res.status(400).json({ error: 'Optimized data is required to render PDFs' });
        }

        console.log('Rendering PDFs with Puppeteer...');
        const { cvPdf, clPdf } = await generatePDFs(optimizedData);

        const outputDir = path.join(__dirname, 'public/output');
        await fs.mkdir(outputDir, { recursive: true });

        const cvPath = path.join(outputDir, 'cv.pdf');
        const clPath = path.join(outputDir, 'cover_letter.pdf');

        await fs.writeFile(cvPath, cvPdf);
        await fs.writeFile(clPath, clPdf);

        console.log('PDF Generation successfully complete.');
        res.json({
            success: true,
            cvUrl: '/output/cv.pdf',
            clUrl: '/output/cover_letter.pdf'
        });

    } catch (error) {
        console.error('Error in /api/generate-pdf:', error);
        res.status(500).json({ error: error.message || 'Internal server error during PDF generation' });
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
