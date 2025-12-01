### Dependencies

- Node.js (version 18 or higher)
- npm or yarn
- Python 3.8+ with venv
- MongoDB
An in-depth paragraph about your project and overview of use: This application implements the Eisenhower Matrix (also known as Occam's Razor) to help users prioritize tasks based on urgency and importance. The web version features smooth animations and 3D visualizations, while the Android app maintains full functionality. AI-driven networks provide smart task suggestions to optimize productivity.

## Getting Started

### Dependencies

- Node.js (version 18 or higher)
- npm or yarn
- Python 3.8+ with venv
- MongoDB
- Expo CLI for mobile development
- Docker and Docker Compose (optional, for containerized deployment)

### Installing

- Clone the repository
- Navigate to each subdirectory (web, mobile, backend-node, backend-ai)
- Install dependencies as specified in individual READMEs

### Executing program

- Backend: cd backend-node && npm run dev (starts Express API)
- AI service: cd backend-ai && python -m uvicorn main:app --reload
- Web: cd web && npm run dev (starts Vite server)
- Mobile: cd mobile && expo start
- Docker (all services): docker-compose up --build

## Help

Any advise for common problems or issues: Ensure Node.js and Python virtual environment are properly set up. For 3D issues, check WebGL support in browser.

## Authors

Contributors names and contact info: przemekp95 (developer)

## Version History

- 0.1
  - Initial Release

## License

This project is licensed under the MIT License - see the LICENSE.md file for details

## Acknowledgments

Inspiration from Eisenhower Matrix principles and modern web animation libraries.
