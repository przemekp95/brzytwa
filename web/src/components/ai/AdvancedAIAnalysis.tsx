import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { analyzeWithLangChain, LangChainAnalysis } from '../../services/api';

interface AdvancedAIAnalysisProps {
  taskTitle: string;
  onAnalysisComplete: (analysis: LangChainAnalysis) => void;
}

function AdvancedAIAnalysis({ taskTitle, onAnalysisComplete }: AdvancedAIAnalysisProps) {
  const [analysis, setAnalysis] = useState<LangChainAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAdvancedAnalysis = async () => {
    if (!taskTitle.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await analyzeWithLangChain(taskTitle);
      setAnalysis(result);
      onAnalysisComplete(result);
    } catch (err) {
      console.error('Advanced analysis failed:', err);
      setError('Nie udało się wykonać zaawansowanej analizy');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4"
    >
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
        🧠 Zaawansowana Analiza AI (LangChain)
      </h3>

      <button
        onClick={runAdvancedAnalysis}
        disabled={loading || !taskTitle.trim()}
        className="w-full mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 rounded hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '🧠 Analizuję...' : 'Uruchom Zaawansowaną Analizę'}
      </button>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {analysis && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          {/* Task Info */}
          <div className="bg-white/20 rounded p-3">
            <h4 className="font-medium text-white mb-2">📝 Zadanie:</h4>
            <p className="text-white/90">{analysis.task}</p>
          </div>

          {/* LangChain Analysis */}
          <div className="bg-white/20 rounded p-3">
            <h4 className="font-medium text-white mb-2 flex items-center">
              🔍 Analiza LangChain
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(analysis.langchain_analysis.confidence)}`}>
                {Math.round(analysis.langchain_analysis.confidence * 100)}% pewności
              </span>
            </h4>
            <p className="text-white/90 mb-2">
              Kwadrant: <strong>{analysis.langchain_analysis.quadrant}</strong> - {analysis.langchain_analysis.method}
            </p>
            {analysis.langchain_analysis.reasoning && (
              <div className="text-white/80 text-sm">
                <strong>Rozumowanie:</strong> {analysis.langchain_analysis.reasoning}
              </div>
            )}
          </div>

          {/* RAG Classification */}
          <div className="bg-white/20 rounded p-3">
            <h4 className="font-medium text-white mb-2 flex items-center">
              🎯 Klasyfikacja RAG
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(analysis.rag_classification.confidence)}`}>
                {Math.round(analysis.rag_classification.confidence * 100)}% pewności
              </span>
            </h4>
            <p className="text-white/90">
              Kwadrant: <strong>{analysis.rag_classification.quadrant}</strong> - {analysis.rag_classification.quadrant_name}
            </p>
          </div>

          {/* Comparison */}
          <div className="bg-white/20 rounded p-3">
            <h4 className="font-medium text-white mb-2">⚖️ Porównanie Metod</h4>
            <div className="grid grid-cols-2 gap-4 text-white/90">
              <div>
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${analysis.comparison.methods_agree ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                Metody zgodne: {analysis.comparison.methods_agree ? 'Tak' : 'Nie'}
              </div>
              <div>
                Różnica pewności: {Math.round(analysis.comparison.confidence_difference * 100)}%
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-white/60">
            Timestamp: {new Date(analysis.timestamp).toLocaleString()}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default AdvancedAIAnalysis;
