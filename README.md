# Viva Coach AI

## The Problem
Students know the material but panic during university vivas and oral examinations. When put on the spot by professors, even top-performing students freeze, struggle to articulate concepts concisely, and lose confidence. There is a lack of realistic, high-pressure practice environments that simulate strict university oral examinations with real-time feedback.

## Live Demo URL
- **Vercel Production Deployment:** [https://ai-viva-coach-zi5e.vercel.app/]*
- **AI Studio Interactive Preview:** Hosted live in Google AI Studio Build on port 3000.

## Key Features
1. **Multi-Subject Curriculum Support:** Practice oral examinations across 6 core computer science subjects: Theory of Automata (TOA), Human-Computer Interaction (HCI), Database Management Systems (DBMS), Object-Oriented Programming (OOP), Computer Networks (CN), and Data Structures & Algorithms (DSA).
2. **Real-Time Conceptual Question Generation:** Generates strict, high-intensity conceptual questions under 20 words tailored to your chosen subject.
3. **Interactive Text Q&A:** Practice answering high-pressure conceptual questions using focused text input to build articulation and theoretical mastery.
4. **Instant AI Grading & Diagnostics:** Evaluates student responses instantly using Google Gemini 1.5 Flash, providing a Score out of 10, a breakdown of missed theoretical concepts, and a 1-line actionable improvement tip.
5. **Final Diagnostic Report:** Summarizes overall performance across 5 rounds and compiles a priority list of "Weak Topics" to target before the actual university examination.
6. **Robust Offline & Fallback Engine:** Includes built-in conceptual questions and heuristic grading fallbacks to ensure zero downtime or crashes during network interruptions.

## How the AI Works + Show the 2 Prompts
Viva Coach AI utilizes Google Gemini 1.5 Flash via the `google-generativeai` library in Python to simulate both the strict university professor asking conceptual questions and the examiner grading answers.

### PROMPT 1: `QUESTION_GENERATOR`
Used to generate targeted, concise conceptual viva questions:
```text
You are a strict university professor. Subject: {subject}. Ask only 1 conceptual viva question. Keep it under 20 words. Output only the question.
```

### PROMPT 2: `FEEDBACK_GRADER`
Used to evaluate answers with strict diagnostic criteria:
```text
You are a viva examiner. Grade this student answer. Subject: {subject}. Question: {question}. Student Answer: {answer}.
Return ONLY a valid JSON object with keys: score (int 0-10), missing_concepts (list of strings), suggestion (string). Be strict but helpful.
```

## Tech Stack
- **Backend Framework:** Python 3.10+, Flask 3.0, Gunicorn, Werkzeug
- **AI Engine:** Google Gemini 1.5 Flash via `google-generativeai`
- **Frontend / Client:** HTML5, CSS3, Vanilla JavaScript 
- **Deployment & Serverless:** Vercel `@vercel/python` builder

## Screenshots
### 1. Subject Selection Dashboard
*Clean, high-contrast dashboard enabling seamless selection across 6 core university subjects.*

<img width="958" height="472" alt="image" src="https://github.com/user-attachments/assets/cdfa20a3-d938-4177-90d8-72bef3cfbc31" />

<img width="959" height="498" alt="image" src="https://github.com/user-attachments/assets/dd7aabfb-fe1d-4990-8d94-4926039e98c6" />



### 2. Live Viva Question & Interactive Q&A
*Presents 1 question at a time with clean, focused text response capture.*

<img width="959" height="440" alt="image" src="https://github.com/user-attachments/assets/f187f74e-fcba-4732-aa04-3f1246d8707c" />

<img width="957" height="462" alt="image" src="https://github.com/user-attachments/assets/7ca94b0d-b55b-45ba-8fa8-474ac914591d" />


### 3. Instant Grader & Final Diagnostic Report
*Instant 0-10 scoring, missing concept tags, and weak topic aggregation.*

<img width="959" height="497" alt="image" src="https://github.com/user-attachments/assets/cab49bc0-641a-4d6a-842e-bab7d51231ca" />

<img width="947" height="494" alt="image" src="https://github.com/user-attachments/assets/d79bfd99-be87-42e1-85ab-5651184afb32" />

<img width="959" height="469" alt="image" src="https://github.com/user-attachments/assets/050cfc0b-0d0e-4901-8a32-101a2b041c84" />

<img width="959" height="461" alt="image" src="https://github.com/user-attachments/assets/504cb260-3277-44ec-b3e6-68d441be7b95" />

<img width="956" height="477" alt="image" src="https://github.com/user-attachments/assets/47b19c5a-7057-49a0-a99b-16ad5fb61dea" />



## How to Run Locally
1. **Clone the repository and enter the directory:**
   ```bash
   git clone <repository_url>
   cd viva-coach-ai
   ```
2. **Create a Python virtual environment and install dependencies:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. **Configure your environment variables:**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY="your_google_gemini_api_key_here"
   SECRET_KEY="your_secure_flask_session_key"
   ```
4. **Start the Flask development server:**
   ```bash
   python3 app.py
   ```
5. **Open your browser:** Navigate to `http://localhost:5000` to start your viva training!

## How to Deploy on Vercel
Viva Coach AI is pre-configured with a `vercel.json` file and exports the WSGI `app` variable directly in `app.py`, ensuring a flawless zero-config serverless deployment.

1. **Install Vercel CLI (optional) or push to GitHub:**
   ```bash
   npm install -g vercel
   ```
2. **Deploy from command line:**
   ```bash
   vercel
   ```
3. **Configure Environment Variables in Vercel Dashboard:**
   - Go to your Project Settings ➔ Environment Variables on Vercel.
   - Add a new variable:
     - **Key:** `GEMINI_API_KEY`
     - **Value:** `<Your Google Gemini API Key>`
4. **Trigger Deployment:**
   - Vercel will automatically detect `vercel.json`, install `requirements.txt` using the `@vercel/python` builder, and bind `app.py` as the serverless entry point.
   - Your production Viva Coach AI application will be live in seconds without errors!
