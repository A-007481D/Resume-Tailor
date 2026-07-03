document.getElementById('submitBtn').addEventListener('click', async (e) => {
    e.preventDefault();

    const jdText = document.getElementById('jdText').value.trim();
    const language = document.getElementById('language').value;
    const submitBtn = document.getElementById('submitBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorBox = document.getElementById('errorBox');
    const resultsBox = document.getElementById('resultsBox');
    const editorSection = document.getElementById('editorSection');
    const jsonEditor = document.getElementById('jsonEditor');

    // Reset UI
    errorBox.classList.add('hidden');
    resultsBox.classList.add('hidden');
    editorSection.classList.add('hidden');

    if (!jdText) {
        errorBox.textContent = 'Please paste a job description before generating content.';
        errorBox.classList.remove('hidden');
        return;
    }

    submitBtn.disabled = true;
    loadingSpinner.classList.remove('hidden');

    try {
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jdText, language })
        });

        const data = await tryReadJson(response);

        if (!response.ok) {
            throw new Error(data?.error || 'Failed to generate content');
        }

        // Populate the editor and show it
        jsonEditor.value = JSON.stringify(data.optimizedData, null, 2);
        editorSection.classList.remove('hidden');
        jsonEditor.focus();

    } catch (err) {
        errorBox.textContent = getFriendlyRequestError(err, 'Failed to generate content');
        errorBox.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        loadingSpinner.classList.add('hidden');
    }
});

document.getElementById('renderPdfBtn').addEventListener('click', async () => {
    const renderPdfBtn = document.getElementById('renderPdfBtn');
    const renderSpinner = document.getElementById('renderSpinner');
    const errorBox = document.getElementById('errorBox');
    const resultsBox = document.getElementById('resultsBox');
    const jsonEditor = document.getElementById('jsonEditor');
    const language = document.getElementById('language').value;

    errorBox.classList.add('hidden');
    resultsBox.classList.add('hidden');
    renderPdfBtn.disabled = true;
    renderSpinner.classList.remove('hidden');

    try {
        // Parse the manually edited JSON
        let optimizedData;
        try {
            optimizedData = JSON.parse(jsonEditor.value);
        } catch (parseErr) {
            throw new Error('Invalid JSON format. Please correct syntax errors before rendering.');
        }

        const format = document.getElementById('aiFormat').value;
        const hideProjects = document.getElementById('aiHideProjects').checked;

        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ optimizedData, language, format, hideProjects })
        });

        const data = await tryReadJson(response);

        if (!response.ok) {
            throw new Error(data?.error || 'Failed to generate PDFs');
        }

        document.getElementById('cvDownload').href = data.cvUrl;
        document.getElementById('clDownload').href = data.clUrl;
        resultsBox.classList.remove('hidden');

        // Scroll to results
        resultsBox.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        errorBox.textContent = getFriendlyRequestError(err, 'Failed to generate PDFs');
        errorBox.classList.remove('hidden');
    } finally {
        renderPdfBtn.disabled = false;
        renderSpinner.classList.add('hidden');
    }
});

document.getElementById('syncBtn').addEventListener('click', async () => {
    const syncBtn = document.getElementById('syncBtn');
    const syncSpinner = document.getElementById('syncSpinner');
    const errorBox = document.getElementById('errorBox');

    errorBox.classList.add('hidden');
    syncBtn.disabled = true;
    syncSpinner.classList.remove('hidden');

    try {
        const response = await fetch('/api/github-repos');
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Failed to fetch repositories');

        const repoList = document.getElementById('repoList');
        repoList.innerHTML = '';

        data.repos.forEach(repo => {
            repoList.innerHTML += `
                <div class="p-3 flex items-start space-x-3 hover:bg-gray-50">
                    <div class="flex-shrink-0 mt-1">
                        <input type="checkbox" id="repo-${repo.name}" value="${repo.name}" class="repo-checkbox h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                    </div>
                    <div class="min-w-0 flex-1">
                        <label for="repo-${repo.name}" class="font-medium text-gray-900 cursor-pointer block">${repo.name}</label>
                        <p class="text-sm text-gray-500 truncate" title="${repo.description}">${repo.description || 'No description'}</p>
                        ${repo.language ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 mt-1">${repo.language}</span>` : ''}
                    </div>
                </div>
            `;
        });

        document.getElementById('repoModal').classList.remove('hidden');
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
    } finally {
        syncBtn.disabled = false;
        syncSpinner.classList.add('hidden');
    }
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('repoModal').classList.add('hidden');
});

document.getElementById('confirmSyncBtn').addEventListener('click', async () => {
    const confirmSyncBtn = document.getElementById('confirmSyncBtn');
    const modalSyncSpinner = document.getElementById('modalSyncSpinner');
    const errorBox = document.getElementById('errorBox');

    // Get all checked repos
    const checkboxes = document.querySelectorAll('.repo-checkbox:checked');
    const selectedRepos = Array.from(checkboxes).map(cb => cb.value);

    if (selectedRepos.length === 0) {
        alert('Please select at least one repository to sync.');
        return;
    }

    confirmSyncBtn.disabled = true;
    modalSyncSpinner.classList.remove('hidden');

    try {
        const response = await fetch('/api/sync-projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectedRepos })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to sync projects');

        document.getElementById('repoModal').classList.add('hidden');
        alert(`Successfully synced ${data.totalSynced} projects to your Master Profile!`);
    } catch (err) {
        alert(`Sync Error: ${err.message}`);
    } finally {
        confirmSyncBtn.disabled = false;
        modalSyncSpinner.classList.add('hidden');
    }
});

function getFriendlyRequestError(err, fallbackMessage) {
    const message = err?.message || '';
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        return 'Cannot reach the backend server. Ensure `node server.js` is running and open the app from the same host/port.';
    }
    return message || fallbackMessage;
}

function initLanguageSelector() {
    const languageSelect = document.getElementById('language');
    const languageButtons = Array.from(document.querySelectorAll('[data-language]'));

    if (!languageSelect || languageButtons.length === 0) {
        return;
    }

    const applyActiveState = (value) => {
        languageButtons.forEach((button) => {
            const isActive = button.dataset.language === value;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    };

    languageButtons.forEach((button) => {
        button.addEventListener('click', () => {
            languageSelect.value = button.dataset.language;
            applyActiveState(languageSelect.value);
        });
    });

    applyActiveState(languageSelect.value || 'en');
}

async function tryReadJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

initLanguageSelector();
initModeToggle();
initDirectLanguageSelector();
initFormatSelector('aiFormatToggle', 'aiFormat');
initFormatSelector('directFormatToggle', 'directFormat');

// Mode toggle: switch between AI Generate and Direct JSON Render
function initModeToggle() {
    const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));
    const aiSection = document.getElementById('generateForm');
    const directSection = document.getElementById('directRenderSection');
    const editorSection = document.getElementById('editorSection');
    const resultsBox = document.getElementById('resultsBox');
    const errorBox = document.getElementById('errorBox');

    modeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;

            // Update active states
            modeButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');

            // Hide shared sections
            editorSection.classList.add('hidden');
            resultsBox.classList.add('hidden');
            errorBox.classList.add('hidden');

            if (mode === 'ai') {
                aiSection.classList.remove('hidden');
                directSection.classList.add('hidden');
            } else {
                aiSection.classList.add('hidden');
                directSection.classList.remove('hidden');
                
                const directJsonInput = document.getElementById('directJsonInput');
                if (!directJsonInput.value.trim()) {
                    directJsonInput.value = JSON.stringify(getTemplateJson(), null, 2);
                }
            }
        });
    });
}

// Direct language selector (mirrors the main one)
function initDirectLanguageSelector() {
    const languageSelect = document.getElementById('directLanguage');
    const languageButtons = Array.from(document.querySelectorAll('#directLanguageToggle [data-language]'));

    if (!languageSelect || languageButtons.length === 0) return;

    const applyActiveState = (value) => {
        languageButtons.forEach((button) => {
            const isActive = button.dataset.language === value;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    };

    languageButtons.forEach((button) => {
        button.addEventListener('click', () => {
            languageSelect.value = button.dataset.language;
            applyActiveState(languageSelect.value);
        });
    });

    applyActiveState(languageSelect.value || 'en');
}

function initFormatSelector(toggleId, inputId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    
    if (!input || !toggle) return;
    
    const buttons = Array.from(toggle.querySelectorAll('[data-format]'));

    const applyActiveState = (value) => {
        buttons.forEach((button) => {
            const isActive = button.dataset.format === value;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    };

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            input.value = button.dataset.format;
            applyActiveState(input.value);
        });
    });

    applyActiveState(input.value || '');
}

// Direct Render button handler
document.getElementById('directRenderBtn').addEventListener('click', async () => {
    const directRenderBtn = document.getElementById('directRenderBtn');
    const directRenderSpinner = document.getElementById('directRenderSpinner');
    const errorBox = document.getElementById('errorBox');
    const resultsBox = document.getElementById('resultsBox');
    const directJsonInput = document.getElementById('directJsonInput');
    const language = document.getElementById('directLanguage').value;

    errorBox.classList.add('hidden');
    resultsBox.classList.add('hidden');
    directRenderBtn.disabled = true;
    directRenderSpinner.classList.remove('hidden');

    try {
        const rawInput = directJsonInput.value.trim();
        if (!rawInput) {
            throw new Error('Please paste your JSON data before rendering.');
        }

        let optimizedData;
        try {
            optimizedData = JSON.parse(rawInput);
        } catch (parseErr) {
            throw new Error('Invalid JSON format. Please check your syntax and try again.');
        }

        if (!optimizedData.cv) {
            throw new Error('JSON must contain a "cv" key with your CV data.');
        }

        const format = document.getElementById('directFormat').value;
        const hideProjects = document.getElementById('directHideProjects').checked;

        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ optimizedData, language, format, hideProjects })
        });

        const data = await tryReadJson(response);

        if (!response.ok) {
            throw new Error(data?.error || 'Failed to generate PDFs');
        }

        document.getElementById('cvDownload').href = data.cvUrl;
        document.getElementById('clDownload').href = data.clUrl;
        resultsBox.classList.remove('hidden');
        resultsBox.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        errorBox.textContent = getFriendlyRequestError(err, 'Failed to render PDFs');
        errorBox.classList.remove('hidden');
    } finally {
        directRenderBtn.disabled = false;
        directRenderSpinner.classList.add('hidden');
    }
});

function getTemplateJson() {
    return {
        "cv": {
            "personalInfo": {
                "name": "Jane Doe",
                "email": "jane@example.com",
                "phone": "+1 234 567 8900",
                "location": "New York, USA",
                "linkedin": "linkedin.com/in/janedoe",
                "github": "github.com/janedoe",
                "summary": "Experienced software engineer with a strong background in building scalable web applications and distributed systems."
            },
            "title": "SENIOR SOFTWARE ENGINEER",
            "skills": [
                {
                    "category": "Core Technologies",
                    "items": ["JavaScript", "TypeScript", "Python", "Go", "Java"]
                },
                {
                    "category": "Cloud & Infrastructure",
                    "items": ["AWS", "Docker", "Kubernetes", "Terraform"]
                }
            ],
            "experience": [
                {
                    "company": "Tech Corp | New York",
                    "position": "Senior Software Engineer",
                    "startDate": "Jan 2021",
                    "endDate": "Present",
                    "highlights": [
                        "Architected and deployed a microservices-based backend that improved system throughput by 40%.",
                        "Led a team of 5 engineers to deliver critical features ahead of schedule."
                    ]
                }
            ],
            "projects": [
                {
                    "name": "Open Source Analytics",
                    "description": "A real-time analytics dashboard.",
                    "technologies": ["React", "Node.js", "Redis"],
                    "highlights": [
                        "Handled over 10,000 concurrent websocket connections."
                    ]
                }
            ],
            "education": [
                {
                    "degree": "B.S. Computer Science",
                    "institution": "State University",
                    "graduationYear": "2016 - 2020"
                }
            ],
            "certifications": [
                {
                    "name": "AWS Certified Solutions Architect",
                    "issuer": "Amazon Web Services",
                    "date": "2023"
                }
            ]
        },
        "coverLetter": {
            "recipientName": "Hiring Manager",
            "recipientTitle": "Engineering Team",
            "company": "Innovative Startups Inc.",
            "companyAddress": "San Francisco, CA",
            "subject": "Application for Senior Software Engineer",
            "salutation": "Dear Hiring Manager,",
            "content": "I am writing to express my strong interest in the Senior Software Engineer position. With my background in distributed systems and cloud architecture, I believe I can make an immediate impact on your team.",
            "closingPhrase": "Sincerely,",
            "signatureName": "Jane Doe",
            "signatureTitle": "Software Engineer"
        },
        "language": "en"
    };
}

