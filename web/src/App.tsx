import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Matrix from './components/Matrix';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import LanguageSwitcher from './components/LanguageSwitcher';

interface Task {
  _id: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
}

function AppContent() {
  const { t, language } = useLanguage();

  const [tasks, setTasks] = useState<Task[]>([
    {
      _id: '1',
      title: language === 'pl' ? 'Przykładowe zadanie pilne i ważne' : 'Urgent and important task example',
      description: language === 'pl' ? 'Zadanie w kwadrancie Do Now' : 'Task in Do Now quadrant',
      urgent: true,
      important: true
    },
    {
      _id: '2',
      title: language === 'pl' ? 'Pilne ale nieważne' : 'Urgent but not important',
      description: language === 'pl' ? 'Zadanie w kwadrancie Decide' : 'Task in Decide quadrant',
      urgent: true,
      important: false
    },
    {
      _id: '3',
      title: language === 'pl' ? 'Nieważne ale ważne' : 'Not urgent but important',
      description: language === 'pl' ? 'Zadanie w kwadrancie Delegate' : 'Task in Delegate quadrant',
      urgent: false,
      important: true
    },
  ]);

  // useEffect(() => {
  //   fetchTasks();
  // }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:3001/tasks');
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const addTask = async (newTask: Omit<Task, '_id'>) => {
    // Mock - create task locally
    const mockId = Date.now().toString();
    const mockTask: Task = { _id: mockId, ...newTask };
    setTasks([...tasks, mockTask]);
    console.log('Added task:', mockTask);
    // try {
    //   const response = await fetch('http://localhost:3001/tasks', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(newTask),
    //   });
    //   const data = await response.json();
    //   setTasks([...tasks, data]);
    // } catch (error) {
    //   console.error('Failed to add task:', error);
    // }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`http://localhost:3001/tasks/${id}`, {
        method: 'DELETE',
      });
      setTasks(tasks.filter(t => t._id !== id));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getPredictionText = () => {
    if (tasks.some(t => t.urgent && t.important)) {
      return language === 'pl'
        ? "Skoncentruj się na pilnych i ważnych zadaniach jako pierwsze"
        : "Focus on urgent and important tasks first";
    }
    if (tasks.some(t => !t.urgent && t.important)) {
      return language === 'pl'
        ? "Priorytetem są ważne zadania niepilne"
        : "Prioritize important non-urgent tasks";
    }
    if (tasks.some(t => t.urgent && !t.important)) {
      return language === 'pl'
        ? "Zajmij się pilnymi ale rozważ delegację jeśli możliwe"
        : "Handle urgent but delegate if possible";
    }
    return language === 'pl'
      ? "Brak prognoz - dodaj więcej zadań"
      : "No predictions available - add more tasks";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      {/* Language Switcher */}
      <div className="flex justify-end mb-4">
        <LanguageSwitcher />
      </div>

      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-4">Eisenhower Matrix</h1>
        <p className="text-lg text-white/80">
          {language === 'pl'
            ? 'Priorytetyzuj zadania z dokładnością'
            : 'Prioritize your tasks with precision'
          }
        </p>
      </motion.header>
      <Matrix tasks={tasks} onAddTask={addTask} onUpdateTask={(id, updated) => {
        setTasks(tasks.map(t => t._id === id ? {...t, ...updated} : t));
      }} onDeleteTask={deleteTask} />
      <div className="mt-4 text-center text-white">
        <h3 className="text-xl mb-2">
          {language === 'pl' ? 'Predykcja AI' : 'AI Prediction'}
        </h3>
        <p>{getPredictionText()}</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
