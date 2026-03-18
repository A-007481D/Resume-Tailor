# Resume Tailor 🚀

**An AI-Powered, GitHub-Synced Resume & Cover Letter Generator.**

Resume Tailor solves the tedious process of writing resumes and cover letters tailored to specific Job Descriptions (JDs). By acting as a single source of truth for your professional history (the *Master Profile*), it uses Google's Gemini 2.5 Flash AI to intelligently filter your skills, extract relevant projects, and rewrite your bullet points to perfectly align with the job you are applying for. 

It then automatically renders a highly-professional, ATS-friendly PDF CV and Cover Letter right from your browser. 

Additionally, it features an **Automated GitHub Sync Engine** that connects to your GitHub account, analyzes your repositories, and writes professional bullet points for your projects, injecting them straight into your master profile.

## 🌟 Key Features

*   **Single Source of Truth**: Maintain one `master_profile.json` with all your experience, education, and skills.
*   **AI-Powered Tailoring**: Employs Gemini 2.5 Flash to ruthlessly align your profile to any pasted Job Description. It strictly enforces an anti-hallucination policy—if a skill isn't in your JSON, it won't appear on the CV.
*   **Automated GitHub Sync Engine**: Select your best GitHub repositories, and the AI will automatically read their `README.md` files, extract the core tech stack, and generate 3 impactful resume bullet points for each, injecting them seamlessly into your profile.
*   **Instant PDF Rendering**: Uses an internal Puppeteer (headless Chromium) bridge to quickly render beautifully designed HTML templates into crisp, professional PDFs.
*   **100% Local & Private**: No third-party SaaS platforms storing your data. Your resume lives on your machine.

## 🛠️ Tech Stack

*   **Backend**: Node.js, Express.js
*   **AI Engine**: `@google/generative-ai` (Gemini 2.5 Flash)
*   **PDF Generation**: `puppeteer`
*   **Frontend**: Vanilla HTML/JS styled with Tailwind CSS (CDN)

## 🚀 Getting Started

### Prerequisites

*   **Node.js** (v18+ recommended)
*   **Make** (optional, but convenient for running commands)
*   A **Gemini API Key** (Get one from [Google AI Studio](https://aistudio.google.com/))
*   A **GitHub Personal Access Token (PAT)** (for the GitHub Sync feature)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/Resume-Tailor.git
cd Resume-Tailor
make install   # Or simply: npm install
```

### 2. Configuration

1.  Create a `.env` file in the root directory (you can copy `.env.example` if available).
2.  Add your API keys to the `.env` file:

```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key_here
GITHUB_TOKEN=your_github_pat_here
GITHUB_USERNAME=your_github_username_here
```

### 3. Set Up Your Master Profile

Your data lives in `data/master_profile.json`. 
Because this contains private data, we use a template system for version control.

1.  Copy the provided template:
    ```bash
    cp data/master_profile.template.json data/master_profile.json
    ```
2.  Open `data/master_profile.json` and fill in your actual personal info, skills, education, and experience.

### 3.1 Profile Photo for CV

The CV header photo is now loaded automatically from the project root at generation time.

1. Place your current photo in the root folder as one of these names:
   - `proMoi.png` (preferred)
   - `proMoi.jpg`
   - `proMoi.jpeg`
   - `proMoi.webp`
2. If multiple files exist, the first match in the order above is used.
3. To update your CV photo, replace that file and generate PDFs again.

If no photo file is found, the CV keeps the gray placeholder box.

### 4. Running the Application

Start the server using the included Makefile:

```bash
make start
```
*(Alternatively, you can use `make dev` to run it in watch mode, or just `node server.js`).*

Open your browser and navigate to: **[http://localhost:4000](http://localhost:4000)**

## 💡 How to Use

### Syncing Projects from GitHub
1. Click the **"Sync GitHub Projects"** button on the UI.
2. A sleek modal will appear listing all your public and private repositories.
3. Select the repositories you want to include on your resume.
4. Click **"Sync Selected"**. The AI will read the code, write the professional bullets, and save them straight to `master_profile.json`!

### Generating Tailored PDFs
1. Find a job posting you like on LinkedIn or a company website.
2. Copy the *entire* Job Description (responsibilities, requirements, everything).
3. Paste it directly into the text area on the web app.
4. Click **"Generate PDFs"**.
5. The AI will cross-reference your Master Profile with the JD, tailor the content, and generate your CV and Cover Letter. Click the links to download!

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
