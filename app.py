import os
import json
import re
from flask import Flask, render_template, request, session, redirect, url_for, jsonify
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask App
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "viva_coach_ai_secret_key_production_2026")

# Configure Gemini AI via google-generativeai library
try:
    import google.generativeai as genai
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
except ImportError:
    genai = None

# AI PROMPTS AS SPECIFIED IN REQUIREMENTS
QUESTION_GENERATOR = "You are a strict university professor. Subject: {subject}. Ask only 1 conceptual viva question. Keep it under 20 words. Output only the question."

FEEDBACK_GRADER = "You are a viva examiner. Grade this student answer. Subject: {subject}. Question: {question}. Student Answer: {answer}.\nReturn ONLY a valid JSON object with keys: score (int 0-10), missing_concepts (list of strings), suggestion (string). Be strict but helpful."

# Subject definitions and high-quality conceptual fallback questions
SUBJECTS = {
    "TOA": "Theory of Automata",
    "HCI": "Human-Computer Interaction",
    "DBMS": "Database Management Systems",
    "OOP": "Object-Oriented Programming",
    "CN": "Computer Networks",
    "DSA": "Data Structures & Algorithms"
}

FALLBACK_QUESTIONS = {
    "TOA": [
        "Explain the difference between a Deterministic Finite Automaton (DFA) and an NFA.",
        "What is the significance of the Pumping Lemma for regular languages?",
        "How does a Pushdown Automaton differ from a standard Finite Automaton?",
        "What distinguishes context-free languages from Turing-recognizable languages?",
        "Define the Chomsky hierarchy and describe its four primary grammatical levels."
    ],
    "HCI": [
        "Explain Nielsen's heuristic of visibility of system status with a concrete example.",
        "What is Fitts's Law and how does it influence UI button sizing and placement?",
        "What is the difference between recognition and recall in cognitive ergonomics?",
        "How do mental models impact a user's initial interaction with new software?",
        "Describe the concept of affordance as defined by Don Norman."
    ],
    "DBMS": [
        "Explain ACID properties in transaction processing and why atomicity is vital.",
        "What is the difference between 3NF and BCNF normalization forms?",
        "How does a B+ tree index optimize database read query performance?",
        "Explain the difference between optimistic and pessimistic concurrency control.",
        "What is a deadlock in database systems and how can an engine resolve it?"
    ],
    "OOP": [
        "Explain the difference between runtime polymorphism and compile-time polymorphism.",
        "What is the Liskov Substitution Principle in SOLID object-oriented design?",
        "How does an abstract class differ from an interface in system architecture?",
        "Explain the concept of encapsulation and why data hiding improves maintainability.",
        "What is composition over inheritance and when should you prefer composition?"
    ],
    "CN": [
        "Explain the key differences between TCP and UDP protocols in the transport layer.",
        "How does the TCP three-way handshake establish a reliable network connection?",
        "What is the difference between distance-vector and link-state routing algorithms?",
        "Explain how DNS resolution works from a client query to an authoritative server.",
        "What is the purpose of subnet masking in IPv4 network addressing?"
    ],
    "DSA": [
        "Explain the difference between time complexity and auxiliary space complexity in Big-O.",
        "Why is quicksort generally faster in practice than mergesort despite O(N^2) worst case?",
        "What is the difference between a hash table with chaining vs open addressing?",
        "Explain how Dijkstra's algorithm finds the shortest path in a weighted graph.",
        "When would you choose a breadth-first search over a depth-first search?"
    ]
}

def generate_question(subject_code, question_idx):
    """Generate 1 conceptual viva question using Gemini 1.5 Flash or fallbacks."""
    subject_name = SUBJECTS.get(subject_code, subject_code)
    try:
        if genai and os.environ.get("GEMINI_API_KEY"):
            # Try modern model aliases first, fallback to standard legacy string
            for model_name in ['gemini-1.5-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-pro']:
                try:
                    model = genai.GenerativeModel(model_name)
                    prompt = QUESTION_GENERATOR.format(subject=subject_name)
                    response = model.generate_content(prompt)
                    if response and response.text:
                        clean_q = response.text.strip().replace('"', '')
                        if len(clean_q.split()) <= 30:
                            return clean_q
                except Exception as e:
                    continue
    except Exception as e:
        print(f"[Viva Coach AI] Gemini Question Gen Notice: Using fallback. Detail: {e}")
    
    # Fallback mechanism
    q_list = FALLBACK_QUESTIONS.get(subject_code, FALLBACK_QUESTIONS["TOA"])
    return q_list[(question_idx - 1) % len(q_list)]

def grade_answer(subject_code, question, answer):
    """Grade student answer using Gemini 1.5 Flash and return structured JSON."""
    subject_name = SUBJECTS.get(subject_code, subject_code)
    try:
        if genai and os.environ.get("GEMINI_API_KEY"):
            for model_name in ['gemini-1.5-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-pro']:
                try:
                    model = genai.GenerativeModel(model_name)
                    prompt = FEEDBACK_GRADER.format(subject=subject_name, question=question, answer=answer)
                    response = model.generate_content(prompt)
                    if response and response.text:
                        raw_text = response.text.strip()
                        if raw_text.startswith("```json"):
                            raw_text = raw_text[7:]
                        elif raw_text.startswith("```"):
                            raw_text = raw_text[3:]
                        if raw_text.endswith("```"):
                            raw_text = raw_text[:-3]
                        data = json.loads(raw_text.strip())
                        return {
                            "score": min(10, max(0, int(data.get("score", 7)))),
                            "missing_concepts": list(data.get("missing_concepts", [])),
                            "suggestion": str(data.get("suggestion", "Review core definitions and architectural trade-offs."))
                        }
                except Exception as e:
                    continue
    except Exception as e:
        print(f"[Viva Coach AI] Gemini Grader Notice: Using heuristic fallback. Detail: {e}")

    # Heuristic fallback if offline or API key unconfigured
    word_count = len(answer.split())
    if word_count < 8:
        return {
            "score": 3,
            "missing_concepts": ["In-depth technical definition", "Underlying theoretical mechanisms", "Practical real-world use case"],
            "suggestion": "Your answer is too brief for a university viva. Provide a clear definition followed by how and why it is used."
        }
    elif word_count < 25:
        return {
            "score": 7,
            "missing_concepts": ["Edge cases and boundary conditions", "Performance or memory complexity trade-offs"],
            "suggestion": "Good conceptual foundation. To score a 10, explicitly mention performance complexity or system trade-offs."
        }
    else:
        return {
            "score": 9,
            "missing_concepts": ["Minor industry standards distinction"],
            "suggestion": "Excellent, comprehensive response! Present with steady confidence during the actual viva examination."
        }

@app.route('/', methods=['GET', 'POST'])
def home():
    """Home Page: Subject dropdown selection and Start Viva initialization."""
    if request.method == 'POST':
        subject_code = request.form.get('subject', 'TOA')
        session['subject'] = subject_code
        session['current_question_index'] = 1
        session['questions'] = []
        session['answers'] = []
        session['feedbacks'] = []
        return redirect(url_for('viva'))
    return render_template('index.html', subjects=SUBJECTS)

@app.route('/viva', methods=['GET', 'POST'])
def viva():
    """Viva Page: Displays 1 question at a time or grades student answer on POST."""
    subject_code = session.get('subject')
    if not subject_code:
        return redirect(url_for('home'))
    
    idx = session.get('current_question_index', 1)
    if idx > 5:
        return redirect(url_for('report'))
    
    questions = session.get('questions', [])
    while len(questions) < idx:
        q = generate_question(subject_code, len(questions) + 1)
        questions.append(q)
        session['questions'] = questions
        
    current_q = questions[idx - 1]
    
    if request.method == 'POST':
        answer = request.form.get('answer', '').strip()
        if not answer:
            answer = "[No answer provided by student]"
            
        answers = session.get('answers', [])
        if len(answers) < idx:
            answers.append(answer)
        else:
            answers[idx - 1] = answer
        session['answers'] = answers
        
        fb_data = grade_answer(subject_code, current_q, answer)
        feedbacks = session.get('feedbacks', [])
        if len(feedbacks) < idx:
            feedbacks.append(fb_data)
        else:
            feedbacks[idx - 1] = fb_data
        session['feedbacks'] = feedbacks
        
        return render_template('viva.html',
                               subject_code=subject_code,
                               subject_name=SUBJECTS.get(subject_code, subject_code),
                               question=current_q,
                               answer=answer,
                               feedback=fb_data,
                               current_index=idx,
                               total_questions=5)

    return render_template('viva.html',
                           subject_code=subject_code,
                           subject_name=SUBJECTS.get(subject_code, subject_code),
                           question=current_q,
                           current_index=idx,
                           total_questions=5)

@app.route('/feedback', methods=['POST'])
def feedback():
    """Feedback Route alias for form submission."""
    return viva()

@app.route('/next_question', methods=['POST', 'GET'])
def next_question():
    """Advances session to the next viva question or final report."""
    idx = session.get('current_question_index', 1) + 1
    session['current_question_index'] = idx
    if idx > 5:
        return redirect(url_for('report'))
    return redirect(url_for('viva'))

@app.route('/report', methods=['GET'])
def report():
    """Final Report Route: Displays score summary and list of weak topics after 5 questions."""
    feedbacks = session.get('feedbacks', [])
    questions = session.get('questions', [])
    answers = session.get('answers', [])
    subject_code = session.get('subject', 'TOA')
    subject_name = SUBJECTS.get(subject_code, subject_code)
    
    if not feedbacks:
        return redirect(url_for('home'))
        
    total_score = sum(f.get('score', 0) for f in feedbacks)
    avg_score = round(total_score / len(feedbacks), 1)
    
    # Extract weak topics from questions where score was 8 or lower
    weak_topics = []
    for f in feedbacks:
        if f.get('score', 10) <= 8:
            for mc in f.get('missing_concepts', []):
                if mc and mc not in weak_topics:
                    weak_topics.append(mc)
                    
    # If student aced everything, provide advanced topics
    if not weak_topics:
        weak_topics = ["Advanced Distributed System Architecture", "Low-Latency Kernel Optimization", "High-Concurrency Concurrency Control"]
        
    qa_summary = []
    for i in range(len(feedbacks)):
        qa_summary.append({
            "num": i + 1,
            "question": questions[i] if i < len(questions) else f"Question {i+1}",
            "answer": answers[i] if i < len(answers) else "No answer recorded",
            "score": feedbacks[i].get('score', 0),
            "missing": feedbacks[i].get('missing_concepts', []),
            "suggestion": feedbacks[i].get('suggestion', '')
        })
        
    return render_template('report.html',
                           subject_code=subject_code,
                           subject_name=subject_name,
                           total_score=total_score,
                           max_score=len(feedbacks) * 10,
                           avg_score=avg_score,
                           weak_topics=weak_topics,
                           qa_summary=qa_summary)

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint for container monitoring."""
    return jsonify({"status": "ok", "service": "Viva Coach AI Python Backend", "version": "1.0.0"})

if __name__ == '__main__':
    # Default Flask execution
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
