import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative inline-flex bg-white/10 backdrop-blur-sm rounded-full p-1"
    >
      <button
        onClick={() => setLanguage('en')}
        className={`px-4 py-2 rounded-full font-medium transition-all ${
          language === 'en'
            ? 'bg-white text-blue-600 shadow-lg'
            : 'text-white hover:bg-white/10'
        }`}
      >
        English
      </button>
      <button
        onClick={() => setLanguage('pl')}
        className={`px-4 py-2 rounded-full font-medium transition-all ${
          language === 'pl'
            ? 'bg-white text-blue-600 shadow-lg'
            : 'text-white hover:bg-white/10'
        }`}
      >
        Polski
      </button>
    </motion.div>
  );
};

export default LanguageSwitcher;
