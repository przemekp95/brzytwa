import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { batchAnalyzeTasks, BatchAnalysisResult } from '../../services/api';

interface BatchAnalysisProps {
  onBatchComplete: (result: BatchAnalysisResult) => void;
}

function BatchAnalysis({ onBatchComplete }: BatchAnalysisProps) {
  const [taskList, setTaskList] = useState('');
  const [result, setResult] = useState<BatchAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const tasks = taskList.split('\n').map(task => task.trim()).filter(task => task.length > 0);

    if (tasks.length === 0) {
      setError('Wprowadź przynajmniej jedno zadanie');
      return;
    }

    if (tasks.length > 50) {
      setError('Maksymalnie 50 zadań jednocześnie');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const batchResult = await batchAnalyzeTasks(tasks);
      setResult(batchResult);
      onBatchComplete(batchResult);
    } catch (err) {
      console.error('Batch analysis failed:', err);
      setError('Nie udało się wykonać wsadowej analizy');
    } finally {
      setLoading(false);
    }
  };

  const getQuadrantColor = (quadrant: number) => {
    const colors = {
      0: 'border-red-400 bg-red-50 text-red-800',
      1: 'border-yellow-400 bg-yellow-50 text-yellow-800',
      2: 'border-blue-400 bg-blue-50 text-blue-800',
      3: 'border-green-400 bg-green-50 text-green-800'
    };
    return colors[quadrant as keyof typeof colors] || 'border-gray-400 bg-gray-50 text-gray-800';
  };

  const getQuadrantName = (quadrant: number) => {
    const names = { 0: 'Do Now', 1: 'Schedule', 2: 'Delegate', 3: 'Delete' };
    return names[quadrant as keyof typeof names] || 'Nieznany';
  };

  const getMethodBadgeColor = (method: string) => {
    return method.includes('rag') ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6"
    >
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
        📊 Wsadowa Analiza Zadań
        <span className="ml-2 text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
          Maksymalnie 50 zadań
        </span>
      </h3>

      {/* Input */}
      <div className="mb-4">
        <label className="block text-white font-medium mb-2">
          Lista zadań (jedno zadanie per linia):
        </label>
        <textarea
          value={taskList}
          onChange={(e) => setTaskList(e.target.value)}
          placeholder="Wpisz zadania, każde w oddzielnej linii:&#10;&#10;Zadzwonić do klienta&#10;Przygotować prezentację&#10;Sprawdzić maile"
          className="w-full h-32 p-3 rounded border border-white/50 bg-white/20 text-white placeholder:text-white/50"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleAnalyze}
          disabled={loading || taskList.trim().length === 0}
          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '📊 Analizuję zadania...' : `📊 Przeanalizuj ${taskList.split('\n').filter(t => t.trim()).length} zadań`}
        </button>
        <button
          onClick={() => setTaskList('')}
          className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
        >
          🗑️ Wyczyść
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          ❌ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          {/* Summary */}
          <div className="bg-white/20 rounded p-4">
            <h4 className="text-white font-medium mb-3">📈 Podsumowanie metody:</h4>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(result.summary.methods).map(([method, stats]: [string, any]) => (
                <div key={method} className="bg-white/10 p-3 rounded">
                  <div className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${getMethodBadgeColor(method)}`}>
                    {method.toUpperCase()}
                  </div>
                  <div className="text-white/90 text-sm">
                    {Object.entries(stats.quadrant_distribution).map(([quad, count]: [string, any]) => (
                      <div key={quad} className="flex justify-between">
                        <span>{getQuadrantName(parseInt(quad))}:</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Task Results */}
          <div className="bg-white/20 rounded p-4">
            <h4 className="text-white font-medium mb-3">📋 Szczegóły zadań:</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {result.batch_results.map((taskResult, index) => (
                <div key={index} className="bg-white/10 p-3 rounded">
                  <h5 className="font-medium text-white mb-2 flex items-center">
                    📝 {taskResult.task}
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* RAG Method */}
                    {taskResult.analyses.rag && typeof taskResult.analyses.rag === 'object' && (
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-green-700">RAG</span>
                          <span className="text-xs text-green-600">
                            {taskResult.analyses.rag.confidence ? Math.round(taskResult.analyses.rag.confidence * 100) : '?'}% pewności
                          </span>
                        </div>
                        <div className={`text-sm font-medium ${getQuadrantColor(taskResult.analyses.rag.quadrant || 0)}`}>
                          {getQuadrantName(taskResult.analyses.rag.quadrant || 0)}
                        </div>
                      </div>
                    )}

                    {/* LangChain Method */}
                    {taskResult.analyses.langchain && typeof taskResult.analyses.langchain === 'object' && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-blue-700">LangChain</span>
                          <span className="text-xs text-blue-600">
                            {taskResult.analyses.langchain.confidence ? Math.round(taskResult.analyses.langchain.confidence * 100) : '?'}% pewności
                          </span>
                        </div>
                        <div className={`text-sm font-medium ${getQuadrantColor(taskResult.analyses.langchain.quadrant || 0)}`}>
                          {getQuadrantName(taskResult.analyses.langchain.quadrant || 0)}
                        </div>
                        {taskResult.analyses.langchain.reasoning && (
                          <div className="text-xs text-blue-600 mt-1 line-clamp-2">
                            {taskResult.analyses.langchain.reasoning}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Errors */}
                  {((taskResult.analyses.rag && typeof taskResult.analyses.rag === 'object' && taskResult.analyses.rag.error) ||
                    (taskResult.analyses.langchain && typeof taskResult.analyses.langchain === 'object' && taskResult.analyses.langchain.error)) && (
                    <div className="mt-2 text-xs text-red-600">
                      ⚠️ Błędy w analizie: {taskResult.analyses.rag?.error || taskResult.analyses.langchain?.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-center text-xs text-white/60">
            Wsadowa analiza wykonana: {new Date(result.timestamp).toLocaleString()}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default BatchAnalysis;
