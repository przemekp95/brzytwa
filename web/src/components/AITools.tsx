import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdvancedAIAnalysis from './ai/AdvancedAIAnalysis';
import ImageUpload from './ai/ImageUpload';
import BatchAnalysis from './ai/BatchAnalysis';
import AIManagement from './ai/AIManagement';
import { LangChainAnalysis, OCRResult, BatchAnalysisResult } from '../services/api';
import { useLanguage } from '../i18n/LanguageContext';

interface AIToolsProps {
  taskTitle: string;
  onClose: () => void;
  onAnalysisComplete?: (analysis: LangChainAnalysis) => void;
}

function AITools({ taskTitle, onClose, onAnalysisComplete }: AIToolsProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'langchain' | 'ocr' | 'batch' | 'manage'>('langchain');

  const tools = [
    {
      id: 'langchain' as const,
      title: t('ai.tabs.langchain'),
      description: t('ai.tabs.langchain.desc'),
      component: AdvancedAIAnalysis,
    },
    {
      id: 'ocr' as const,
      title: t('ai.tabs.ocr'),
      description: t('ai.tabs.ocr.desc'),
      component: ImageUpload,
    },
    {
      id: 'batch' as const,
      title: t('ai.tabs.batch'),
      description: t('ai.tabs.batch.desc'),
      component: BatchAnalysis,
    },
    {
      id: 'manage' as const,
      title: t('ai.tabs.manage'),
      description: t('ai.tabs.manage.desc'),
      component: AIManagement,
    }
  ];

  const handleAnalysisComplete = (analysis: LangChainAnalysis) => {
    onAnalysisComplete?.(analysis);
  };

  const handleTasksExtracted = (result: OCRResult) => {
    // Optional: Could add extracted tasks to the main matrix
    console.log('Tasks extracted:', result);
  };

  const handleBatchComplete = (result: BatchAnalysisResult) => {
    // Optional: Could summarize batch results
    console.log('Batch analysis complete:', result);
  };

  const renderActiveComponent = () => {
    const activeTool = tools.find(tool => tool.id === activeTab);
    if (!activeTool) return null;

    const { component: Component, ...props } = activeTool;

    switch (activeTab) {
      case 'langchain':
        return (
          <AdvancedAIAnalysis
            taskTitle={taskTitle}
            onAnalysisComplete={handleAnalysisComplete}
            {...props}
          />
        );
      case 'ocr':
        return (
          <ImageUpload
            onTasksExtracted={handleTasksExtracted}
            {...props}
          />
        );
      case 'batch':
        return (
          <BatchAnalysis
            onBatchComplete={handleBatchComplete}
            {...props}
          />
        );
      case 'manage':
        return (
          <AIManagement
            onModelUpdated={() => console.log('AI model updated')}
            {...props}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/20">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">{t('ai.tools.title')}</h2>
              <p className="text-white/80">{t('ai.tools.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-white/80 text-2xl"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTab(tool.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tool.id
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'bg-white/10 text-white/70 hover:bg-white/15'
                }`}
              >
                <div className="text-left">
                  <div className="font-semibold">{tool.title}</div>
                  <div className="text-xs opacity-75">{tool.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderActiveComponent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/20 bg-black/20">
          <div className="flex justify-between items-center text-white/60 text-sm">
            <div>
              Backend AI: FastAPI + LangChain + OpenCV + ChromaDB
            </div>
            <div>
              Wszystkie analizy są przetwarzane lokalnie
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default AITools;
