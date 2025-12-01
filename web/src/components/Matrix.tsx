import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere } from '@react-three/drei';
import { MeshStandardMaterial } from 'three';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface Task {
  _id: string;
  title: string;
  description: string;
  urgent: boolean;
  important: boolean;
}

interface MatrixProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, '_id'>) => void;
  onUpdateTask: (id: string, updated: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
}

function Matrix({ tasks, onAddTask, onUpdateTask, onDeleteTask }: MatrixProps) {
  const [newTask, setNewTask] = useState({ title: '', description: '', urgent: false, important: false });

  const quadrants = [
    { key: 'do', label: 'Do Now', filter: (t: Task) => t.urgent && t.important, color: 'bg-red-500' },
    { key: 'decide', label: 'Schedule', filter: (t: Task) => t.urgent && !t.important, color: 'bg-yellow-500' },
    { key: 'delegate', label: 'Delegate', filter: (t: Task) => !t.urgent && t.important, color: 'bg-blue-500' },
    { key: 'delete', label: 'Delete', filter: (t: Task) => !t.urgent && !t.important, color: 'bg-green-500' },
  ];

  const predictQuadrant = async (title: string) => {
    try {
      const response = await fetch(`http://localhost:8000/classify?title=${encodeURIComponent(title)}`);
      if (response.ok) {
        const data = await response.json();
        setNewTask({ ...newTask, urgent: data.urgent, important: data.important });
      } else {
        throw new Error('API error');
      }
    } catch (error) {
      console.error('Failed to fetch AI prediction:', error);
      // Fallback to rule-based if AI unavailable
      const lowerTitle = title.toLowerCase();
      const urgentWords = ['urgent', 'pilny', 'pilne', 'teraz', 'today', 'dzisiaj', 'now', 'deadline', 'termin', 'gorący', 'krytyczny', 'natychmiast', 'asap'];
      const hasUrgency = urgentWords.some(word => lowerTitle.includes(word));
      const importantWords = ['important', 'ważny', 'ważne', 'projekt', 'kluczowy', 'strategiczny', 'biznes', 'firma', 'główny'];
      const hasImportance = importantWords.some(word => lowerTitle.includes(word));
      setNewTask({ ...newTask, urgent: hasUrgency, important: hasImportance });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTask(newTask);
    setNewTask({ title: '', description: '', urgent: false, important: false });
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId) return; // Same quadrant

    const taskId = result.draggableId;
    const sourceQuadrant = source.droppableId;
    const destQuadrant = destination.droppableId;

    // Map quadrants to urgent/important states
    const quadrantToState = {
      'do': { urgent: true, important: true },
      'decide': { urgent: true, important: false },
      'delegate': { urgent: false, important: true },
      'delete': { urgent: false, important: false }
    };

    const newState = quadrantToState[destQuadrant as keyof typeof quadrantToState];
    if (newState) {
      onUpdateTask(taskId, newState);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
    <div className="relative max-w-6xl mx-auto">
      {/* 3D Background */}
      {typeof window !== 'undefined' && window.ResizeObserver ? (
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 5] }}>
            <OrbitControls enableZoom={false} enablePan={false} autoRotate />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
          <Sphere args={[1, 64, 64]} position={[1, 1, 0]}>
            {/* @ts-ignore */}
            <meshStandardMaterial attach="material" color="blue" />
          </Sphere>
          </Canvas>
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-blue-400 to-purple-500"></div>
      )}

      {/* Matrix Grid */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 grid grid-cols-2 grid-rows-2 gap-4 bg-white/20 backdrop-blur-sm rounded-lg p-4"
        style={{ width: '800px', height: '600px' }}
      >
        {quadrants.map((quad, index) => (
          <motion.div
            key={quad.key}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className={`${quad.color}/20 backdrop-blur-sm rounded-lg p-4 flex flex-col`}
          >
            <h3 className="text-xl font-semibold mb-4">{quad.label}</h3>
            <Droppable droppableId={quad.key}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex-1 overflow-y-auto"
                >
                  <AnimatePresence>
                    {tasks.filter(quad.filter).map((task, taskIndex) => (
                      <Draggable key={task._id} draggableId={task._id} index={taskIndex}>
                        {(provided, snapshot) => (
                          <motion.div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className={`bg-white/50 rounded p-2 mb-2 shadow-sm cursor-move ${
                              snapshot.isDragging ? 'shadow-lg' : ''
                            }`}
                            drag={false}
                            dragConstraints={undefined}
                            onDragStart={undefined}
                            onDragEnd={undefined}
                            onDrag={undefined}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium">{task.title}</h4>
                                <p className="text-sm text-gray-600">{task.description}</p>
                              </div>
                              <button
                                onClick={() => onDeleteTask(task._id)}
                                className="ml-2 text-red-600 hover:text-red-800 opacity-50 hover:opacity-100"
                              >
                                ✕
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </Draggable>
                    ))}
                  </AnimatePresence>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </motion.div>
        ))}
      </motion.div>

      {/* Add Task Form */}
      <motion.form
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        onSubmit={handleSubmit}
        className="relative z-10 mt-8 bg-white/10 backdrop-blur-sm rounded-lg p-6 max-w-md mx-auto"
      >
        <h3 className="text-xl font-semibold text-white mb-4">Add New Task</h3>
        <input
          type="text"
          placeholder="Title"
          value={newTask.title}
          onChange={e => setNewTask({...newTask, title: e.target.value})}
          className="w-full p-2 mb-2 rounded border border-white/50 bg-white/20 text-white placeholder:text-white/70"
          required
        />
        <textarea
          placeholder="Description"
          value={newTask.description}
          onChange={e => setNewTask({...newTask, description: e.target.value})}
          className="w-full p-2 mb-2 rounded border border-white/50 bg-white/20 text-white placeholder:text-white/70"
        />
        <label className="flex items-center mb-2 text-white">
          <input
            type="checkbox"
            checked={newTask.urgent}
            onChange={e => setNewTask({...newTask, urgent: e.target.checked})}
            className="mr-2"
          />
          Urgent
        </label>
        <label className="flex items-center mb-4 text-white">
          <input
            type="checkbox"
            checked={newTask.important}
            onChange={e => setNewTask({...newTask, important: e.target.checked})}
            className="mr-2"
          />
          Important
        </label>
        <button
          type="button"
          onClick={() => predictQuadrant(newTask.title)}
          className="w-full mb-2 bg-purple-500 text-white py-2 rounded hover:bg-purple-600"
        >
          AI Suggest Quadrant
        </button>
        <button type="submit" className="w-full bg-white text-blue-600 py-2 rounded hover:bg-gray-100">
          Add Task
        </button>
      </motion.form>
    </div>
    </DragDropContext>
  );
}

export default Matrix;
