import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Matrix from './components/Matrix';

interface Task {
  _id: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetchTasks();
  }, []);

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
    try {
      const response = await fetch('http://localhost:3001/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const data = await response.json();
      setTasks([...tasks, data]);
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-4">Eisenhower Matrix</h1>
        <p className="text-lg text-white/80">Prioritize your tasks with precision</p>
      </motion.header>
      <Matrix tasks={tasks} onAddTask={addTask} onUpdateTask={(id, updated) => {
        setTasks(tasks.map(t => t._id === id ? {...t, ...updated} : t));
      }} />
      <div className="mt-4 text-center text-white">
        <h3 className="text-xl mb-2">AI Prediction</h3>
        <p>Predicted next action based on your tasks: {
          tasks.some(t => t.urgent && t.important) ? "Focus on urgent and important tasks first" :
          tasks.some(t => !t.urgent && t.important) ? "Prioritize important non-urgent tasks" :
          tasks.some(t => t.urgent && !t.important) ? "Handle urgent but delegate if possible" :
          "No predictions available - add more tasks"
        }</p>
      </div>
    </div>
  );
}

export default App;
