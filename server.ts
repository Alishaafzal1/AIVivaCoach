import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/static", express.static(path.join(process.cwd(), "static")));

// AI PROMPTS AS SPECIFIED IN REQUIREMENTS
const QUESTION_GENERATOR = (subject: string) => 
  `You are a strict university professor. Subject: ${subject}. Ask only 1 conceptual viva question. Keep it under 20 words. Output only the question.`;

const FEEDBACK_GRADER = (subject: string, question: string, answer: string) =>
  `You are a viva examiner. Grade this student answer. Subject: ${subject}. Question: ${question}. Student Answer: ${answer}.\nReturn ONLY a valid JSON object with keys: score (int 0-10), missing_concepts (list of strings), suggestion (string). Be strict but helpful.`;

const FALLBACK_QUESTIONS: Record<string, string[]> = {
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
};

const SUBJECT_NAMES: Record<string, string> = {
  "TOA": "Theory of Automata",
  "HCI": "Human-Computer Interaction",
  "DBMS": "Database Management Systems",
  "OOP": "Object-Oriented Programming",
  "CN": "Computer Networks",
  "DSA": "Data Structures & Algorithms"
};

// API routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Viva Coach AI Live Studio Server" });
});

// Endpoint to inspect generated Flask files for Vercel
app.get("/api/flask-files", (req, res) => {
  try {
    const filesToRead = [
      { name: "app.py", path: path.join(process.cwd(), "app.py"), language: "python" },
      { name: "requirements.txt", path: path.join(process.cwd(), "requirements.txt"), language: "text" },
      { name: "vercel.json", path: path.join(process.cwd(), "vercel.json"), language: "json" },
      { name: "templates/index.html", path: path.join(process.cwd(), "templates/index.html"), language: "html" },
      { name: "templates/viva.html", path: path.join(process.cwd(), "templates/viva.html"), language: "html" },
      { name: "templates/report.html", path: path.join(process.cwd(), "templates/report.html"), language: "html" },
      { name: "static/style.css", path: path.join(process.cwd(), "static/style.css"), language: "css" },
      { name: "README.md", path: path.join(process.cwd(), "README.md"), language: "markdown" }
    ];

    const result = filesToRead.map((f) => {
      let content = "";
      try {
        if (fs.existsSync(f.path)) {
          content = fs.readFileSync(f.path, "utf-8");
        } else {
          content = "// File not found";
        }
      } catch (err) {
        content = "// Error reading file";
      }
      return { ...f, content };
    });

    return res.json({ files: result });
  } catch (error) {
    return res.status(500).json({ error: "Failed to read flask files" });
  }
});

// Simple in-memory session for AI Studio Live Preview
let previewSession: {
  subject: string;
  current_question_index: number;
  questions: string[];
  answers: string[];
  feedbacks: any[];
} = {
  subject: "TOA",
  current_question_index: 1,
  questions: [],
  answers: [],
  feedbacks: []
};

app.get("/", (req, res) => {
  try {
    let html = fs.readFileSync(path.join(process.cwd(), "templates/index.html"), "utf-8");
    html = html
      .replace(/\{\{ url_for\('static', filename='style\.css'\) \}\}/g, "/static/style.css")
      .replace(/\{\{ url_for\('home'\) \}\}/g, "/")
      .replace(/\{\{ url_for\('viva'\) \}\}/g, "/viva")
      .replace(/\{\{ url_for\('report'\) \}\}/g, "/report");
    
    const optionsHtml = Object.entries(SUBJECT_NAMES)
      .map(([code, name]) => `<option value="${code}">${code} - ${name}</option>`)
      .join("");
    html = html.replace(/\{\% for code, name in subjects\.items\(\) \%\}[\s\S]*?\{\% endfor \%\}/g, optionsHtml);
    res.send(html);
  } catch (err: any) {
    res.status(500).send("Error reading index.html: " + err.message);
  }
});

app.post("/", (req, res) => {
  previewSession.subject = req.body.subject || "TOA";
  previewSession.current_question_index = 1;
  previewSession.questions = [];
  previewSession.answers = [];
  previewSession.feedbacks = [];
  res.redirect("/viva");
});

app.all("/viva", async (req, res) => {
  try {
    if (!previewSession.subject) {
      return res.redirect("/");
    }
    const idx = previewSession.current_question_index;
    if (idx > 5) {
      return res.redirect("/report");
    }
    
    while (previewSession.questions.length < idx) {
      let q = "";
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: QUESTION_GENERATOR(SUBJECT_NAMES[previewSession.subject] || previewSession.subject),
          });
          if (response.text) {
            const cleanQ = response.text.trim().replace(/^"|"$/g, '');
            if (cleanQ.split(" ").length <= 30) q = cleanQ;
          }
        } catch (e) {}
      }
      if (!q) {
        const list = FALLBACK_QUESTIONS[previewSession.subject] || FALLBACK_QUESTIONS["TOA"];
        q = list[(previewSession.questions.length) % list.length];
      }
      previewSession.questions.push(q);
    }

    const current_q = previewSession.questions[idx - 1];
    let fb: any = null;
    let answer = "";

    if (req.method === "POST") {
      answer = (req.body.answer || "").trim() || "[No answer provided by student]";
      previewSession.answers[idx - 1] = answer;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && answer && answer !== "[No answer provided by student]") {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: FEEDBACK_GRADER(SUBJECT_NAMES[previewSession.subject] || previewSession.subject, current_q, answer),
            config: { responseMimeType: "application/json" }
          });
          if (response.text) {
            const cleanJson = response.text.trim().replace(/^```json\s*|\s*```$/g, "").replace(/^```\s*|\s*```$/g, "");
            const data = JSON.parse(cleanJson);
            fb = {
              score: Math.min(10, Math.max(0, Number(data.score || 7))),
              missing_concepts: Array.isArray(data.missing_concepts) ? data.missing_concepts : [],
              suggestion: String(data.suggestion || "Review theoretical definitions and system trade-offs.")
            };
          }
        } catch (e) {}
      }
      if (!fb) {
        const wordCount = answer.split(/\s+/).filter(Boolean).length;
        if (wordCount < 8) {
          fb = {
            score: 3,
            missing_concepts: ["In-depth technical definition", "Underlying theoretical mechanisms", "Practical real-world use case"],
            suggestion: "Your answer is too brief for a university viva. Provide a clear definition followed by how and why it is used."
          };
        } else if (wordCount < 25) {
          fb = {
            score: 7,
            missing_concepts: ["Edge cases and boundary conditions", "Performance or memory complexity trade-offs"],
            suggestion: "Good conceptual foundation. To score a 10, explicitly mention performance complexity or system trade-offs."
          };
        } else {
          fb = {
            score: 9,
            missing_concepts: ["Minor industry standards distinction"],
            suggestion: "Excellent, comprehensive response! Present with steady confidence during the actual viva examination."
          };
        }
      }
      previewSession.feedbacks[idx - 1] = fb;
    }

    let html = fs.readFileSync(path.join(process.cwd(), "templates/viva.html"), "utf-8");
    html = html
      .replace(/\{\{ url_for\('static', filename='style\.css'\) \}\}/g, "/static/style.css")
      .replace(/\{\{ url_for\('home'\) \}\}/g, "/")
      .replace(/\{\{ url_for\('viva'\) \}\}/g, "/viva")
      .replace(/\{\{ url_for\('next_question'\) \}\}/g, "/next_question")
      .replace(/\{\{ subject_code \}\}/g, previewSession.subject)
      .replace(/\{\{ subject_name \}\}/g, SUBJECT_NAMES[previewSession.subject] || previewSession.subject)
      .replace(/\{\{ current_index \}\}/g, idx.toString())
      .replace(/\{\{ total_questions \}\}/g, "5")
      .replace(/\{\{ question \}\}/g, current_q);

    const ifIndex = html.indexOf("{% if feedback %}");
    const elseIndex = html.indexOf("{% else %}");
    const endifIndex = html.indexOf("{% endif %}");

    if (ifIndex !== -1 && elseIndex !== -1 && endifIndex !== -1) {
      if (fb) {
        let feedbackPart = html.substring(ifIndex + 17, elseIndex);
        feedbackPart = feedbackPart
          .replace(/\{\{ feedback\.score \}\}/g, fb.score.toString())
          .replace(/\{\{ answer \}\}/g, answer)
          .replace(/\{\{ feedback\.suggestion \}\}/g, fb.suggestion);
        
        const mcHtml = (fb.missing_concepts || []).map((c: string) => `<li>${c}</li>`).join("");
        feedbackPart = feedbackPart.replace(/\{\% for concept in feedback\.missing_concepts \%\}[\s\S]*?\{\% endfor \%\}/g, mcHtml);
        
        const nextText = idx < 5 ? `Next Question (Round ${idx + 1} of 5) ➔` : `View Final Diagnostic Report 🏆 ➔`;
        feedbackPart = feedbackPart.replace(/\{\% if current_index < 5 \%\}[\s\S]*?\{\% endif \%\}/g, nextText);
        
        const bgLight = fb.score >= 8 ? "var(--success-light)" : fb.score >= 5 ? "var(--warning-light)" : "var(--danger-light)";
        const colorMain = fb.score >= 8 ? "var(--success-color)" : fb.score >= 5 ? "var(--warning-color)" : "var(--danger-color)";
        feedbackPart = feedbackPart
          .replace(/\{\% if feedback\.score >= 8 \%\}var\(--success-light\)\{\% elif feedback\.score >= 5 \%\}var\(--warning-light\)\{\% else \%\}var\(--danger-light\)\{\% endif \%\}/g, bgLight)
          .replace(/\{\% if feedback\.score >= 8 \%\}var\(--success-color\)\{\% elif feedback\.score >= 5 \%\}var\(--warning-color\)\{\% else \%\}var\(--danger-color\)\{\% endif \%\}/g, colorMain);

        html = html.substring(0, ifIndex) + feedbackPart + html.substring(endifIndex + 11);
      } else {
        let formPart = html.substring(elseIndex + 8, endifIndex);
        html = html.substring(0, ifIndex) + formPart + html.substring(endifIndex + 11);
      }
    }

    res.send(html);
  } catch (err: any) {
    res.status(500).send("Error rendering viva.html: " + err.message);
  }
});

app.all("/feedback", (req, res) => {
  res.redirect("/viva");
});

app.all("/next_question", (req, res) => {
  previewSession.current_question_index++;
  if (previewSession.current_question_index > 5) {
    return res.redirect("/report");
  }
  return res.redirect("/viva");
});

app.get("/report", (req, res) => {
  try {
    const feedbacks = previewSession.feedbacks;
    const questions = previewSession.questions;
    const answers = previewSession.answers;
    const subject_code = previewSession.subject;
    const subject_name = SUBJECT_NAMES[subject_code] || subject_code;

    if (!feedbacks || feedbacks.length === 0) {
      return res.redirect("/");
    }

    const total_score = feedbacks.reduce((acc, f) => acc + (f?.score || 0), 0);
    const avg_score = (total_score / feedbacks.length).toFixed(1);
    
    let weak_topics: string[] = [];
    feedbacks.forEach((f) => {
      if ((f?.score || 10) <= 8) {
        (f?.missing_concepts || []).forEach((mc: string) => {
          if (mc && !weak_topics.includes(mc)) weak_topics.push(mc);
        });
      }
    });
    if (weak_topics.length === 0) {
      weak_topics = ["Advanced Distributed System Architecture", "Low-Latency Kernel Optimization", "High-Concurrency Concurrency Control"];
    }

    let html = fs.readFileSync(path.join(process.cwd(), "templates/report.html"), "utf-8");
    html = html
      .replace(/\{\{ url_for\('static', filename='style\.css'\) \}\}/g, "/static/style.css")
      .replace(/\{\{ url_for\('home'\) \}\}/g, "/")
      .replace(/\{\{ subject_code \}\}/g, subject_code)
      .replace(/\{\{ subject_name \}\}/g, subject_name)
      .replace(/\{\{ avg_score \}\}/g, avg_score)
      .replace(/\{\{ total_score \}\}/g, total_score.toString())
      .replace(/\{\{ max_score \}\}/g, (feedbacks.length * 10).toString())
      .replace(/\{\{ qa_summary\|length \}\}/g, feedbacks.length.toString());

    const wtHtml = weak_topics.map((t) => `<li>${t}</li>`).join("");
    html = html.replace(/\{\% if weak_topics and weak_topics\|length > 0 \%\}[\s\S]*?\{\% endif \%\}/g, `<ul style="list-style-type: disc; padding-left: 1.5rem; color: #92400e; font-weight: 600; line-height: 1.8;">${wtHtml}</ul>`);

    const qaHtml = feedbacks.map((fb, i) => {
      const q = questions[i] || `Question ${i+1}`;
      const a = answers[i] || "No answer recorded";
      const score = fb?.score || 0;
      const missing = fb?.missing_concepts || [];
      const sug = fb?.suggestion || "";
      return `
        <div class="qa-item">
          <div class="qa-header">
            <span style="color: var(--accent-color);">Q${i+1}. "${q}"</span>
            <span style="font-weight: 800; color: ${score >= 8 ? 'var(--success-color)' : score >= 5 ? 'var(--warning-color)' : 'var(--danger-color)'};">
              ${score}/10
            </span>
          </div>
          <div style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 0.75rem; padding-left: 1rem; border-left: 2px solid var(--border-color);">
            <strong>Your Answer:</strong> "${a}"
          </div>
          ${missing && missing.length > 0 ? `
            <div style="font-size: 0.85rem; margin-bottom: 0.5rem;">
              <strong style="color: #991b1b;">Missed Concepts:</strong>
              ${missing.map((m: string) => `<span style="background: var(--danger-light); color: #991b1b; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-right: 0.35rem; display: inline-block; margin-bottom: 0.25rem;">${m}</span>`).join('')}
            </div>
          ` : ''}
          <div style="font-size: 0.875rem; background: var(--bg-subtle); padding: 0.75rem; border-radius: 6px; color: var(--text-main);">
            💡 <strong>Tip:</strong> ${sug}
          </div>
        </div>
      `;
    }).join('');
    html = html.replace(/\{\% for item in qa_summary \%\}[\s\S]*?\{\% endfor \%\}/g, qaHtml);

    res.send(html);
  } catch (err: any) {
    res.status(500).send("Error rendering report.html: " + err.message);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Viva Coach AI] Python Flask Preview Server running on http://0.0.0.0:${PORT}`);
});
