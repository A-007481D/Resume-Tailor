import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { getLocaleConfig, normalizeLanguage } from './i18n.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PHOTO_FILE_CANDIDATES = ['proMoi.png', 'proMoi.jpg', 'proMoi.jpeg', 'proMoi.webp'];
const IMAGE_MIME_BY_EXTENSION = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
};

const REQUIRED_CERTIFICATIONS = [
    { name: 'AWS Certified Cloud Practitioner', issuer: 'AWS', date: '' },
    { name: 'AWS Architecting Knowledge', issuer: 'AWS', date: '' }
];

const COVER_LETTER_LIMITS = {
    maxParagraphs: 6,
    maxWords: 420,
    maxChars: 2600,
    maxInlineFieldChars: 120,
    maxAddressChars: 160,
    maxSubjectChars: 140
};

async function getProfilePhotoSrc() {
    for (const fileName of PHOTO_FILE_CANDIDATES) {
        const photoPath = path.join(ROOT_DIR, fileName);
        try {
            const photoBuffer = await fs.readFile(photoPath);
            const ext = path.extname(fileName).toLowerCase();
            const mimeType = IMAGE_MIME_BY_EXTENSION[ext] || 'image/png';
            return `data:${mimeType};base64,${photoBuffer.toString('base64')}`;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    console.warn(`No profile photo found. Checked: ${PHOTO_FILE_CANDIDATES.join(', ')}`);
    return '';
}

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

function formatProjects(projects, labels) {
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
                            <strong>${labels.stack}:</strong> ${proj.technologies.join(', ')}
                        </div>` : ''}
                    </div>
                </div>
  `).join('');
}

function formatEducation(education) {
    if (!education || education.length === 0) return '';
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

function normalizeCertification(certification) {
    if (typeof certification === 'string') {
        return { name: certification.trim(), issuer: '', date: '' };
    }

    return {
        name: String(certification?.name || '').trim(),
        issuer: String(certification?.issuer || '').trim(),
        date: String(certification?.date || '').trim()
    };
}

function ensureRequiredCertifications(certifications) {
    const normalized = Array.isArray(certifications)
        ? certifications.map(normalizeCertification).filter(cert => cert.name.length > 0)
        : [];

    const existingNames = new Set(normalized.map(cert => cert.name.toLowerCase()));

    for (const requiredCert of REQUIRED_CERTIFICATIONS) {
        if (!existingNames.has(requiredCert.name.toLowerCase())) {
            normalized.push(requiredCert);
        }
    }

    return normalized;
}

function formatCertifications(certifications, labels) {
    const safeCertifications = ensureRequiredCertifications(certifications);
    if (safeCertifications.length === 0) return '';

    const listHtml = safeCertifications.map(cert => `
                        <li>
                            <strong>${cert.name}</strong>${cert.issuer ? ` – ${cert.issuer}` : ''}${cert.date ? ` (${cert.date})` : ''}
                        </li>
  `).join('');

    return `
        <section>
            <h2>${labels.certifications}</h2>
            <div class="content-block">
                <ul>
${listHtml}
                </ul>
            </div>
        </section>
    `;
}

function formatSkills(skills, labels) {
    if (!skills || skills.length === 0) return '';
    return `<span class="skill-label">${labels.coreTechnologies}:</span> ${skills.join(', ')}`;
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

function normalizeInlineText(value, maxLength = COVER_LETTER_LIMITS.maxInlineFieldChars) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3).trim()}...` : normalized;
}

function normalizeCoverLetterBody(content) {
    const asText = String(content || '')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\s*\/p\s*>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!asText) {
        return '';
    }

    const paragraphs = asText
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(Boolean)
        .slice(0, COVER_LETTER_LIMITS.maxParagraphs);

    const finalParagraphs = [];
    let wordCount = 0;
    let charCount = 0;

    for (const paragraph of paragraphs) {
        const words = paragraph.split(/\s+/).filter(Boolean);

        if (wordCount >= COVER_LETTER_LIMITS.maxWords || charCount >= COVER_LETTER_LIMITS.maxChars) {
            break;
        }

        const remainingWords = COVER_LETTER_LIMITS.maxWords - wordCount;
        const slicedWords = words.slice(0, remainingWords);
        let nextParagraph = slicedWords.join(' ');

        const remainingChars = COVER_LETTER_LIMITS.maxChars - charCount;
        if (nextParagraph.length > remainingChars) {
            nextParagraph = nextParagraph.slice(0, Math.max(0, remainingChars - 1)).trim();
        }

        if (!nextParagraph) {
            break;
        }

        const wasTrimmed = nextParagraph.length < paragraph.length;
        finalParagraphs.push(wasTrimmed ? `${nextParagraph}...` : nextParagraph);
        wordCount += nextParagraph.split(/\s+/).filter(Boolean).length;
        charCount += nextParagraph.length;

        if (wasTrimmed) {
            break;
        }
    }

    return finalParagraphs.join('\n\n');
}

function buildSignatureImageBlock(signatureImage) {
    const safeSrc = String(signatureImage || '').trim();
    if (!safeSrc) return '';
    return `<img class="signature-image" src="${safeSrc}" alt="Signature" />`;
}

let browserInstance = null;

export async function generatePDFs(optimizedData, options = {}) {
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
        const safeCoverLetter = coverLetter && typeof coverLetter === 'object' ? coverLetter : {};
        const { personalInfo } = cv;
        const outputLanguage = normalizeLanguage(options.language || optimizedData?.language);
        const localeConfig = getLocaleConfig(outputLanguage);
        const cvLabels = localeConfig.cv;
        const clLabels = localeConfig.coverLetter;
        const photoSrc = await getProfilePhotoSrc();

        const githubShort = personalInfo.github ? personalInfo.github.replace(/^https?:\/\//, '').replace(/^www\./, '') : '';
        const linkedinShort = personalInfo.linkedin ? personalInfo.linkedin.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^linkedin\.com\/in\//, '') : '';

        const title = cv.title || cvLabels.defaultTitle;

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
            .replace(/{{photoSrc}}/g, photoSrc)
            .replace(/{{label_technical_skills}}/g, cvLabels.technicalSkills)
            .replace(/{{label_featured_projects}}/g, cvLabels.featuredProjects)
            .replace(/{{label_experience}}/g, cvLabels.experience)
            .replace(/{{label_education}}/g, cvLabels.education)
            .replace(/{{qr_label}}/g, cvLabels.qrLabel)
            .replace(/{{skills}}/g, formatSkills(cv.skills || [], cvLabels))
            .replace(/{{experience}}/g, formatExperience(cv.experience || []))
            .replace(/{{projects}}/g, formatProjects(cv.projects || [], cvLabels))
            .replace(/{{certifications}}/g, formatCertifications(cv.certifications || [], cvLabels))
            .replace(/{{education}}/g, formatEducation(cv.education || []));

        const normalizedBody = normalizeCoverLetterBody(safeCoverLetter.content || '');
        const contentToInject = formatCoverLetterContent(normalizedBody);

        const recipientName = normalizeInlineText(safeCoverLetter.recipientName || clLabels.defaultRecipientName);
        const recipientTitle = normalizeInlineText(safeCoverLetter.recipientTitle || '');
        const company = normalizeInlineText(safeCoverLetter.company || '');
        const companyAddress = normalizeInlineText(
            safeCoverLetter.companyAddress || '',
            COVER_LETTER_LIMITS.maxAddressChars
        );
        const subject = normalizeInlineText(
            safeCoverLetter.subject || `${clLabels.defaultSubjectPrefix} ${title}`,
            COVER_LETTER_LIMITS.maxSubjectChars
        );
        const salutation = normalizeInlineText(
            safeCoverLetter.salutation || clLabels.defaultSalutation
        );
        const closingPhrase = normalizeInlineText(safeCoverLetter.closingPhrase || clLabels.defaultClosingPhrase);
        const signatureName = normalizeInlineText(safeCoverLetter.signatureName || personalInfo.name);
        const signatureTitle = normalizeInlineText(safeCoverLetter.signatureTitle || title);
        const signatureNote = normalizeInlineText(
            safeCoverLetter.signatureNote || `${personalInfo.email} | ${personalInfo.phone}`,
            COVER_LETTER_LIMITS.maxAddressChars
        );
        const signatureImageBlock = buildSignatureImageBlock(safeCoverLetter.signatureImage);
        const formattedDate = normalizeInlineText(
            safeCoverLetter.date || formatCurrentDate(outputLanguage),
            COVER_LETTER_LIMITS.maxInlineFieldChars
        );

        // Inject Cover Letter Data
        clHtml = clHtml
            .replace(/{{name}}/g, personalInfo.name)
            .replace(/{{title}}/g, title)
            .replace(/{{email}}/g, personalInfo.email)
            .replace(/{{phone}}/g, personalInfo.phone)
            .replace(/{{location}}/g, personalInfo.location)
            .replace(/{{date}}/g, formattedDate)
            .replace(/{{recipient_name}}/g, recipientName)
            .replace(/{{recipient_title}}/g, recipientTitle)
            .replace(/{{company}}/g, company)
            .replace(/{{company_address}}/g, companyAddress)
            .replace(/{{subject}}/g, subject)
            .replace(/{{subject_label}}/g, clLabels.subjectLabel)
            .replace(/{{salutation}}/g, salutation)
            .replace(/{{content}}/g, contentToInject)
            .replace(/{{closing_phrase}}/g, closingPhrase)
            .replace(/{{signature_image_block}}/g, signatureImageBlock)
            .replace(/{{signature_name}}/g, signatureName)
            .replace(/{{signature_title}}/g, signatureTitle)
            .replace(/{{signature_note}}/g, signatureNote);

        const cvPage = await browser.newPage();
        await cvPage.setContent(cvHtml, { waitUntil: 'networkidle0' });
        const cvPdfBuffer = await cvPage.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });

        const clPage = await browser.newPage();
        await clPage.setContent(clHtml, { waitUntil: 'networkidle0' });
        const clPdfBuffer = await clPage.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });

        return {
            cvPdf: cvPdfBuffer,
            clPdf: clPdfBuffer
        };
    } catch (error) {
        console.error("Error generating PDFs:", error);
        throw error;
    }
}

function formatCurrentDate(language = 'en') {
    const locale = getLocaleConfig(language).dateLocale;
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date());
}
