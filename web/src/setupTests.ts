import '@testing-library/jest-dom';

// Mock ResizeObserver for react-three-fiber in jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
