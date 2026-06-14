# Network-Based Quiz System

---

## 🎯 Overview

## A modern, real‑time **quiz platform** built with **React**, **Vite**, **Express**, and **Socket.io**.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite 6, Tailwind CSS, Lucide‑React, Motion (animations)
- **Backend**: Express 4, Socket.io 4, TypeScript, TSX
- **Build / Dev**: Vite, ESBuild, TypeScript, ESLint (via `npm run lint`)
- **Environment**: Node.js (>=20) – cross‑platform (Windows, macOS, Linux)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v20 or later) – download from https://nodejs.org/
- **npm** (comes with Node) – version 10+ recommended

### Installation

```bash
# Clone the repository (if you haven't already)
git clone <repo‑url>
cd "d:/PY/network-based-quiz-system"

# Install dependencies
npm install
```

### Development Mode

Run the development server with hot‑reloading for both the client and the API server:

```bash
npm run dev
```

- The Vite dev server will start on **http://localhost:5173** (default).
- The Express/Socket.io server starts on **http://localhost:3000** (as defined in `server.ts`).
- Open the URL in a browser, and you should see the quiz UI ready for you to join.

### Building for Production

```bash
# Clean previous build artifacts
npm run clean

# Bundle the server code and generate a static client bundle
npm run build
```

The compiled files end up in the `dist/` directory. To start the production server:

```bash
npm run start
```

The server will now serve the static client assets and handle real‑time socket connections.

---

## 🧩 API Endpoints (Server‑Side)

| Method | Path                     | Description                                       |
| ------ | ------------------------ | ------------------------------------------------- |
| `GET`  | `/api/rooms`             | List active rooms (used internally by the client) |
| `POST` | `/api/rooms`             | Create a new room – returns a room code           |
| `GET`  | `/api/rooms/:code`       | Fetch room details (players, status)              |
| `POST` | `/api/rooms/:code/start` | Start the quiz for a given room                   |

All real‑time interactions (question delivery, answer submission, score updates) happen over **Socket.io** events.

---

## 🤝 Contributing

Contributions are welcome! Follow these steps:

1. Fork the repo and create a feature branch.
2. Write tests or update the UI, keeping the design consistent with the existing Tailwind styling.
3. Run the linter (`npm run lint`) and ensure it passes.
4. Submit a Pull Request with a clear description of the changes.

---

## 📄 License

This project is licensed under the **MIT License** – see the `LICENSE` file for details.

---

_Happy coding! 🎉_
