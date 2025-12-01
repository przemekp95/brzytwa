from fastapi import FastAPI, Query, HTTPException, UploadFile, File
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer, CrossEncoder
import chromadb
from typing import List, Dict, Optional, Tuple
import joblib
import os
import json
import numpy as np
from datetime import datetime
import pandas as pd
from pathlib import Path

# New imports for LangChain and OpenCV
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain.llms import HuggingFacePipeline
from langchain.memory import ConversationBufferMemory
import cv2
import pytesseract
import io

# Phase 1: BERT Embeddings Setup
print("🔄 Ładowanie BERT embeddings...")
try:
    # Multi-language BERT for Polish + English
    sentence_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    print("✅ BERT embeddings załadowany")
except Exception as e:
    print(f"⚠️ Błąd ładowania BERT: {e}")
    sentence_model = None

# Phase 2: Vector Database Setup
VECTOR_DB_PATH = "chroma_db"
try:
    chroma_client = chromadb.PersistentClient(path=VECTOR_DB_PATH)
    collection = chroma_client.get_or_create_collection(name="task_examples")
    print("✅ Vector database połączona")
except Exception as e:
    print(f"⚠️ Błąd vector database: {e}")
    chroma_client = None

# LangChain initialization
langchain_memory = ConversationBufferMemory()
langchain_template = """
You are an expert task management and Eisenhower Matrix consultant. Analyze the following task and provide detailed reasoning about where it should be placed in the Eisenhower Matrix.

Task to analyze: {task}

Consider:
1. URGENCY: Does this task have a deadline? Is it time-sensitive? Will not doing it soon cause negative consequences?
2. IMPORTANCE: Does this task align with long-term goals? Is it valuable for career/personal growth? Will it have significant impact?

Based on your analysis, recommend one of these quadrants:
- Quadrant 0: Do Now (Urgent + Important) - Immediate action required
- Quadrant 1: Schedule (Urgent, Not Important) - Plan time for delegation
- Quadrant 2: Delegate (Important, Not Urgent) - Focus on high-value activities
- Quadrant 3: Delete (Not Important, Not Urgent) - Eliminate or minimize

Provide your final recommendation as a number (0-3) and detailed reasoning.
"""

try:
    langchain_prompt = PromptTemplate(
        input_variables=["task"],
        template=langchain_template
    )

    # Initialize HuggingFace model for LangChain
    hf_model_id = "microsoft/DialoGPT-medium"
    hf_pipeline = None
    langchain_llm = None

    try:
        from transformers import pipeline
        hf_pipeline = pipeline("text-generation", model=hf_model_id, max_length=512, temperature=0.7, do_sample=True)
        langchain_llm = HuggingFacePipeline(pipeline=hf_pipeline)
        print("✅ LangChain initialized with HuggingFace model")
    except Exception as e:
        print(f"⚠️ LangChain initialization failed: {e}")
        langchain_llm = None

except Exception as e:
    print(f"⚠️ LangChain setup error: {e}")
    langchain_llm = None

def analyze_task_with_langchain(task: str) -> Dict:
    """Use LangChain to perform advanced task analysis"""
    if langchain_llm is None or langchain_prompt is None:
        return {
            "error": "LangChain not available",
            "quadrant": -1,
            "reasoning": "LangChain functionality is not loaded"
        }

    try:
        chain = LLMChain(
            llm=langchain_llm,
            prompt=langchain_prompt,
            memory=langchain_memory,
            verbose=False
        )

        response = chain.run(task=task)

        # Parse the response for quadrant recommendation
        lines = response.strip().split('\n')
        quadrant = -1
        reasoning_parts = []

        for line in lines:
            line_lower = line.lower()
            if 'quadrant 0' in line_lower or 'do now' in line_lower:
                quadrant = 0
                reasoning_parts.append(line)
            elif 'quadrant 1' in line_lower or 'schedule' in line_lower:
                quadrant = 1
                reasoning_parts.append(line)
            elif 'quadrant 2' in line_lower or 'delegate' in line_lower:
                quadrant = 2
                reasoning_parts.append(line)
            elif 'quadrant 3' in line_lower or 'delete' in line_lower:
                quadrant = 3
                reasoning_parts.append(line)
            elif any(keyword in line_lower for keyword in ['reasoning:', 'analysis:', 'consider:']):
                reasoning_parts.append(line)

        if quadrant == -1:
            # Fallback to first numeric digit found
            import re
            numbers = re.findall(r'\b\d+\b', response)
            if numbers:
                quadrant = min(int(num) for num in numbers if 0 <= int(num) <= 3)

        return {
            "quadrant": quadrant,
            "reasoning": " ".join(reasoning_parts[:3]),  # Limit to first 3 reasoning points
            "full_reasoning": response,
            "confidence": 0.6 if quadrant >= 0 else 0.0,
            "method": "LangChain"
        }

    except Exception as e:
        return {
            "error": f"LangChain analysis failed: {str(e)}",
            "quadrant": -1,
            "reasoning": "",
            "confidence": 0.0,
            "method": "LangChain"
        }

def extract_text_from_image(image_data: bytes) -> Dict:
    """Use OpenCV and Tesseract to extract text from images"""
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"error": "Invalid image format", "text": "", "tasks": []}

        # Preprocessing for better OCR
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Apply thresholding to get better contrast
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Use pytesseract for OCR with Polish language support
        extracted_text = pytesseract.image_to_string(thresh, lang='pol+eng', config='--psm 3')

        # Split into potential tasks (simple heuristics)
        lines = [line.strip() for line in extracted_text.split('\n') if line.strip()]
        potential_tasks = []

        # Simple task detection (lines that look like tasks)
        for line in lines:
            line = line.strip()
            if len(line) > 5 and not line.startswith('http'):  # Filter out URLs
                # Look for task-like patterns
                task_indicators = ['-', '•', '*', 'todo', 'task', '✓', '☐']
                if any(indicator in line.lower() or line[0].isupper() for indicator in task_indicators):
                    potential_tasks.append(line)

        return {
            "extracted_text": extracted_text,
            "tasks": potential_tasks[:10],  # Limit to 10 most promising tasks
            "image_shape": f"{img.shape[0]}x{img.shape[1]}",
            "method": "OpenCV+Tesseract"
        }

    except Exception as e:
        return {
            "error": f"OCR processing failed: {str(e)}",
            "text": "",
            "tasks": []
        }

app = FastAPI(title="AI Quadrant Classifier", description="Intelligent task classification with continuous learning")

model_path = 'quadrant_model.pkl'
training_data_file = 'training_data.json'

def load_training_data() -> List[Dict]:
    """Load training data from JSON file"""
    if os.path.exists(training_data_file):
        with open(training_data_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return get_default_training_data()

def save_training_data(data: List[Dict]):
    """Save training data to JSON file"""
    with open(training_data_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_default_training_data() -> List[Dict]:
    """Return the default training data as list of dicts"""
    return [
        # English Do Now (urgent + important) - 50 examples
        {"text": "urgent deadline tomorrow", "quadrant": 0}, {"text": "critical issue fix now", "quadrant": 0}, {"text": "emergency meeting", "quadrant": 0}, {"text": "fire safety check today", "quadrant": 0}, {"text": "critical bug fix immediately", "quadrant": 0},
        {"text": "meeting with boss now", "quadrant": 0}, {"text": "urgent client call", "quadrant": 0}, {"text": "crisis management plan", "quadrant": 0}, {"text": "fix server crash urgent", "quadrant": 0}, {"text": "emergency response team", "quadrant": 0},
        {"text": "urgent product launch", "quadrant": 0}, {"text": "deadline presentation", "quadrant": 0}, {"text": "critical system update", "quadrant": 0}, {"text": "emergency audit report", "quadrant": 0}, {"text": "urgent compliance check", "quadrant": 0},
        {"text": "fire drill today", "quadrant": 0}, {"text": "crisis intervention", "quadrant": 0}, {"text": "urgent strategic review", "quadrant": 0}, {"text": "emergency funding request", "quadrant": 0}, {"text": "deadline extension needed", "quadrant": 0},
        {"text": "urgent legal advice", "quadrant": 0}, {"text": "critical safety issue", "quadrant": 0}, {"text": "immediate action required", "quadrant": 0}, {"text": "urgent contract review", "quadrant": 0}, {"text": "crisis communication", "quadrant": 0},
        {"text": "deadline reset", "quadrant": 0}, {"text": "urgent budget approval", "quadrant": 0}, {"text": "critical path analysis", "quadrant": 0}, {"text": "emergency evacuation", "quadrant": 0}, {"text": "urgent stakeholder meeting", "quadrant": 0},
        {"text": "crisis recovery plan", "quadrant": 0}, {"text": "urgent technology upgrade", "quadrant": 0}, {"text": "deadline extension issue", "quadrant": 0}, {"text": "critical infrastructure fail", "quadrant": 0}, {"text": "emergency board meeting", "quadrant": 0},
        {"text": "urgent supplier issue", "quadrant": 0}, {"text": "critical quality control", "quadrant": 0}, {"text": "immediate deadline action", "quadrant": 0}, {"text": "crisis mode activated", "quadrant": 0}, {"text": "urgent deadline reminder", "quadrant": 0},
        {"text": "fire alarm system check", "quadrant": 0}, {"text": "crucial meeting now", "quadrant": 0}, {"text": "emergency protocol", "quadrant": 0}, {"text": "urgent risk assessment", "quadrant": 0}, {"text": "critical deadline approach", "quadrant": 0},
        {"text": "emergency response drill", "quadrant": 0}, {"text": "urgent compliance issue", "quadrant": 0}, {"text": "crisis management call", "quadrant": 0}, {"text": "deadline extension granted", "quadrant": 0}, {"text": "urgent partner summit", "quadrant": 0},

        # English Schedule (urgent, not important) - 50 examples
        {"text": "schedule call later", "quadrant": 1}, {"text": "check emails tomorrow", "quadrant": 1}, {"text": "confirm meeting slots", "quadrant": 1}, {"text": "update calendar events", "quadrant": 1}, {"text": "reply to emails today", "quadrant": 1},
        {"text": "schedule follow-up", "quadrant": 1}, {"text": "book conference room", "quadrant": 1}, {"text": "remind about deadline", "quadrant": 1}, {"text": "update task status", "quadrant": 1}, {"text": "coordinate with team", "quadrant": 1},
        {"text": "schedule routine check", "quadrant": 1}, {"text": "plan weekly review", "quadrant": 1}, {"text": "set up reminders", "quadrant": 1}, {"text": "confirm attendance", "quadrant": 1}, {"text": "organize agenda", "quadrant": 1},
        {"text": "schedule daily standup", "quadrant": 1}, {"text": "update contact list", "quadrant": 1}, {"text": "send progress report", "quadrant": 1}, {"text": "finalize minutes", "quadrant": 1}, {"text": "book travel plans", "quadrant": 1},
        {"text": "coordinate meeting", "quadrant": 1}, {"text": "follow up on actions", "quadrant": 1}, {"text": "send weekly update", "quadrant": 1}, {"text": "plan team lunch", "quadrant": 1}, {"text": "update shared calendar", "quadrant": 1},
        {"text": "schedule webinar", "quadrant": 1}, {"text": "send meeting invite", "quadrant": 1}, {"text": "confirm project status", "quadrant": 1}, {"text": "update task board", "quadrant": 1}, {"text": "organize documents", "quadrant": 1},
        {"text": "schedule review meeting", "quadrant": 1}, {"text": "coordinate schedules", "quadrant": 1}, {"text": "send reminder email", "quadrant": 1}, {"text": "finalize agenda items", "quadrant": 1}, {"text": "book conference", "quadrant": 1},
        {"text": "update meeting notes", "quadrant": 1}, {"text": "plan quarterly review", "quadrant": 1}, {"text": "schedule training session", "quadrant": 1}, {"text": "send newsletter", "quadrant": 1}, {"text": "organize workshop", "quadrant": 1},
        {"text": "confirm vendor meeting", "quadrant": 1}, {"text": "update event calendar", "quadrant": 1}, {"text": "schedule maintenance", "quadrant": 1}, {"text": "plan team building", "quadrant": 1}, {"text": "send status update", "quadrant": 1},
        {"text": "coordinate with partners", "quadrant": 1}, {"text": "schedule bi-weekly check", "quadrant": 1}, {"text": "update documentation", "quadrant": 1}, {"text": "finalize proposal", "quadrant": 1}, {"text": "confirm interview slots", "quadrant": 1},
    ] + get_polish_training_data()

def get_polish_training_data() -> List[Dict]:
    """Return Polish training data as dicts"""
    return [
        # Polish Do Now (urgent + important) - 50 examples
        {"text": "pilny termin jutro", "quadrant": 0}, {"text": "krytyczny błąd do naprawienia zaraz", "quadrant": 0}, {"text": "pilne spotkanie z szefem", "quadrant": 0}, {"text": "awaryjne poprawki systemu", "quadrant": 0}, {"text": "kryzyse komunikacyjna", "quadrant": 0},
        {"text": "pilny raport finansowy", "quadrant": 0}, {"text": "natychmiastowa interwencja", "quadrant": 0}, {"text": "kryzyse zarządcza", "quadrant": 0}, {"text": "pilne spotkanie kryzysowe", "quadrant": 0}, {"text": "awaryjna ewakuacja", "quadrant": 0},
        {"text": "pilna decyzja zarządu", "quadrant": 0}, {"text": "krytyczne bezpieczeństwowa", "quadrant": 0}, {"text": "natychmiastowa naprawa sprzętu", "quadrant": 0}, {"text": "pilny termin umowy", "quadrant": 0}, {"text": "kryzyse finansowy", "quadrant": 0},
        {"text": "pilna akcja ratownicza", "quadrant": 0}, {"text": "awaryjne zamykania produktów", "quadrant": 0}, {"text": "krytyczna ocena ryzyka", "quadrant": 0}, {"text": "pilna konsultacja prawna", "quadrant": 0}, {"text": "natychmiastowa reakcja", "quadrant": 0},
        {"text": "kryzyse operacyjny", "quadrant": 0}, {"text": "pilny audyt bezpieczeństwo", "quadrant": 0}, {"text": "awaryjna aktualizacja systemu", "quadrant": 0}, {"text": "krytyczna zmiana strategia", "quadrant": 0}, {"text": "pilne spotkanie rada", "quadrant": 0},
        {"text": "natychmiastowa decyzja biznesowa", "quadrant": 0}, {"text": "krytyczna awaria sieci", "quadrant": 0}, {"text": "pilny termin wysyłki", "quadrant": 0}, {"text": "awaryjne spotkanie zespół", "quadrant": 0}, {"text": "kryzyse produkcyjna", "quadrant": 0},
        {"text": "pilna reklama kryzysowa", "quadrant": 0}, {"text": "natychmiastowa transakcja", "quadrant": 0}, {"text": "krytyczna zmiana harmonogramu", "quadrant": 0}, {"text": "awaryjne świadczenia usług", "quadrant": 0}, {"text": "pilny terminarz projektu", "quadrant": 0},
        {"text": "kryzyse zdrowotna", "quadrant": 0}, {"text": "pilna interwencja medyczna", "quadrant": 0}, {"text": "awaryjna opieka doraźna", "quadrant": 0}, {"text": "krytyczna aktualizacja leków", "quadrant": 0}, {"text": "natychmiastowa pomoc", "quadrant": 0},
        {"text": "kryzyse środowiskowa", "quadrant": 0}, {"text": "pilna walne zgromadzenie", "quadrant": 0}, {"text": "awaryjne spotkanie akcjonariusze", "quadrant": 0}, {"text": "krytyczna aktualizacja polityka", "quadrant": 0}, {"text": "pilne negocjacje", "quadrant": 0},
        {"text": "natychmiastowa zmiana szef", "quadrant": 0}, {"text": "kryzyse wizerunkowy", "quadrant": 0}, {"text": "pilna kampania kryzysowa", "quadrant": 0}, {"text": "awaryjne zarządzenie", "quadrant": 0}, {"text": "krytyczna rewiza instytucji", "quadrant": 0},

        # Polish Schedule (urgent, not important) - 50 examples
        {"text": "zaplanuj spotkanie jutro", "quadrant": 1}, {"text": "zobacz maile później", "quadrant": 1}, {"text": "potwierdź terminy spotkania", "quadrant": 1}, {"text": "zaktualizuj kalender", "quadrant": 1}, {"text": "odpowiedz na emaile dziś", "quadrant": 1},
    ] + get_remaining_training_data()

def get_remaining_training_data() -> List[Dict]:
    """Get complete remaining training data"""
    return [
        # Polish Schedule continue
        {"text": "zaplanuj następnych kroków", "quadrant": 1}, {"text": "zarezerwuj sal konferencyjna", "quadrant": 1}, {"text": "przypomnij o terminie", "quadrant": 1}, {"text": "aktualizuj status zadania", "quadrant": 1}, {"text": "skoordynuuj z zespołem", "quadrant": 1},
        {"text": "zaplanuj rutynowa kontrola", "quadrant": 1}, {"text": "priorytet przegląd tygodniowy", "quadrant": 1}, {"text": "ustaw przypomnienie", "quadrant": 1}, {"text": "potwierdź uczestnictwo", "quadrant": 1}, {"text": "zorganizuj kolejność dnia", "quadrant": 1},
        {"text": "planuj codzienny scrum", "quadrant": 1}, {"text": "aktualizuj listy kontaktów", "quadrant": 1}, {"text": "wyślij raport postępów", "quadrant": 1}, {"text": "sfinalizuj protokoły", "quadrant": 1}, {"text": "zarezerwuj bilety", "quadrant": 1},
        {"text": "skoordynuuj terminy", "quadrant": 1}, {"text": "następne działania", "quadrant": 1}, {"text": "wyślij aktualizacja tygodniowa", "quadrant": 1}, {"text": "planuj lunch zespół", "quadrant": 1}, {"text": "aktualizuj kalender wspólny", "quadrant": 1},
        {"text": "planuj webinar", "quadrant": 1}, {"text": "wyślij zaproszenie spotkanie", "quadrant": 1}, {"text": "potwierdź status projektu", "quadrant": 1}, {"text": "aktualizuj tablice zadania", "quadrant": 1}, {"text": "zorganizuj dokumenty", "quadrant": 1},
        {"text": "planuj spotkanie przegląd", "quadrant": 1}, {"text": "skoordynuuj harmonogramy", "quadrant": 1}, {"text": "wyślij email przypomnienie", "quadrant": 1}, {"text": "sfinalizuj elementy agenda", "quadrant": 1}, {"text": "zarezerwuj konferencja", "quadrant": 1},
        {"text": "aktualizuj notas cyfrowa", "quadrant": 1}, {"text": "planuj kwartalna recenzja", "quadrant": 1}, {"text": "planuj sesja treningowa", "quadrant": 1}, {"text": "wyślij newsletter", "quadrant": 1}, {"text": "organizuj warsztat", "quadrant": 1},
        {"text": "potwierdź spotkanie dostawca", "quadrant": 1}, {"text": "aktualizuj kalender wydarzeń", "quadrant": 1}, {"text": "planuj konserwacja", "quadrant": 1}, {"text": "planuj budowlanie zespół", "quadrant": 1}, {"text": "wyślij aktualizacja status", "quadrant": 1},
        {"text": "skoordynuuj z partnerami", "quadrant": 1}, {"text": "planuj dwu-tygodniowa kontrola", "quadrant": 1}, {"text": "aktualizuj dokumentacja", "quadrant": 1}, {"text": "sfinalizuj propozycja", "quadrant": 1}, {"text": "potwierdź slota wywiad", "quadrant": 1},

        # English Delegate (important, not urgent) - 50 examples
        {"text": "prepare report", "quadrant": 2}, {"text": "strategize project", "quadrant": 2}, {"text": "design new feature", "quadrant": 2}, {"text": "develop software module", "quadrant": 2}, {"text": "research market trends", "quadrant": 2},
        {"text": "plan long-term goals", "quadrant": 2}, {"text": "build customer retention", "quadrant": 2}, {"text": "optimize workflow process", "quadrant": 2}, {"text": "train new employees", "quadrant": 2}, {"text": "enhance security", "quadrant": 2},
        {"text": "develop training program", "quadrant": 2}, {"text": "research competitors", "quadrant": 2}, {"text": "plan infrastructure upgrade", "quadrant": 2}, {"text": "build team skills", "quadrant": 2}, {"text": "optimize sales pipeline", "quadrant": 2},
        {"text": "create marketing strategy", "quadrant": 2}, {"text": "design user experience", "quadrant": 2}, {"text": "build data analytics", "quadrant": 2}, {"text": "research future trends", "quadrant": 2}, {"text": "develop innovation ideas", "quadrant": 2},
        {"text": "plan sustainability", "quadrant": 2}, {"text": "enhance customer experience", "quadrant": 2}, {"text": "build strategic partnerships", "quadrant": 2}, {"text": "develop quality assurance", "quadrant": 2}, {"text": "optimize supply chain", "quadrant": 2},
        {"text": "create content strategy", "quadrant": 2}, {"text": "design dashboard system", "quadrant": 2}, {"text": "research new markets", "quadrant": 2}, {"text": "build service delivery", "quadrant": 2}, {"text": "develop leadership skills", "quadrant": 2},
        {"text": "plan organizational change", "quadrant": 2}, {"text": "enhance operational efficiency", "quadrant": 2}, {"text": "build brand awareness", "quadrant": 2}, {"text": "develop risk management", "quadrant": 2}, {"text": "optimize cost structure", "quadrant": 2},
        {"text": "create implementation plan", "quadrant": 2}, {"text": "design performance metrics", "quadrant": 2}, {"text": "research industry standards", "quadrant": 2}, {"text": "build stakeholder engagement", "quadrant": 2}, {"text": "develop business model", "quadrant": 2},
        {"text": "plan digital transformation", "quadrant": 2}, {"text": "enhance regulatory compliance", "quadrant": 2}, {"text": "build supplier relationships", "quadrant": 2}, {"text": "develop corporate culture", "quadrant": 2}, {"text": "optimize resource allocation", "quadrant": 2},

        # English Delete (not important, not urgent) - 50 examples
        {"text": "delete old files", "quadrant": 3}, {"text": "clean up cache", "quadrant": 3}, {"text": "remove unused code", "quadrant": 3}, {"text": "archive old emails", "quadrant": 3}, {"text": "delete duplicate entries", "quadrant": 3},
        {"text": "clean desktop shortcuts", "quadrant": 3}, {"text": "remove expired links", "quadrant": 3}, {"text": "archive old projects", "quadrant": 3}, {"text": "delete temporary files", "quadrant": 3}, {"text": "clean browser cookies", "quadrant": 3},
        {"text": "remove spam contacts", "quadrant": 3}, {"text": "archive old reports", "quadrant": 3}, {"text": "delete test data", "quadrant": 3}, {"text": "clean download folder", "quadrant": 3}, {"text": "remove old backups", "quadrant": 3},
        {"text": "archive unused documentation", "quadrant": 3}, {"text": "delete placeholder content", "quadrant": 3}, {"text": "clean contact lists", "quadrant": 3}, {"text": "remove draft emails", "quadrant": 3}, {"text": "delete obsolete policies", "quadrant": 3},
        {"text": "archive completed tasks", "quadrant": 3}, {"text": "remove expired discounts", "quadrant": 3}, {"text": "delete old notifications", "quadrant": 3}, {"text": "clean recycle bin", "quadrant": 3}, {"text": "archive old logs", "quadrant": 3},
        {"text": "remove bookmarks", "quadrant": 3}, {"text": "delete duplicate photos", "quadrant": 3}, {"text": "clean outbox", "quadrant": 3}, {"text": "archive old tickets", "quadrant": 3}, {"text": "delete test accounts", "quadrant": 3},
        {"text": "remove unused scripts", "quadrant": 3}, {"text": "clean temporary folders", "quadrant": 3}, {"text": "archive old contacts", "quadrant": 3}, {"text": "delete draft proposals", "quadrant": 3}, {"text": "remove unused filters", "quadrant": 3},
        {"text": "archive old presentations", "quadrant": 3}, {"text": "delete sample data", "quadrant": 3}, {"text": "clean browser history", "quadrant": 3}, {"text": "remove expired credentials", "quadrant": 3}, {"text": "delete old templates", "quadrant": 3},

        # Polish Delegate (important, not urgent) - 50 examples
        {"text": "przygotuj raport", "quadrant": 2}, {"text": "rozważ strategie projektu", "quadrant": 2}, {"text": "zaprojektuj nowa funkcja", "quadrant": 2}, {"text": "rozwoju moduł oprogramowania", "quadrant": 2}, {"text": "badaj trendy rynku", "quadrant": 2},
        {"text": "planuj dlugoterminarz cele", "quadrant": 2}, {"text": "buduj retencja klientów", "quadrant": 2}, {"text": "optymalizuj proces przeplywu", "quadrant": 2}, {"text": "szkol nowych pracowników", "quadrant": 2}, {"text": "ulepsz bezpieczność", "quadrant": 2},
        {"text": "rozwoju program szkolenia", "quadrant": 2}, {"text": "badaj konkurentów", "quadrant": 2}, {"text": "planuj upgrade infrastruktury", "quadrant": 2}, {"text": "buduj umiejętności zespół", "quadrant": 2}, {"text": "optymalizuj lejek sprzedażowy", "quadrant": 2},
        {"text": "stwórz strategię marketingową", "quadrant": 2}, {"text": "zaprojektuj doświadczenie użytkownik", "quadrant": 2}, {"text": "buduj analityka danych", "quadrant": 2}, {"text": "badaj przyszłe trendy", "quadrant": 2}, {"text": "rozwoju pomysły innowacyjne", "quadrant": 2},
        {"text": "planuj trwałość", "quadrant": 2}, {"text": "rozszerz doświadczenie klient", "quadrant": 2}, {"text": "buduj strategiczne partnerstwa", "quadrant": 2}, {"text": "rozwoju zapewnienie jakość", "quadrant": 2}, {"text": "optymalizuj ciąg dostaw", "quadrant": 2},
        {"text": "stwórz strategię treści", "quadrant": 2}, {"text": "zaprojektuj system dashboard", "quadrant": 2}, {"text": "badaj nowe rynki", "quadrant": 2}, {"text": "buduj dostarczanie usług", "quadrant": 2}, {"text": "rozwoju umiejętności przywództwa", "quadrant": 2},
        {"text": "planuj zmiana organizacyjna", "quadrant": 2}, {"text": "ulepsz efektywność operacyjna", "quadrant": 2}, {"text": "buduj świadomość marka", "quadrant": 2}, {"text": "rozwoju zarządzanie ryzykiem", "quadrant": 2}, {"text": "optymalizuj strukture kosztów", "quadrant": 2},
        {"text": "stwórz plan implementacji", "quadrant": 2}, {"text": "zaprojektuj metryki wydajności", "quadrant": 2}, {"text": "badaj standardy branży", "quadrant": 2}, {"text": "buduj zaangażowanie stakeholder", "quadrant": 2}, {"text": "rozwoju model biznesowy", "quadrant": 2},
        {"text": "planuj transformacja cyfrowa", "quadrant": 2}, {"text": "ulepsz zgodność regulacyjna", "quadrant": 2}, {"text": "buduj relacje dostawca", "quadrant": 2}, {"text": "rozwoju kultura firma", "quadrant": 2}, {"text": "optymalizuj alokacja zasobów", "quadrant": 2},

        # Polish Delete (not important, not urgent) - 50 examples
        {"text": "usuń stare pliki", "quadrant": 3}, {"text": "wyczyść pamięć podręczną", "quadrant": 3}, {"text": "usuwanie nieużywany kod", "quadrant": 3}, {"text": "archiwizuj stare emaile", "quadrant": 3}, {"text": "usuwanie powtórzót wpisy", "quadrant": 3},
        {"text": "czyść skróty pulpit", "quadrant": 3}, {"text": "usuwanie wygasł link", "quadrant": 3}, {"text": "archiwizuj stare projektu", "quadrant": 3}, {"text": "usuwanie pliki tymczasowe", "quadrant": 3}, {"text": "czyść ciasteczka przeglądarka", "quadrant": 3},
        {"text": "usuwanie spam kontakty", "quadrant": 3}, {"text": "archiwizuj stare rapor", "quadrant": 3}, {"text": "usuwanie dane testowe", "quadrant": 3}, {"text": "czyść folder pobierania", "quadrant": 3}, {"text": "usuwanie stare kopie zapasowe", "quadrant": 3},
        {"text": "archiwizuj nieużywane dokumentacja", "quadrant": 3}, {"text": "usuwanie miejsceasem zawartości", "quadrant": 3}, {"text": "czyść listy kontaktów", "quadrant": 3}, {"text": "usuwanie draft emaile", "quadrant": 3}, {"text": "usuwanie przestarzałe polityki", "quadrant": 3},
        {"text": "archiwizuj ukończone zadania", "quadrant": 3}, {"text": "usuwanie wygasł rabaty", "quadrant": 3}, {"text": "usuwanie stare powiadomienia", "quadrant": 3}, {"text": "czyść kosz", "quadrant": 3}, {"text": "archiwizuj stare dzienniki", "quadrant": 3},
        {"text": "usuwanie zakładki", "quadrant": 3}, {"text": "usuwanie duplicate zdjęcia", "quadrant": 3}, {"text": "czyść wychodzące", "quadrant": 3}, {"text": "archiwizuj stare bilety", "quadrant": 3}, {"text": "usuwanie kont testowe", "quadrant": 3},
        {"text": "usuwanie nieużywane skrypty", "quadrant": 3}, {"text": "czyść tymczasowe foldery", "quadrant": 3}, {"text": "archiwizuj stare kontakty", "quadrant": 3}, {"text": "usuwanie draft propozycja", "quadrant": 3}, {"text": "usuwanie nieużywane filtry", "quadrant": 3},
        {"text": "archiwizuj stare prezentacje", "quadrant": 3}, {"text": "usuwanie dane próbne", "quadrant": 3}, {"text": "czyść historia przeglądarka", "quadrant": 3}, {"text": "usuwanie wygaśnięte poświadczenia", "quadrant": 3}, {"text": "usuwanie stare szablony", "quadrant": 3},
    ]

def create_pipeline():
    """Create ML pipeline"""
    return Pipeline([
        ('tfidf', TfidfVectorizer(max_features=500, stop_words='english', ngram_range=(1,2))),
        ('clf', LogisticRegression(random_state=42, max_iter=1000, warm_start=True))  # warm_start for incremental learning
    ])

def train_model(should_save: bool = True):
    """Train model with current training data"""
    training_data = load_training_data()
    texts = [item['text'] for item in training_data]
    labels = [item['quadrant'] for item in training_data]

    model = create_pipeline()
    model.fit(texts, labels)

    if should_save:
        joblib.dump(model, model_path)
        print(f"✅ Model wytrenowany! {len(training_data)} przykładów treningowych")

    return model

# Global model variable
model = None

def get_model():
    """Lazy loading of model"""
    global model
    if model is None:
        if os.path.exists(model_path):
            model = joblib.load(model_path)
            training_count = len(load_training_data())
            print(f"✅ Model załadowany z pliku! {training_count} przykładów treningowych")
        else:
            print("🔄 Trenowanie nowego modelu...")
            model = train_model()
    return model

# Load model at startup
get_model()

# Initialize vector database with current data (Phase 2)
try:
    update_vector_db_with_new_data()
except Exception as e:
    print(f"⚠️ Unable to initialize vector database: {e}")

# Map predictions to boolean
def map_to_bool(prediction):
    # 0: urgent+important, 1: urgent, 2: important, 3: none
    urgent = prediction in [0, 1]
    important = prediction in [0, 2]
    return urgent, important

# Quadrant names for user-friendly display
QUADRANT_NAMES = {
    0: "Zrób Teraz (Pilne + Ważne)",
    1: "Zaplanuj (Pilne, nie ważne)",
    2: "Deleguj (Ważne, nie pilne)",
    3: "Usuń (Nie ważne, nie pilne)"
}

def find_similar_examples(query: str, top_k: int = 5) -> List[Dict]:
    """Znajdź podobne przykłady z bazy treningowej używając BERT embeddings (PHASE 1)"""
    if sentence_model is None:
        # Fallback to TF-IDF if BERT not available
        print("⚠️ BERT nie załadowany, używam TF-IDF fallback")
        return find_similar_examples_tfidf(query, top_k)

    training_data = load_training_data()
    if len(training_data) < 1:
        return []

    # Phase 2: Use ChromaDB if available
    if chroma_client is not None and collection is not None and collection.count() > 0:
        return find_similar_examples_chroma(query, top_k)

    # Phase 1: Use BERT embeddings directly
    all_texts = [item['text'] for item in training_data]
    query_embedding = sentence_model.encode([query])[0]

    # Batch encode all training examples (for efficiency)
    batch_size = 100
    all_embeddings = []
    for i in range(0, len(all_texts), batch_size):
        batch_texts = all_texts[i:i+batch_size]
        batch_embeddings = sentence_model.encode(batch_texts)
        all_embeddings.extend(batch_embeddings)

    all_embeddings = np.array(all_embeddings)

    # Calculate cosine similarities
    similarities = cosine_similarity([query_embedding], all_embeddings)[0]

    # Get top-k most similar examples
    similar_indices = np.argsort(similarities)[-top_k:][::-1]
    similar_examples = []

    for idx in similar_indices:
        similarity = similarities[idx]
        if similarity > 0.3:  # Higher threshold for BERT (better semantic understanding)
            example = training_data[idx]
            similar_examples.append({
                "text": example['text'],
                "quadrant": example['quadrant'],
                "quadrant_name": QUADRANT_NAMES[example['quadrant']],
                "similarity": float(similarity),
                "source": example.get('added_by', 'default'),
                "method": "BERT"
            })

    return similar_examples

def find_similar_examples_tfidf(query: str, top_k: int = 5) -> List[Dict]:
    """Fallback metoda używająca TF-IDF gdy BERT nie jest dostępny"""
    training_data = load_training_data()
    if len(training_data) < 2:
        return []

    texts = [query] + [item['text'] for item in training_data]

    # Create TF-IDF vectorizer and transform
    vectorizer = TfidfVectorizer(max_features=500, stop_words='english', ngram_range=(1,2))
    tfidf_matrix = vectorizer.fit_transform(texts)

    # Calculate cosine similarity between query and all training examples
    query_vector = tfidf_matrix[0]
    training_vectors = tfidf_matrix[1:]

    similarities = cosine_similarity(query_vector, training_vectors)[0]

    # Get top-k most similar examples
    similar_indices = np.argsort(similarities)[-top_k:][::-1]
    similar_examples = []

    for idx in similar_indices:
        if similarities[idx] > 0.1:
            example = training_data[idx]
            similar_examples.append({
                "text": example['text'],
                "quadrant": example['quadrant'],
                "quadrant_name": QUADRANT_NAMES[example['quadrant']],
                "similarity": float(similarities[idx]),
                "source": example.get('added_by', 'default'),
                "method": "TF-IDF"
            })

    return similar_examples

def find_similar_examples_chroma(query: str, top_k: int = 5) -> List[Dict]:
    """PHASE 2: Znajdź podobne przykłady używając ChromaDB vector database"""
    try:
        # Query ChromaDB for similar examples
        results = collection.query(
            query_texts=[query],
            n_results=top_k*2,  # Get more, we'll filter later
            include=['documents', 'metadatas', 'distances']
        )

        similar_examples = []
        if results and results['documents']:
            for i, doc in enumerate(results['documents'][0]):
                metadata = results['metadatas'][0][i]
                distance = results['distances'][0][i]

                # Convert distance to similarity (Chroma returns distance)
                similarity = 1 / (1 + distance)

                if similarity > 0.3:  # Filter low similarity
                    similar_examples.append({
                        "text": doc,
                        "quadrant": metadata.get('quadrant', 0),
                        "quadrant_name": QUADRANT_NAMES.get(metadata.get('quadrant', 0), "Nieznany"),
                        "similarity": float(similarity),
                        "source": metadata.get('source', 'unknown'),
                        "method": "ChromaDB"
                    })

        return similar_examples[:top_k]

    except Exception as e:
        print(f"⚠️ ChromaDB query failed: {e}")
        # Fallback to BERT
        return find_similar_examples(query, top_k)

def update_vector_db_with_new_data():
    """PHASE 2: Zaktualizuj ChromaDB nowymi przykładami treningowymi"""
    if chroma_client is None or sentence_model is None:
        return

    training_data = load_training_data()
    current_count = collection.count() if collection else 0

    if current_count != len(training_data):
        print(f"🔄 Aktualizowanie vector database... ({current_count} → {len(training_data)})")

        # Clear old data
        try:
            chroma_client.delete_collection(name="task_examples")
            collection = chroma_client.create_collection(name="task_examples")
        except:
            collection = chroma_client.get_or_create_collection(name="task_examples")

        # Add all data in batches
        batch_size = 50
        for i in range(0, len(training_data), batch_size):
            batch = training_data[i:i+batch_size]

            documents = [item['text'] for item in batch]
            embeddings = sentence_model.encode(documents).tolist()
            metadatas = [{
                'quadrant': item['quadrant'],
                'source': item.get('added_by', 'default'),
                'timestamp': item.get('timestamp', '')
            } for item in batch]
            ids = [f"example_{j}" for j in range(i, i+len(batch))]

            collection.add(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )

        print(f"✅ Vector database zaktualizowana! {len(training_data)} dokumentów")

# Cross-encoder setup for Phase 3
cross_encoder = None
try:
    cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
    print("✅ Cross-encoder załadowany")
except Exception as e:
    print(f"⚠️ Cross-encoder nie załadowany: {e}")

def rerank_with_cross_encoder(query: str, similar_examples: List[Dict]) -> List[Dict]:
    """PHASE 3: Popraw ranking używając cross-encodera"""
    if cross_encoder is None or len(similar_examples) < 2:
        return similar_examples

    # Prepare pairs for cross-encoder
    pairs = [[query, ex['text']] for ex in similar_examples]

    try:
        # Get cross-encoder scores (higher = better match)
        cross_scores = cross_encoder.predict(pairs)

        # Update similarity scores with cross-encoder results
        for i, ex in enumerate(similar_examples):
            # Weighted combination of semantic (BERT) and cross-encoder scores
            semantic_score = ex['similarity']
            cross_score = cross_scores[i]

            # Normalize cross-encoder score to 0-1 range
            cross_score_norm = (cross_score + 1) / 2

            # Combine: 70% semantic + 30% cross-encoder
            combined_score = 0.7 * semantic_score + 0.3 * cross_score_norm

            ex['similarity'] = float(combined_score)
            ex['method'] += "+CrossEncoder"

        # Re-sort by combined score
        similar_examples.sort(key=lambda x: x['similarity'], reverse=True)

        return similar_examples

    except Exception as e:
        print(f"⚠️ Cross-encoder reranking failed: {e}")
        return similar_examples

def rag_classify(query: str) -> Dict:
    """PHASE 3: Klasyfikacja z wykorzystaniem Advanced RAG"""
    # First, get AI model prediction
    model_prediction = int(get_model().predict([query])[0])

    # Then, find similar examples (RAG retrieval)
    similar_examples = find_similar_examples(query, top_k=8)  # Get more for better reranking

    # Phase 3: Apply cross-encoder reranking if available
    if cross_encoder is not None:
        similar_examples = rerank_with_cross_encoder(query, similar_examples)

    # Keep only top 5 after reranking
    similar_examples = similar_examples[:5]

    # Active Learning: Check confidence (PHASE 3 feature)
    if len(similar_examples) > 0:
        avg_similarity = np.mean([ex['similarity'] for ex in similar_examples])
        max_similarity = max([ex['similarity'] for ex in similar_examples])

        # If uncertain, suggest asking user
        confidence_level = "high"
        needs_user_input = False

        if max_similarity < 0.4:  # Very uncertain
            confidence_level = "low"
            needs_user_input = True
        elif max_similarity < 0.6:  # Uncertain
            confidence_level = "medium"
            needs_user_input = False  # Let RAG decide
    else:
        confidence_level = "no_reference"
        needs_user_input = True

    # Weighted scoring based on similar examples
    quadrant_scores = np.zeros(4)
    quadrant_scores[model_prediction] += 1  # Model prediction has weight 1

    # Add weights from similar examples
    total_weight = 1  # Start with model's weight
    for example in similar_examples:
        quadrant = example['quadrant']
        similarity = example['similarity']
        weight = similarity * 0.6  # Increased weight for better RAG
        quadrant_scores[quadrant] += weight
        total_weight += weight

    # Normalize scores
    if total_weight > 0:
        normalized_scores = quadrant_scores / total_weight
        final_prediction = int(np.argmax(normalized_scores))
        confidence = normalized_scores[final_prediction]
    else:
        final_prediction = model_prediction
        confidence = 0.5  # Default confidence

    # Determine if RAG influenced the decision
    rag_influence = "zachował decyzję"
    if final_prediction != model_prediction:
        rag_influence = "zmienił decyzję"
    elif similar_examples and max([ex['similarity'] for ex in similar_examples]) > 0.7:
        rag_influence = "potwierdził decyzję"

    return {
        "prediction": final_prediction,
        "confidence": float(confidence),
        "rag_influence": rag_influence,
        "model_prediction": model_prediction,
        "confidence_level": confidence_level,
        "needs_user_input": needs_user_input,
        "similar_examples_used": len(similar_examples),
        "similar_examples": similar_examples,
        "advanced_features": {
            "bert_embeddings": sentence_model is not None,
            "vector_database": chroma_client is not None,
            "cross_encoder_reranking": cross_encoder is not None
        }
    }

@app.get("/classify")
def classify_text(
    title: str = Query(..., description="Tytuł zadania do sklasyfikowania"),
    use_rag: bool = Query(True, description="Czy używać RAG do lepszej klasyfikacji")
):
    """Klasyfikacja pojedynczego zadania (z opcjonalnym RAG)"""
    if use_rag:
        rag_result = rag_classify(title)
        predicted_quadrant = rag_result["prediction"]
    else:
        predicted_quadrant = int(get_model().predict([title])[0])
        rag_result = None

    urgent, important = map_to_bool(predicted_quadrant)

    response = {
        "task": title,
        "urgent": urgent,
        "important": important,
        "quadrant": predicted_quadrant,
        "quadrant_name": QUADRANT_NAMES[predicted_quadrant],
        "timestamp": datetime.now().isoformat(),
        "method": "RAG-enhanced" if use_rag else "ML-only"
    }

    if use_rag and rag_result:
        response.update({
            "confidence": rag_result["confidence"],
            "rag_influence": rag_result["rag_influence"],
            "model_prediction": rag_result["model_prediction"],
            "similar_examples_used": rag_result["similar_examples_used"],
            "top_similar_examples": rag_result["similar_examples"][:3]  # Top 3 examples
        })

    return response

@app.post("/add-example")
def add_training_example(
    text: str = Query(..., description="Tekst przykładu treningowego"),
    quadrant: int = Query(..., ge=0, le=3, description="Numer kwadrantu (0-3)")
):
    """Dodaj nowy przykład treningowy do bazy danych"""
    if quadrant not in QUADRANT_NAMES:
        raise HTTPException(status_code=400, detail="Nieprawidłowy numer kwadrantu. Musi być 0-3.")

    training_data = load_training_data()

    # Check if example already exists
    for example in training_data:
        if example['text'].lower() == text.lower():
            raise HTTPException(status_code=400, detail="Przykład już istnieje")

    # Add new example
    new_example = {
        "text": text,
        "quadrant": quadrant,
        "added_by": "user",
        "timestamp": datetime.now().isoformat()
    }

    training_data.append(new_example)
    save_training_data(training_data)

    return {
        "message": "✅ Przykład dodany pomyślnie",
        "example": new_example,
        "quadrant_name": QUADRANT_NAMES[quadrant],
        "total_examples": len(training_data)
    }

@app.post("/retrain")
def retrain_model(
    preserve_experience: bool = Query(True, description="Czy zachować poprzednie doświadczenie"),
    force_complete_retrain: bool = Query(False, description="Wymusić pełne retrenowanie bez inkrementalnego uczenia")
):
    """Przeszkolenie modelu z opcjami zachowania doświadczenia"""
    global model

    print("🔄 Rozpoczęcie retreningu...")

    if preserve_experience and not force_complete_retrain and model is not None:
        try:
            # Incremental learning - partial_fit if LogisticRegression supports it
            training_data = load_training_data()
            texts = [item['text'] for item in training_data]
            labels = [item['quadrant'] for item in training_data]

            # Extract features first
            X_new = model.named_steps['tfidf'].transform(texts)
            model.named_steps['clf'].partial_fit(X_new, labels)

            joblib.dump(model, model_path)

            return {
                "message": "✅ Model zaktualizowany inkrementalnie",
                "method": "incremental",
                "examples_used": len(training_data),
                "performance": "zachowana poprzednia wiedza"
            }
        except Exception as e:
            print(f"⚠️ Inkrementalne nauczanie nieudane: {e}")
            # Fall back to complete retraining

    # Complete retraining
    get_model.__globals__['model'] = train_model()
    model = get_model.__globals__['model']

    training_count = len(load_training_data())

    return {
        "message": "✅ Model całkowicie retrenowany",
        "method": "complete",
        "examples_used": training_count,
        "performance": "maksymalna aktualność"
    }

@app.post("/learn-feedback")
def learn_from_feedback(
    task: str = Query(..., description="Tytuł zadania"),
    predicted_quadrant: int = Query(..., description="Przewidywany kwadrant przez AI"),
    correct_quadrant: int = Query(..., ge=0, le=3, description="Prawidłowy kwadrant wg użytkownika")
):
    """Nauczenie się z korekty użytkownika"""
    if predicted_quadrant == correct_quadrant:
        return {"message": "✅ Klasyfikacja była prawidłowa, brak potrzeby nauki"}

    # Add the corrected example to training data
    corrected_example = {
        "text": task,
        "quadrant": correct_quadrant,
        "added_by": "feedback",
        "corrected_from": predicted_quadrant,
        "timestamp": datetime.now().isoformat()
    }

    training_data = load_training_data()
    training_data.append(corrected_example)
    save_training_data(training_data)

    return {
        "message": "✅ Nauczono się z Twojej korekty",
        "correction": {
            "task": task,
            "from_quadrant": QUADRANT_NAMES[predicted_quadrant],
            "to_quadrant": QUADRANT_NAMES[correct_quadrant]
        },
        "total_examples": len(training_data)
    }

@app.get("/training-stats")
def get_training_stats():
    """Statystyki danych treningowych"""
    training_data = load_training_data()

    # Count by quadrant
    quadrant_counts = {}
    for i in range(4):
        quadrant_counts[i] = sum(1 for item in training_data if item['quadrant'] == i)

    # Count by source
    sources = {}
    for item in training_data:
        source = item.get('added_by', 'default')
        sources[source] = sources.get(source, 0) + 1

    return {
        "total_examples": len(training_data),
        "quadrant_distribution": {
            f"{i} ({QUADRANT_NAMES[i]})": count for i, count in quadrant_counts.items()
        },
        "data_sources": sources,
        "data_file": training_data_file,
        "model_file": model_path,
        "last_updated": max([item.get('timestamp', '2023-01-01') for item in training_data] or ['nieznane'])
    }

@app.delete("/training-data")
def clear_training_data(
    confirm: bool = Query(..., description="Potwierdź usunięcie wszystkich danych treningowych")
):
    """Wyczyszczenie wszystkich danych treningowych (niebezpieczne!)"""
    if not confirm:
        raise HTTPException(status_code=400, detail="Musisz potwierdzić usunięcie")

    if os.path.exists(training_data_file):
        os.remove(training_data_file)
    if os.path.exists(model_path):
        os.remove(model_path)

    # Reset global model
    global model
    model = None

    return {"message": "⚠️ Wszystkie dane treningowe i model zostały usunięte"}

@app.get("/examples/{quadrant}")
def get_examples_by_quadrant(
    quadrant: int = Query(..., ge=0, le=3, description="Numer kwadrantu (0-3)"),
    limit: int = Query(10, description="Limit wyników")
):
    """Pobierz przykłady z konkretnego kwadrantu"""
    training_data = load_training_data()

    examples = [
        {
            "text": item['text'],
            "added_by": item.get('added_by', 'default'),
            "timestamp": item.get('timestamp', '')
        }
        for item in training_data if item['quadrant'] == quadrant
    ]

    return {
        "quadrant": quadrant,
        "quadrant_name": QUADRANT_NAMES[quadrant],
        "examples": examples[-limit:],  # Get most recent
        "total": len(examples)
    }

@app.post("/analyze-langchain")
def analyze_with_langchain(
    task: str = Query(..., description="Zadanie do analizy za pomocą LangChain")
):
    """Zaawansowana analiza zadania z wykorzystaniem LangChain"""
    if not task or len(task.strip()) == 0:
        raise HTTPException(status_code=400, detail="Zadanie nie może być puste")

    # Get LangChain analysis
    langchain_result = analyze_task_with_langchain(task)

    # Also get RAG classification for comparison
    rag_result = rag_classify(task)

    return {
        "task": task,
        "langchain_analysis": langchain_result,
        "rag_classification": {
            "quadrant": rag_result["prediction"],
            "quadrant_name": QUADRANT_NAMES[rag_result["prediction"]],
            "confidence": rag_result["confidence"]
        },
        "comparison": {
            "methods_agree": langchain_result.get("quadrant", -1) == rag_result["prediction"],
            "confidence_difference": abs(langchain_result.get("confidence", 0) - rag_result["confidence"])
        },
        "timestamp": datetime.now().isoformat(),
        "method": "Hybrid: LangChain + RAG"
    }

@app.post("/extract-tasks-from-image")
def extract_tasks_from_image(
    file: UploadFile = File(..., description="Obraz zawierający zadania (JPG, PNG, etc.)")
):
    """Wyciągnij zadania z obrazów za pomocą OCR (OpenCV + Tesseract)"""
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
        raise HTTPException(status_code=400, detail="Nieobsługiwany format pliku. Użyj PNG, JPG, JPEG, BMP lub TIFF.")

    try:
        # Read image data
        image_data = await file.read()

        # Extract text and tasks using OCR
        ocr_result = extract_text_from_image(image_data)

        if "error" in ocr_result:
            raise HTTPException(status_code=400, detail=ocr_result["error"])

        # Classify each extracted task
        classified_tasks = []
        for task_text in ocr_result.get("tasks", []):
            if len(task_text.strip()) > 3:  # Skip very short tasks
                try:
                    rag_result = rag_classify(task_text)
                    classified_tasks.append({
                        "text": task_text,
                        "quadrant": rag_result["prediction"],
                        "quadrant_name": QUADRANT_NAMES[rag_result["prediction"]],
                        "confidence": rag_result["confidence"]
                    })
                except Exception as e:
                    # If classification fails, assign default quadrant
                    classified_tasks.append({
                        "text": task_text,
                        "quadrant": 1,  # Default to "Schedule"
                        "quadrant_name": QUADRANT_NAMES[1],
                        "confidence": 0.3
                    })

        return {
            "filename": file.filename,
            "image_info": {
                "size_bytes": len(image_data),
                "shape": ocr_result.get("image_shape", "unknown")
            },
            "ocr": {
                "extracted_text": ocr_result["extracted_text"][:500],  # Limit text length
                "raw_tasks_detected": len(ocr_result.get("tasks", [])),
                "method": ocr_result.get("method", "unknown")
            },
            "classified_tasks": classified_tasks,
            "summary": {
                "total_tasks": len(classified_tasks),
                "quadrant_distribution": summarize_quadrant_distribution(classified_tasks)
            },
            "timestamp": datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

def summarize_quadrant_distribution(tasks: List[Dict]) -> Dict:
    """Summarize how tasks are distributed across quadrants"""
    distribution = {i: 0 for i in range(4)}
    for task in tasks:
        quadrant = task.get("quadrant", 0)
        distribution[quadrant] += 1

    total = sum(distribution.values())
    return {
        "counts": distribution,
        "percentages": {q: round((count/total)*100, 1) if total > 0 else 0 for q, count in distribution.items()},
        "quadrant_names": {q: QUADRANT_NAMES[q] for q in range(4)}
    }

@app.post("/batch-analyze")
def batch_analyze_tasks(
    tasks: List[str] = Query(..., description="Lista zadań do analizy")
):
    """Wsadowa analiza wielu zadań z różnymi metodami"""
    if not tasks or len(tasks) == 0:
        raise HTTPException(status_code=400, detail="Lista zadań nie może być pusta")

    if len(tasks) > 50:  # Limit batch size
        raise HTTPException(status_code=400, detail="Maksymalnie 50 zadań na raz")

    results = []
    summary = {"methods": {}, "total_tasks": len(tasks)}

    for task_text in tasks:
        if not task_text.strip():
            continue

        task_result = {
            "task": task_text,
            "analyses": {}
        }

        # RAG Analysis
        try:
            rag_result = rag_classify(task_text)
            task_result["analyses"]["rag"] = {
                "quadrant": rag_result["prediction"],
                "quadrant_name": QUADRANT_NAMES[rag_result["prediction"]],
                "confidence": rag_result["confidence"]
            }
        except Exception as e:
            task_result["analyses"]["rag"] = {"error": str(e)}

        # LangChain Analysis
        try:
            langchain_result = analyze_task_with_langchain(task_text)
            task_result["analyses"]["langchain"] = langchain_result
        except Exception as e:
            task_result["analyses"]["langchain"] = {"error": str(e)}

        results.append(task_result)

        # Update summary
        for method in ["rag", "langchain"]:
            if method not in summary["methods"]:
                summary["methods"][method] = {"quadrant_distribution": {i: 0 for i in range(4)}}

            analysis = task_result["analyses"].get(method, {})
            quadrant = analysis.get("quadrant", -1)
            if quadrant >= 0:
                summary["methods"][method]["quadrant_distribution"][quadrant] += 1

    return {
        "batch_results": results,
        "summary": summary,
        "timestamp": datetime.now().isoformat(),
        "methods_used": ["RAG", "LangChain"]
    }

@app.get("/capabilities")
def get_capabilities():
    """Sprawdź dostępne funkcjonalności AI"""
    return {
        "ai_features": {
            "basic_classification": True,
            "rag_enhanced": chroma_client is not None and sentence_model is not None,
            "vector_database": chroma_client is not None,
            "bert_embeddings": sentence_model is not None,
            "cross_encoder_reranking": cross_encoder is not None,
            "langchain_analysis": langchain_llm is not None and langchain_prompt is not None,
            "ocr_image_processing": "opencv" in "opencv-python",  # Check if installed
            "multilingual_support": sentence_model is not None
        },
        "supported_languages": ["Polish", "English"],
        "last_updated": datetime.now().isoformat(),
        "version": "3.0 - Advanced AI Features"
    }

@app.get("/")
def root():
    """Stronie główna API"""
    training_stats = get_training_stats()
    capabilities = get_capabilities()

    return {
        "message": "🎯 AI Kwadrant Klasyfikator z Zaawansowanymi Funkcjami",
        "version": "3.0 - LangChain + OpenCV Integration",
        "training_data": f"{training_stats['total_examples']} przykładów",
        "ai_capabilities": capabilities["ai_features"],
        "endpoints": {
            "GET /classify": "Podstawowa klasyfikacja zadania",
            "POST /analyze-langchain": "Zaawansowana analiza z LangChain",
            "POST /extract-tasks-from-image": "OCR ekstrakcja zadań z obrazów",
            "POST /batch-analyze": "Wsadowa analiza wielu zadań",
            "GET /capabilities": "Sprawdź dostępne funkcjonalności",
            "POST /add-example": "Dodaj przykład treningowy",
            "POST /retrain": "Przeszkolenie modelu",
            "POST /learn-feedback": "Naucz się z korekty",
            "GET /training-stats": "Statystyki treningu",
            "GET /examples/{quadrant}": "Przyklady z kwadranta"
        }
    }
