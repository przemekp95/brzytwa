import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  addTrainingExample,
  retrainModel,
  learnFromFeedback,
  getTrainingStats,
  getExamplesByQuadrant,
  TrainingStats,
  TrainingExample
} from '../../services/api';

interface AIManagementProps {
  onModelUpdated: () => void;
}

function AIManagement({ onModelUpdated }: AIManagementProps) {
  const [activeTab, setActiveTab] = useState<'add-example' | 'retrain' | 'feedback' | 'stats' | 'examples'>('stats');
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [examples, setExamples] = useState<Record<number, TrainingExample[]>>({});
  const [selectedQuadrant, setSelectedQuadrant] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  // Form states
  const [newExample, setNewExample] = useState({ text: '', quadrant: 0 });
  const [feedback, setFeedback] = useState({ task: '', predictedQuadrant: 0, correctQuadrant: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const trainingStats = await getTrainingStats();
      setStats(trainingStats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadExamples = async (quadrant: number) => {
    try {
      const result = await getExamplesByQuadrant(quadrant);
      setExamples(prev => ({ ...prev, [quadrant]: result.examples || [] }));
    } catch (err) {
      console.error('Failed to load examples:', err);
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAddExample = async () => {
    if (!newExample.text.trim()) {
      showMessage('Wpisz tekst przykładu');
      return;
    }

    setLoading(true);
    try {
      await addTrainingExample(newExample.text, newExample.quadrant);
      setNewExample({ text: '', quadrant: 0 });
      showMessage('✅ Przykład dodany pomyślnie');
      loadStats();
      onModelUpdated();
    } catch (err) {
      showMessage('❌ Nie udało się dodać przykładu');
    } finally {
      setLoading(false);
    }
  };

  const handleRetrain = async (preserveExperience = true) => {
    setLoading(true);
    try {
      const result = await retrainModel(preserveExperience);
      showMessage(`✅ Model retrenowany: ${preserveExperience ? 'zachowano' : 'resetowano'} doświadczenie`);
      loadStats();
      onModelUpdated();
    } catch (err) {
      showMessage('❌ Nie udało się retrenować modelu');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async () => {
    if (!feedback.task.trim()) {
      showMessage('Wpisz zadanie');
      return;
    }

    setLoading(true);
    try {
      await learnFromFeedback(feedback.task, feedback.predictedQuadrant, feedback.correctQuadrant);
      setFeedback({ task: '', predictedQuadrant: 0, correctQuadrant: 0 });
      showMessage('✅ AI nauczyło się z Twojej korekty');
      loadStats();
      onModelUpdated();
    } catch (err) {
      showMessage('❌ Nie udało się wysłać feedback');
    } finally {
      setLoading(false);
    }
  };

  const getQuadrantName = (quadrant: number) => {
    const names = {
      0: 'Do Now (Pilne + Ważne)',
      1: 'Schedule (Pilne)',
      2: 'Delegate (Ważne)',
      3: 'Delete (Nie ważne)'
    };
    return names[quadrant as keyof typeof names] || 'Nieznany';
  };

  const tabs = [
    { id: 'stats', label: '📊 Statystyki', icon: '📊' },
    { id: 'add-example', label: '➕ Dodaj Przykład', icon: '➕' },
    { id: 'retrain', label: '🔄 Retrain', icon: '🔄' },
    { id: 'feedback', label: '🎓 Naucz się', icon: '🎓' },
    { id: 'examples', label: '📚 Przykłady', icon: '📚' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-sm rounded-lg p-6"
    >
      <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
        🛠️ Zarządzanie AI
        <span className="ml-2 text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
          Zaawansowane funkcje
        </span>
      </h3>

      {/* Message */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white/20 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/15'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Stats Tab */}
        {activeTab === 'stats' && stats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/20 p-4 rounded text-center">
                <div className="text-2xl font-bold text-white">{stats.total_examples}</div>
                <div className="text-sm text-white/70">Razem przykładów</div>
              </div>
              <div className="bg-white/20 p-4 rounded text-center">
                <div className="text-2xl font-bold text-white">{Object.values(stats.quadrant_distribution).reduce((a, b) => a + b, 0)}</div>
                <div className="text-sm text-white/70">Przykładów szkolonych</div>
              </div>
              <div className="bg-white/20 p-4 rounded text-center">
                <div className="text-2xl font-bold text-white">{Object.keys(stats.data_sources).length}</div>
                <div className="text-sm text-white/70">Źródeł danych</div>
              </div>
              <div className="bg-white/20 p-4 rounded text-center">
                <div className="text-xs text-white/70">Ostatnia aktualizacja</div>
                <div className="text-sm font-medium text-white">{new Date(stats.last_updated).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="bg-white/20 p-4 rounded">
              <h4 className="text-white font-medium mb-3">📊 Rozkład po kwadrantach:</h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(stats.quadrant_distribution).map(([quad, count]) => (
                  <div key={quad} className="flex justify-between bg-white/10 p-2 rounded">
                    <span className="text-white/90">{getQuadrantName(parseInt(quad))}:</span>
                    <span className="font-medium text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/20 p-4 rounded">
              <h4 className="text-white font-medium mb-3">📝 Źródła danych:</h4>
              <div className="space-y-2">
                {Object.entries(stats.data_sources).map(([source, count]) => (
                  <div key={source} className="flex justify-between">
                    <span className="text-white/90 capitalize">{source}:</span>
                    <span className="font-medium text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Add Example Tab */}
        {activeTab === 'add-example' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="bg-white/20 p-4 rounded">
              <h4 className="text-white font-medium mb-3">➕ Dodaj nowy przykład treningowy</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-white/90 text-sm mb-1">Tekst zadania:</label>
                  <textarea
                    value={newExample.text}
                    onChange={(e) => setNewExample(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="Np. 'Pilnie naprawić błąd w systemie'"
                    className="w-full p-3 rounded border border-white/50 bg-white/20 text-white placeholder:text-white/50"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-white/90 text-sm mb-1">Kwadrant:</label>
                  <select
                    value={newExample.quadrant}
                    onChange={(e) => setNewExample(prev => ({ ...prev, quadrant: parseInt(e.target.value) }))}
                    className="w-full p-3 rounded border border-white/50 bg-white/20 text-white"
                  >
                    {[0, 1, 2, 3].map(q => (
                      <option key={q} value={q}>{getQuadrantName(q)}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleAddExample}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded disabled:opacity-50"
                >
                  {loading ? '💾 Dodaję...' : '➕ Dodaj przykład'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Retrain Tab */}
        {activeTab === 'retrain' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="bg-white/20 p-4 rounded">
              <h4 className="text-white font-medium mb-3">🔄 Retraining modelu AI</h4>
              <p className="text-white/70 text-sm mb-4">
                Retraining pozwala AI nauczyć się na nowych przykładach i poprawić dokładność.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleRetrain(true)}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded disabled:opacity-50"
                >
                  {loading ? '🔄 Trenowanie...' : '🎯 Zachowaj doświadczenie i retrenuj'}
                </button>
                <button
                  onClick={() => handleRetrain(false)}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded disabled:opacity-50"
                >
                  {loading ? '🔄 Resetowanie...' : '⚠️ Resetuj i retrenuj od nowa'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="bg-white/20 p-4 rounded">
              <h4 className="text-white font-medium mb-3">🎓 Naucz AI z Twojej korekty</h4>
              <p className="text-white/70 text-sm mb-4">
                Jeśli AI błędnie sklasyfikowało zadanie, popraw je tutaj żeby mogło się nauczyć.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-white/90 text-sm mb-1">Tekst zadania:</label>
                  <input
                    type="text"
                    value={feedback.task}
                    onChange={(e) => setFeedback(prev => ({ ...prev, task: e.target.value }))}
                    placeholder="Wpisz zadanie które AI źle sklasyfikowało"
                    className="w-full p-3 rounded border border-white/50 bg-white/20 text-white placeholder:text-white/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-white/90 text-sm mb-1">Przewidywany kwadrant:</label>
                    <select
                      value={feedback.predictedQuadrant}
                      onChange={(e) => setFeedback(prev => ({ ...prev, predictedQuadrant: parseInt(e.target.value) }))}
                      className="w-full p-3 rounded border border-white/50 bg-white/20 text-white"
                    >
                      {[0, 1, 2, 3].map(q => <option key={q} value={q}>{q} - {getQuadrantName(q)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/90 text-sm mb-1">Poprawny kwadrant:</label>
                    <select
                      value={feedback.correctQuadrant}
                      onChange={(e) => setFeedback(prev => ({ ...prev, correctQuadrant: parseInt(e.target.value) }))}
                      className="w-full p-3 rounded border border-white/50 bg-white/20 text-white"
                    >
                      {[0, 1, 2, 3].map(q => <option key={q} value={q}>{q} - {getQuadrantName(q)}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleFeedback}
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded disabled:opacity-50"
                >
                  {loading ? '🎓 Uczę AI...' : '🎓 Naucz AI tej korekty'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Examples Tab */}
        {activeTab === 'examples' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="bg-white/20 p-4 rounded">
              <h4 className="text-white font-medium mb-3">📚 Przykłady treningowe po kwadrantach</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {[0, 1, 2, 3].map(q => (
                  <button
                    key={q}
                    onClick={() => {
                      setSelectedQuadrant(q);
                      loadExamples(q);
                    }}
                    className={`px-4 py-2 rounded text-sm ${
                      selectedQuadrant === q
                        ? 'bg-white/30 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {getQuadrantName(q)}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {examples[selectedQuadrant]?.length ?
                  examples[selectedQuadrant].map((example, idx) => (
                    <div key={idx} className="bg-white/10 p-3 rounded">
                      <p className="text-white text-sm">"{example.text}"</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-white/60 text-xs">Źródło: {example.added_by}</span>
                        <span className="text-white/60 text-xs">
                          {new Date(example.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-white/50 text-center py-8">
                      Brak przykładów dla tego kwadrantu
                    </p>
                  )
                }
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default AIManagement;
