export const SUPPORTED_LANGUAGES = ['en', 'fr'];

const LOCALE_CONFIG = {
    en: {
        htmlLang: 'en',
        dateLocale: 'en-US',
        cv: {
            technicalSkills: 'Technical Skills',
            featuredProjects: 'Featured Projects',
            experience: 'Experience',
            education: 'Education',
            certifications: 'Certifications',
            coreTechnologies: 'Core Technologies',
            stack: 'Stack',
            qrLabel: 'Portfolio',
            defaultTitle: 'Software Engineer'
        },
        coverLetter: {
            subjectLabel: 'Subject:',
            defaultRecipientName: 'Hiring Manager',
            defaultSubjectPrefix: 'Application for',
            defaultSalutation: 'Dear Hiring Manager,',
            defaultClosingPhrase: 'Sincerely,'
        }
    },
    fr: {
        htmlLang: 'fr',
        dateLocale: 'fr-FR',
        cv: {
            technicalSkills: 'Competences techniques',
            featuredProjects: 'Projets principaux',
            experience: 'Experience',
            education: 'Formation',
            certifications: 'Certifications',
            coreTechnologies: 'Technologies principales',
            stack: 'Stack',
            qrLabel: 'Portfolio',
            defaultTitle: 'Ingenieur logiciel'
        },
        coverLetter: {
            subjectLabel: 'Objet :',
            defaultRecipientName: 'Madame, Monsieur',
            defaultSubjectPrefix: 'Candidature pour',
            defaultSalutation: 'Madame, Monsieur,',
            defaultClosingPhrase: 'Cordialement,'
        }
    }
};

export function normalizeLanguage(language) {
    const normalized = String(language || '').trim().toLowerCase();
    return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : 'en';
}

export function getLocaleConfig(language) {
    return LOCALE_CONFIG[normalizeLanguage(language)];
}

