import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatExperience(experiences) {
    return experiences.map(exp => `
                <div class="entry">
                    <div class="entry-header">
                        <span>${exp.position}</span>
                        <span>${exp.startDate} – ${exp.endDate}</span>
                    </div>
                    <div class="entry-sub">
                        ${exp.company}
                    </div>
                    <div class="content-block">
                        <ul>
                            ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
                        </ul>
                    </div>
                </div>
  `).join('');
}

function formatProjects(projects) {
    return projects.map(proj => `
                <div class="entry">
                    <div class="entry-header">
                        <span>${proj.name}</span>
                    </div>
                    ${proj.description ? `<div class="entry-sub">${proj.description}</div>` : ''}
                    <div class="content-block">
                        <ul>
                            ${proj.highlights.map(h => `<li>${h}</li>`).join('')}
                        </ul>
                        ${proj.technologies && proj.technologies.length > 0 ? `
                        <div class="tech-stack">
                            <strong>Stack:</strong> ${proj.technologies.join(', ')}
                        </div>` : ''}
                    </div>
                </div>
  `).join('');
}

function formatEducation(education) {
    return education.map(edu => `
                <div class="entry">
                    <div class="entry-header">
                        <span>${edu.institution}</span>
                        <span>${edu.graduationYear}</span>
                    </div>
                    <div class="entry-sub">
                        ${edu.degree}
                    </div>
                </div>
  `).join('');
}

function formatSkills(skills) {
    if (!skills || skills.length === 0) return '';
    return `<span class="skill-label">Core Technologies:</span> ${skills.join(', ')}`;
}

function formatCoverLetterContent(content) {
    return content.split('\n\n').map(p => {
        const parts = p.split('\n').filter(x => x.trim().length > 0);
        if (parts.length > 1) {
            return parts.map(subP => `<p>${subP}</p>`).join('');
        }
        return `<p>${p}</p>`;
    }).join('');
}

let browserInstance = null;

export async function generatePDFs(optimizedData) {
    if (!browserInstance) {
        console.log("Launching Puppeteer browser instance...");
        browserInstance = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    }
    const browser = browserInstance;
    try {
        const cvTemplatePath = path.join(__dirname, '../templates/cv.html');
        const clTemplatePath = path.join(__dirname, '../templates/cover_letter.html');

        let cvHtml = await fs.readFile(cvTemplatePath, 'utf8');
        let clHtml = await fs.readFile(clTemplatePath, 'utf8');

        const { cv, coverLetter } = optimizedData;
        const { personalInfo } = cv;

        const githubShort = personalInfo.github ? personalInfo.github.replace(/^https?:\/\//, '').replace(/^www\./, '') : '';
        const linkedinShort = personalInfo.linkedin ? personalInfo.linkedin.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^linkedin\.com\/in\//, '') : '';

        const title = cv.title || 'Software Engineer';

        // Inject CV Data
        cvHtml = cvHtml
            .replace(/{{name}}/g, personalInfo.name)
            .replace(/{{title}}/g, title)
            .replace(/{{email}}/g, personalInfo.email)
            .replace(/{{phone}}/g, personalInfo.phone)
            .replace(/{{location}}/g, personalInfo.location)
            .replace(/{{linkedin}}/g, personalInfo.linkedin)
            .replace(/{{linkedin_short}}/g, linkedinShort)
            .replace(/{{github}}/g, personalInfo.github)
            .replace(/{{github_short}}/g, githubShort)
            .replace(/{{skills}}/g, formatSkills(cv.skills || []))
            .replace(/{{experience}}/g, formatExperience(cv.experience || []))
            .replace(/{{projects}}/g, formatProjects(cv.projects || []))
            .replace(/{{education}}/g, formatEducation(cv.education || []));

        let contentToInject = coverLetter.content || '';
        if (!contentToInject.includes('<p>')) {
            contentToInject = formatCoverLetterContent(contentToInject);
        }

        // Inject Cover Letter Data
        clHtml = clHtml
            .replace(/{{name}}/g, personalInfo.name)
            .replace(/{{email}}/g, personalInfo.email)
            .replace(/{{phone}}/g, personalInfo.phone)
            .replace(/{{location}}/g, personalInfo.location)
            .replace(/{{content}}/g, contentToInject);

        const cvPage = await browser.newPage();
        await cvPage.setContent(cvHtml, { waitUntil: 'networkidle0' });
        const cvPdfBuffer = await cvPage.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });

        const clPage = await browser.newPage();
        await clPage.setContent(clHtml, { waitUntil: 'networkidle0' });
        const clPdfBuffer = await clPage.pdf({ format: 'A4', printBackground: true });

        return {
            cvPdf: cvPdfBuffer,
            clPdf: clPdfBuffer
        };
    } catch (error) {
        console.error("Error generating PDFs:", error);
        throw error;
    }
}
