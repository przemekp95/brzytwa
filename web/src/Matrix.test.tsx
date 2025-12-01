import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import Matrix from './components/Matrix';

// Wrapper for drag drop tests
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <DragDropContext onDragEnd={() => {}}>
    {children}
  </DragDropContext>
);

test('renders Matrix component with quadrants', () => {
  render(
    <Wrapper>
      <Matrix tasks={[]} onAddTask={() => {}} onUpdateTask={() => {}} onDeleteTask={() => {}} />
    </Wrapper>
  );
  const doNowElement = screen.getByText(/Do Now/i);
  expect(doNowElement).toBeInTheDocument();
});

test('displays tasks in correct quadrants', () => {
  const tasks = [
    { _id: '1', title: 'Urgent Task', description: 'desc', urgent: true, important: true },
    { _id: '2', title: 'Schedule Task', description: 'desc', urgent: true, important: false },
    { _id: '3', title: 'Delegate Task', description: 'desc', urgent: false, important: true },
    { _id: '4', title: 'Delete Task', description: 'desc', urgent: false, important: false },
  ];

  render(
    <Wrapper>
      <Matrix tasks={tasks} onAddTask={() => {}} onUpdateTask={() => {}} onDeleteTask={() => {}} />
    </Wrapper>
  );

  expect(screen.getByText('Urgent Task')).toBeInTheDocument();
  expect(screen.getByText('Schedule Task')).toBeInTheDocument();
  expect(screen.getByText('Delegate Task')).toBeInTheDocument();
  expect(screen.getByText('Delete Task')).toBeInTheDocument();
});

test('task deletion works', () => {
  const mockOnDeleteTask = jest.fn();
  const tasks = [
    { _id: '1', title: 'Test Task', description: 'desc', urgent: true, important: true },
  ];

  render(
    <Wrapper>
      <Matrix tasks={tasks} onAddTask={() => {}} onUpdateTask={() => {}} onDeleteTask={mockOnDeleteTask} />
    </Wrapper>
  );

  const deleteButton = screen.getByText('✕');
  fireEvent.click(deleteButton);
  expect(mockOnDeleteTask).toHaveBeenCalledWith('1');
});
