import React, { useState, useEffect } from "react";
import { User } from "./types";
import { getSocket } from "./services/socket";
import Header from "./components/Header";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import QuizAttempt from "./pages/QuizAttempt";
import DCCNShowcase from "./pages/DCCNShowcase";
import { BookOpen, HelpCircle, Layers, ShieldCheck, Database, Zap } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "dccn">("dashboard");
  const [activeQuizAttemptId, setActiveQuizAttemptId] = useState<number | null>(null);

  // Restore session from localStorage if available (convenient for testing restarts)
  useEffect(() => {
    const cached = localStorage.getItem("dccn_user_session");
    if (cached) {
      try {
        const decoded = JSON.parse(cached);
        if (decoded && decoded.id && decoded.username && decoded.role) {
          setCurrentUser(decoded);
        }
      } catch {
        localStorage.removeItem("dccn_user_session");
      }
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("dccn_user_session", JSON.stringify(user));

    // Register login with socket
    const socket = getSocket();
    socket.emit("auth:presence", {
      username: user.username,
      role: user.role
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveQuizAttemptId(null);
    localStorage.removeItem("dccn_user_session");
    
    // Refresh to clear sockets and clean states
    window.location.reload();
  };

  const startQuizAttempt = (quizId: number) => {
    setActiveQuizAttemptId(quizId);
  };

  const finishQuizAttempt = () => {
    setActiveQuizAttemptId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-slate-800 selection:text-white">
      {/* GLOBAL DCCN STATUS TOPBAR */}
      <Header
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8">
        {activeTab === "dccn" ? (
          <DCCNShowcase />
        ) : (
          /* DASHBOARD TAB CONTROLS */
          <>
            {!currentUser ? (
              <Login onLoginSuccess={handleLoginSuccess} />
            ) : activeQuizAttemptId !== null ? (
              <QuizAttempt
                currentUser={currentUser}
                quizId={activeQuizAttemptId}
                onFinishQuiz={finishQuizAttempt}
              />
            ) : currentUser.role === "admin" ? (
              <AdminDashboard />
            ) : (
              <StudentDashboard 
                currentUser={currentUser} 
                onStartQuiz={startQuizAttempt} 
              />
            )}
          </>
        )}
      </main>

      {/* COMPACT FOOTER SHOWING ACADEMIC PROJECT ASSIGNMENT */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-bold text-slate-700">Network-Based Quiz System</p>
          <p className="font-mono text-slate-400">
            (Client-Server Architecture, HTTP TCP/IP over Socket.IO)
          </p>
          <div className="flex justify-center gap-6 text-[10px] uppercase font-mono tracking-widest pt-1.5 text-slate-400">
            <span className="flex items-center gap-1"><Zap size={11}/> Bi-directional WebSocket</span>
            <span className="flex items-center gap-1"><ShieldCheck size={11}/> Server Auth Timers</span>
            <span className="flex items-center gap-1"><Database size={11}/> SQLite Persistent Store</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
