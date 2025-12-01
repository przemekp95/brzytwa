import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { extractTasksFromImage, OCRResult } from '../../services/api';

interface ImageUploadProps {
  onTasksExtracted: (result: OCRResult) => void;
}

function ImageUpload({ onTasksExtracted }: ImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Proszę wybrać plik graficzny (PNG, JPG, JPEG)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Plik jest zbyt duży (maksymalnie 10MB)');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleExtractTasks = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    try {
      const ocrResult = await extractTasksFromImage(selectedFile);
      setResult(ocrResult);
      onTasksExtracted(ocrResult);
    } catch (err) {
      console.error('OCR extraction failed:', err);
      setError('Nie udało się wyekstrahować zadań z obrazu');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview('');
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getTaskQuadrantColor = (quadrant: number) => {
    const colors = {
      0: 'border-red-400 bg-red-50',
      1: 'border-yellow-400 bg-yellow-50',
      2: 'border-blue-400 bg-blue-50',
      3: 'border-green-400 bg-green-50'
    };
    return colors[quadrant as keyof typeof colors] || 'border-gray-400 bg-gray-50';
  };

  const getQuadrantName = (quadrant: number) => {
    const names = {
      0: 'Do Now',
      1: 'Schedule',
      2: 'Delegate',
      3: 'Delete'
    };
    return names[quadrant as keyof typeof names] || 'Nieznany';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6"
    >
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
        📷 Ekstrakcja Zadań z Obrazów (OCR)
        <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
          OpenCV + Tesseract
        </span>
      </h3>

      {/* File Upload */}
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-white/50 hover:border-white/70 rounded-lg py-8 text-white hover:bg-white/10 transition-colors"
        >
          📤 Wybierz obraz z zadaniami (PNG/JPG)
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="mb-4">
          <h4 className="text-white font-medium mb-2">Podgląd:</h4>
          <div className="relative inline-block">
            <img
              src={preview}
              alt="Podgląd"
              className="max-h-48 rounded-lg shadow-lg"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {selectedFile && (
        <div className="flex gap-3 mb-4">
          <button
            onClick={handleExtractTasks}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '🔍 Analizuję obraz...' : '🔍 Wyciągnij zadania'}
          </button>
          <button
            onClick={handleReset}
            className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
          >
            🔄 Reset
          </button>
        </div>
      )}

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
          {/* Image Info */}
          <div className="bg-white/20 rounded p-4">
            <h4 className="text-white font-medium mb-3">📊 Informacje o obrazie:</h4>
            <div className="grid grid-cols-2 gap-4 text-white/90 text-sm">
              <div>Rozmiar: {(result.image_info.size_bytes / 1024).toFixed(1)} KB</div>
              <div>Wymiary: {result.image_info.shape}</div>
              <div>Zadań wykrytych: {result.classified_tasks.length}</div>
              <div>Metoda: {result.ocr.method}</div>
            </div>
          </div>

          {/* Extracted Text */}
          <div className="bg-white/20 rounded p-4">
            <h4 className="text-white font-medium mb-2">📝 Wyciągnięty tekst:</h4>
            <div className="bg-white/10 p-3 rounded text-white/90 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
              {result.ocr.extracted_text}
            </div>
          </div>

          {/* Classified Tasks */}
          <div className="bg-white/20 rounded p-4">
            <h4 className="text-white font-medium mb-3">🎯 Sklasyfikowane zadania:</h4>
            <div className="space-y-3">
              {result.classified_tasks.length > 0 ? (
                result.classified_tasks.map((task, index) => (
                  <div
                    key={index}
                    className={`border-l-4 p-3 rounded ${getTaskQuadrantColor(task.quadrant)}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-800">{getQuadrantName(task.quadrant)}</span>
                      <span className="text-xs bg-white/50 px-2 py-1 rounded">
                        {Math.round(task.confidence * 100)}% pewności
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm">{task.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-white/70 text-center py-4">Brak wykrytych zadań...</p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white/20 rounded p-4">
            <h4 className="text-white font-medium mb-3">📈 Podsumowanie:</h4>
            <div className="grid grid-cols-4 gap-3 text-center">
              {Object.entries(result.summary.quadrant_distribution.counts).map(([quadrant, count]) => (
                <div key={quadrant} className={`p-2 rounded ${getTaskQuadrantColor(parseInt(quadrant))}`}>
                  <div className="text-lg font-bold text-gray-800">{count}</div>
                  <div className="text-xs text-gray-600">{getQuadrantName(parseInt(quadrant))}</div>
                  <div className="text-xs text-gray-500">
                    {result.summary.quadrant_distribution.percentages[parseInt(quadrant)]}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center text-xs text-white/60">
            Analiza wykonana: {new Date(result.timestamp).toLocaleString()}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default ImageUpload;
