export type Language = 'en' | 'pl';

export const translations = {
  en: {
    // Matrix quadrants
    'matrix.do': 'Do Now',
    'matrix.schedule': 'Schedule',
    'matrix.delegate': 'Delegate',
    'matrix.delete': 'Delete',

    // Form labels
    'form.addTask': 'Add New Task',
    'form.title': 'Title',
    'form.description': 'Description',
    'form.urgent': 'Urgent',
    'form.important': 'Important',
    'form.submit': 'Add Task',

    // AI features
    'ai.suggesting': '🤖 AI analyzing...',
    'ai.suggest': '🤖 AI Suggest Quadrant',
    'ai.tools': '🛠️ AI Tools',

    // AI Tools modal
    'ai.tools.title': '🧠 AI Tools',
    'ai.tools.subtitle': 'Advanced AI functionalities',

    // AI tool tabs
    'ai.tabs.langchain': '🧠 Advanced Analysis',
    'ai.tabs.langchain.desc': 'LangChain + RAG reasoning',
    'ai.tabs.ocr': '📷 OCR from Images',
    'ai.tabs.ocr.desc': 'Extract tasks from photos',
    'ai.tabs.batch': '📊 Batch Analysis',
    'ai.tabs.batch.desc': 'Analyze multiple tasks at once',
    'ai.tabs.manage': '🛠️ AI Management',
    'ai.tabs.manage.desc': 'Training and model stats',

    // Footer
    'footer.backend': 'Backend AI: FastAPI + LangChain + OpenCV + ChromaDB',
    'footer.local': 'All analyses are processed locally',
    'ai.close': 'Close',
  },
  pl: {
    // Matrix quadrants
    'matrix.do': 'Zrób Teraz',
    'matrix.schedule': 'Zaplanuj',
    'matrix.delegate': 'Deleguj',
    'matrix.delete': 'Usuń',

    // Form labels
    'form.addTask': 'Dodaj Nowe Zadanie',
    'form.title': 'Tytuł',
    'form.description': 'Opis',
    'form.urgent': 'Pilne',
    'form.important': 'Ważne',
    'form.submit': 'Dodaj Zadanie',

    // AI features
    'ai.suggesting': '🤖 AI analizuje...',
    'ai.suggest': '🤖 AI Sugeruje Kwadrant',
    'ai.tools': '🛠️ Narzędzia AI',

    // AI Tools modal
    'ai.tools.title': '🧠 Narzędzia AI',
    'ai.tools.subtitle': 'Zaawansowane funkcjonalności sztucznej inteligencji',
    'ai.close': 'Zamknij',

    // AI tool tabs
    'ai.tabs.langchain': '🧠 Zaawansowana Analiza',
    'ai.tabs.langchain.desc': 'LangChain + RAG reasoning',
    'ai.tabs.ocr': '📷 OCR z Obrazów',
    'ai.tabs.ocr.desc': 'Wyciągnij zadania z fotografii',
    'ai.tabs.batch': '📊 Wsadowa Analiza',
    'ai.tabs.batch.desc': 'Analizuj wiele zadań naraz',
    'ai.tabs.manage': '🛠️ Zarządzanie AI',
    'ai.tabs.manage.desc': 'Trening i statystyki modelu',

    // Footer
    'footer.backend': 'Backend AI: FastAPI + LangChain + OpenCV + ChromaDB',
    'footer.local': 'Wszystkie analizy są przetwarzane lokalnie',
  }
};

export type TranslationKey = keyof typeof translations.en;
