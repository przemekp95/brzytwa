// API service for connecting to AI backend
const AI_BACKEND_URL = 'http://localhost:8000';

export interface ClassificationResult {
  task: string;
  urgent: boolean;
  important: boolean;
  quadrant: number;
  quadrant_name: string;
  timestamp: string;
  method: string;
  confidence?: number;
  rag_influence?: string;
  similar_examples_used?: number;
  top_similar_examples?: any[];
}

export interface LangChainAnalysis {
  task: string;
  langchain_analysis: {
    quadrant: number;
    reasoning: string;
    confidence: number;
    method: string;
    error?: string;
  };
  rag_classification: {
    quadrant: number;
    quadrant_name: string;
    confidence: number;
  };
  comparison: {
    methods_agree: boolean;
    confidence_difference: number;
  };
  timestamp: string;
}

export interface OCRResult {
  filename: string;
  image_info: {
    size_bytes: number;
    shape: string;
  };
  ocr: {
    extracted_text: string;
    raw_tasks_detected: number;
    method: string;
  };
  classified_tasks: Array<{
    text: string;
    quadrant: number;
    quadrant_name: string;
    confidence: number;
  }>;
  summary: {
    total_tasks: number;
    quadrant_distribution: {
      counts: { [key: number]: number };
      percentages: { [key: number]: number };
      quadrant_names: { [key: number]: string };
    };
  };
  timestamp: string;
}

export interface BatchAnalysisResult {
  batch_results: Array<{
    task: string;
    analyses: {
      rag: any;
      langchain: any;
    };
  }>;
  summary: {
    methods: { [key: string]: any };
    total_tasks: number;
  };
  timestamp: string;
}

export interface TrainingExample {
  text: string;
  quadrant: number;
  added_by: string;
  timestamp: string;
}

export interface TrainingStats {
  total_examples: number;
  quadrant_distribution: { [key: string]: number };
  data_sources: { [key: string]: number };
  data_file: string;
  model_file: string;
  last_updated: string;
}

// Basic classification using RAG
export const classifyTask = async (title: string): Promise<ClassificationResult> => {
  const response = await fetch(`${AI_BACKEND_URL}/classify?title=${encodeURIComponent(title)}&use_rag=true`);
  if (!response.ok) {
    throw new Error('Failed to classify task');
  }
  return response.json();
};

// Advanced LangChain analysis
export const analyzeWithLangChain = async (task: string): Promise<LangChainAnalysis> => {
  const response = await fetch(`${AI_BACKEND_URL}/analyze-langchain?task=${encodeURIComponent(task)}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to analyze with LangChain');
  }
  return response.json();
};

// OCR extraction from images
export const extractTasksFromImage = async (file: File): Promise<OCRResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${AI_BACKEND_URL}/extract-tasks-from-image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to extract tasks from image');
  }
  return response.json();
};

// Batch analysis of multiple tasks
export const batchAnalyzeTasks = async (tasks: string[]): Promise<BatchAnalysisResult> => {
  const response = await fetch(`${AI_BACKEND_URL}/batch-analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tasks }),
  });

  if (!response.ok) {
    throw new Error('Failed to batch analyze tasks');
  }
  return response.json();
};

// Add training example
export const addTrainingExample = async (text: string, quadrant: number): Promise<any> => {
  const response = await fetch(`${AI_BACKEND_URL}/add-example`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      text,
      quadrant: quadrant.toString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to add training example');
  }
  return response.json();
};

// Retrain model
export const retrainModel = async (preserveExperience = true): Promise<any> => {
  const response = await fetch(`${AI_BACKEND_URL}/retrain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      preserve_experience: preserveExperience.toString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to retrain model');
  }
  return response.json();
};

// Learn from user feedback
export const learnFromFeedback = async (
  task: string,
  predictedQuadrant: number,
  correctQuadrant: number
): Promise<any> => {
  const response = await fetch(`${AI_BACKEND_URL}/learn-feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      task,
      predicted_quadrant: predictedQuadrant.toString(),
      correct_quadrant: correctQuadrant.toString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to learn from feedback');
  }
  return response.json();
};

// Get training stats
export const getTrainingStats = async (): Promise<TrainingStats> => {
  const response = await fetch(`${AI_BACKEND_URL}/training-stats`);
  if (!response.ok) {
    throw new Error('Failed to get training stats');
  }
  return response.json();
};

// Get examples by quadrant
export const getExamplesByQuadrant = async (quadrant: number, limit = 10): Promise<any> => {
  const response = await fetch(`${AI_BACKEND_URL}/examples/${quadrant}?limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to get examples');
  }
  return response.json();
};

// Get AI capabilities
export const getCapabilities = async (): Promise<any> => {
  const response = await fetch(`${AI_BACKEND_URL}/capabilities`);
  if (!response.ok) {
    throw new Error('Failed to get capabilities');
  }
  return response.json();
};
