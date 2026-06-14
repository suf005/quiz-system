import React, { useState, useEffect } from "react";
import { Quiz, Question, QuizResult } from "../types";
import { apiService } from "../services/api";
import { getSocket } from "../services/socket";
import { 
  PlusCircle, Loader2, Trash2, Eye, Award, Settings, Layers, 
  HelpCircle, Calendar, RefreshCw, Edit, X, Play, ShieldAlert,
  ArrowRight, CheckCircle2, Download
} from "lucide-react";
export default function AdminDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"quiz-schedule" | "questions-builder" | "grade-ledger">("quiz-schedule");
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  // Form states - Create/Edit Quiz
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  // Separate minutes and seconds for time limit input
  const [newTimeLimitMinutes, setNewTimeLimitMinutes] = useState('');
  const [newTimeLimitSeconds, setNewTimeLimitSeconds] = useState('');
  const [quizStartTime, setQuizStartTime] = useState("");
  const [quizEndTime, setQuizEndTime] = useState("");
  // Form states - Add/Edit Question
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctAns, setCorrectAns] = useState<"A" | "B" | "C" | "D">("A");
  // Confirmation states for danger operations
  const [confirmDeleteType, setConfirmDeleteType] = useState<"quiz" | "question" | "ledger" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiSuccess, setUiSuccess] = useState<string | null>(null);
  const loadData = async () => {
    setLoading(true);
    setUiError(null);
    try {
      const liveQuizzes = await apiService.getQuizzes();
      setQuizzes(liveQuizzes);
      const allResults = await apiService.getResults();
      setResults(allResults);
      if (selectedQuiz) {
        const matchingQuiz = liveQuizzes.find(q => q.id === selectedQuiz.id);
        if (matchingQuiz) {
          // Keep quiz metadata fresh
          setSelectedQuiz(matchingQuiz);
          const questions = await apiService.getAdminQuestions(selectedQuiz.id);
          setQuizQuestions(questions);
        } else {
          setSelectedQuiz(null);
          setQuizQuestions([]);
        }
      }
    } catch (err: any) {
      setUiError(`Error syncing from database server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
    // Attach Socket.IO to auto-refresh tables upon incoming student activities (DCCN real-time sync!)
    const socket = getSocket();
    socket.on("quiz:submitted", (attemptInfo: any) => {
      console.log("[Admin Socket] Received student submission frame. Updating score sheets...", attemptInfo);
      apiService.getResults().then(setResults).catch(console.error);
    });
    socket.on("results:cleared", () => {
      setResults([]);
    });
    socket.on("quiz:created", () => { loadData(); });
    socket.on("quiz:deleted", () => { loadData(); });
    return () => {
      socket.off("quiz:submitted");
      socket.off("results:cleared");
      socket.off("quiz:created");
      socket.off("quiz:deleted");
    };
  }, [selectedQuiz?.id]);
  const handleCreateOrUpdateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setUiError("Invalid Quiz Title.");
      return;
    }
    setUiError(null);
    setUiSuccess(null);
    try {
      // Compute total seconds from minutes and seconds inputs
      const minutes = parseInt(newTimeLimitMinutes) || 0;
      const seconds = parseInt(newTimeLimitSeconds) || 0;
      const totalSeconds = minutes * 60 + seconds;
      // Allow empty time limit (both fields blank) -> do not send time limit
      const timeLimitToSend = totalSeconds > 0 ? totalSeconds : null;
      if (editingQuizId !== null) {
        await apiService.editQuiz(editingQuizId, newTitle, timeLimitToSend, quizStartTime, quizEndTime);
        setUiSuccess(`Successfully updated settings for quiz "${newTitle}"!`);
        setEditingQuizId(null);
      } else {
        const q = await apiService.createQuiz(newTitle, timeLimitToSend, quizStartTime, quizEndTime);
        setUiSuccess(`Successfully generated quiz "${q.title}" on database server!`);
      }
      setNewTitle('');
      setNewTimeLimitMinutes('');
      setNewTimeLimitSeconds('');
      setQuizStartTime('');
      setQuizEndTime('');
      await loadData();
    } catch (err: any) {
      setUiError(err.message);
    }
  };
  const handleEditQuizClick = (quiz: Quiz) => {
    setEditingQuizId(quiz.id);
    setNewTitle(quiz.title);
    // Split existing time limit into minutes and seconds for editing
    if (quiz.time_limit && quiz.time_limit > 0) {
      const minutesPart = Math.floor(quiz.time_limit / 60);
      const secondsPart = quiz.time_limit % 60;
      setNewTimeLimitMinutes(minutesPart.toString());
      setNewTimeLimitSeconds(secondsPart.toString().padStart(2, '0'));
    } else {
      setNewTimeLimitMinutes('');
      setNewTimeLimitSeconds('');
    }
    setQuizStartTime(quiz.start_time ? quiz.start_time.substring(0, 16) : '');
    setQuizEndTime(quiz.end_time ? quiz.end_time.substring(0, 16) : '');
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleCancelQuizEdit = () => {
    setEditingQuizId(null);
    setNewTitle("");
    setNewTimeLimitMinutes("");
    setNewTimeLimitSeconds("");
    setQuizStartTime("");
    setQuizEndTime("");
  };
  const handleSelectQuizForQuestions = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setUiError(null);
    setUiSuccess(null);
    try {
      const questions = await apiService.getAdminQuestions(quiz.id);
      setQuizQuestions(questions);
      setActiveTab("questions-builder");
    } catch (err: any) {
      setUiError(`Failed to load quiz questions: ${err.message}`);
    }
  };
  const handleAddOrEditQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz) return;
    if (!questionText.trim() || !optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
      setUiError("Please fill in question prompt and all 4 options.");
      return;
    }
    setUiError(null);
    setUiSuccess(null);
    try {
      const questionData = {
        question: questionText,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_answer: correctAns
      };
      if (editingQuestionId !== null) {
        await apiService.editQuestion(editingQuestionId, questionData);
        setUiSuccess("Question updated successfully inside central storage!");
        setEditingQuestionId(null);
      } else {
        await apiService.addQuestion(selectedQuiz.id, questionData);
        setUiSuccess("Added question successfully to SQLite central storage!");
      }
      
      // Reset inputs
      setQuestionText("");
      setOptA("");
      setOptB("");
      setOptC("");
      setOptD("");
      setCorrectAns("A");
      // Reload questions
      const questions = await apiService.getAdminQuestions(selectedQuiz.id);
      setQuizQuestions(questions);
      await loadData();
    } catch (err: any) {
      setUiError(err.message);
    }
  };
  const handleEditQuestionClick = (q: Question) => {
    setEditingQuestionId(q.id);
    setQuestionText(q.question);
    setOptA(q.option_a);
    setOptB(q.option_b);
    setOptC(q.option_c);
    setOptD(q.option_d);
    setCorrectAns(q.correct_answer as any);
  };
  const handleCancelQuestionEdit = () => {
    setEditingQuestionId(null);
    setQuestionText("");
    setOptA("");
    setOptB("");
    setOptC("");
    setOptD("");
    setCorrectAns("A");
  };
  const handleDeleteQuestion = (questionId: number) => {
    if (!selectedQuiz) return;
    setConfirmDeleteType("question");
    setConfirmDeleteId(questionId);
    setConfirmDeleteMessage("Are you sure you want to remove this question permanently from the quiz index?");
  };
  const handleDeleteQuiz = (id: number) => {
    const quizTitle = quizzes.find((q) => q.id === id)?.title || "this quiz";
    setConfirmDeleteType("quiz");
    setConfirmDeleteId(id);
    setConfirmDeleteMessage(`Are you absolutely sure you want to delete the quiz "${quizTitle}"? This will permanently drop all of its questions, settings, and student score history records.`);
  };
  const handleClearAllGrades = () => {
    setConfirmDeleteType("ledger");
    setConfirmDeleteId(0); // Dummy ID to satisfy safety validation checks
    setConfirmDeleteMessage("Are you absolutely sure you want to drop all records in the Student Grade Ledger? This will permanently wipe all historical score results and student grade records from the database. This action is IRREVERSIBLE.");
  };
  const handleExportCSV = async () => {
    if (results.length === 0) return;
    
    // Create CSV rows
    const headers = ["Student Account", "Exams Category", "Correct Hits", "Total Questions", "Percentage Score", "Completed Time (Client RTT)"];
    const rows = results.map(r => [
      r.student_name,
      r.quiz_title,
      r.score,
      r.total_questions,
      `${r.percentage}%`,
      new Date(r.completed_at).toLocaleString()
    ]);
    
    // Construct the CSV string
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    // Save CSV to server disk
    try {
      await apiService.exportResults(csvContent);
      setUiSuccess("Successfully exported and saved CSV file to the server root directory as 'student_grade_ledger.csv'!");
    } catch (err: any) {
      console.error("Failed to save CSV to server filesystem:", err);
    }
    
    // Create a download link and trigger it
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.style.display = "none";
    link.setAttribute("href", url);
    link.setAttribute("download", `student_grade_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };
  const handleConfirmDelete = async () => {
    if (confirmDeleteType === null || confirmDeleteId === null) return;
    const targetId = confirmDeleteId;
    const targetType = confirmDeleteType;
    // Reset confirmation states
    setConfirmDeleteType(null);
    setConfirmDeleteId(null);
    setConfirmDeleteMessage("");
    setUiError(null);
    setUiSuccess(null);
    try {
      if (targetType === "question") {
        await apiService.deleteQuestion(targetId);
        setUiSuccess("Question deleted successfully from the database.");
        if (selectedQuiz) {
          const questions = await apiService.getAdminQuestions(selectedQuiz.id);
          setQuizQuestions(questions);
        }
        await loadData();
      } else if (targetType === "quiz") {
        await apiService.deleteQuiz(targetId);
        setUiSuccess("Quiz fully dropped from SQLite database.");
        if (selectedQuiz && selectedQuiz.id === targetId) {
          setSelectedQuiz(null);
          setQuizQuestions([]);
        }
        await loadData();
      } else if (targetType === "ledger") {
        await apiService.clearAllResults();
        setUiSuccess("All student grade ledger records have been dropped successfully.");
        await loadData();
      }
    } catch (err: any) {
      setUiError(err.message || "An error occurred during database deletion");
    }
  };
  return (
    <div className="space-y-5">
      {/* HEADER BANNER */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-605 text-indigo-700 uppercase">INSTRUCTOR CONSOLE</span>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">Admin Command Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Build scheduled network exams with tight timers, append questions with real-time student layout preview, and harvest SQLite results grades.
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3.5 py-1.5 border border-slate-200 text-xs text-slate-600 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer font-semibold leading-none"
        >
          <RefreshCw size={12} className={loading && activeTab !== "questions-builder" ? "animate-spin" : ""} />
          Sync SQLite Data
        </button>
      </div>
      {uiError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono rounded-lg">
          <strong>[ADMIN_ERROR]:</strong> {uiError}
        </div>
      )}
      {uiSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono rounded-lg">
          <strong>[ADMIN_SUCCESS]:</strong> {uiSuccess}
        </div>
      )}
      {/* CORE NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 bg-white px-2 rounded-t-xl">
        <button
          onClick={() => setActiveTab("quiz-schedule")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "quiz-schedule"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Calendar size={13} />
          Scheduling & Configuration
        </button>
        <button
          onClick={() => {
            setActiveTab("questions-builder");
            if (!selectedQuiz && quizzes.length > 0) {
              setSelectedQuiz(quizzes[0]);
              apiService.getAdminQuestions(quizzes[0].id).then(setQuizQuestions).catch(console.error);
            }
          }}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "questions-builder"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-705"
          }`}
        >
          <Layers size={13} />
          Questions & Live Student Preview
        </button>
        <button
          onClick={() => setActiveTab("grade-ledger")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "grade-ledger"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Award size={13} />
          Student Grade Ledger
        </button>
      </div>
      {/* TABS CONTAINER */}
      <div>
        
        {/* TAB 1: SCHEDULE EXAMS */}
        {activeTab === "quiz-schedule" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* SCHEDULER FORM */}
            <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <Settings size={14} className="text-indigo-600" /> 
                {editingQuizId !== null ? "Edit Quiz Settings" : "Configure Quiz Schedule"}
              </h2>
              <form onSubmit={handleCreateOrUpdateQuiz} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                    Quiz Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Networks midterm"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                    Time Limit (MM:SS)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      placeholder="Minutes"
                      min="0"
                      value={newTimeLimitMinutes}
                      onChange={(e) => setNewTimeLimitMinutes(e.target.value)}
                      className="w-1/2 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                    <input
                      type="number"
                      placeholder="Seconds"
                      min="0"
                      max="59"
                      value={newTimeLimitSeconds}
                      onChange={(e) => setNewTimeLimitSeconds(e.target.value)}
                      className="w-1/2 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                    authoritative late-submission deadline (minutes : seconds)
                  </span>
                </div>
                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <span className="block text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider">
                    OPTIONAL COORDINATED SCHEDULE
                  </span>
                  <div>
                    <label className="block text-[10px] font-mono font-medium text-slate-500 mb-1">
                      Start Time (Authorized Access)
                    </label>
                    <input
                      type="datetime-local"
                      value={quizStartTime}
                      onChange={(e) => setQuizStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-medium text-slate-500 mb-1">
                      End Time (Access Locks Out)
                    </label>
                    <input
                      type="datetime-local"
                      value={quizEndTime}
                      onChange={(e) => setQuizEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-xs flex justify-center items-center gap-1.5 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition-all cursor-pointer"
                  >
                    <PlusCircle size={13} />
                    {editingQuizId !== null ? "Save Settings" : "Deploy Quiz Room"}
                  </button>
                  {editingQuizId !== null && (
                    <button
                      type="button"
                      onClick={handleCancelQuizEdit}
                      className="px-3 bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 text-xs font-semibold rounded-lg"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
            {/* QUIZZES INDEX */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2.5">
                Configured Network Quizzes ({quizzes.length})
              </h2>
              {quizzes.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-xl text-xs text-slate-400">
                  No quizzes configured. Create one using the scheduling panel!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {quizzes.map((quiz) => {
                    const hasStart = quiz.start_time;
                    const hasEnd = quiz.end_time;
                    return (
                      <div
                        key={quiz.id}
                        className={`p-4 border rounded-xl flex flex-col justify-between gap-3 transition-all ${
                          selectedQuiz?.id === quiz.id
                            ? "bg-indigo-50/20 border-indigo-300"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="text-xs font-bold text-slate-800 truncate" title={quiz.title}>
                              {quiz.title}
                            </h3>
                            <span className="text-[9px] font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 shrink-0 font-bold">
                              ID #{quiz.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-mono">
                             {quiz.time_limit > 0 && <span>Limit: {quiz.time_limit}s</span>}
                             {quiz.time_limit > 0 && <span>•</span>}
                             <span>{quiz.question_count || 0} Questions</span>
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-[9px] font-mono leading-normal text-slate-500">
                            <p className="flex justify-between">
                              <span>Start Window:</span>
                              <span className="text-slate-700 font-bold">
                                {hasStart ? new Date(quiz.start_time!).toLocaleString() : "Unscheduled/Instant"}
                              </span>
                            </p>
                            <p className="flex justify-between">
                              <span>Expires Window:</span>
                              <span className="text-slate-700 font-bold font-mono">
                                {hasEnd ? new Date(quiz.end_time!).toLocaleString() : "Indefinite"}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleSelectQuizForQuestions(quiz)}
                            className="flex-1 py-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <Layers size={11} className="text-indigo-600" />
                            Assemble
                          </button>
                          
                          <button
                            onClick={() => handleEditQuizClick(quiz)}
                            className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                            title="Edit settings schedule"
                          >
                            <Edit size={11} /> Settings
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg shrink-0 cursor-pointer"
                            title="Drop quiz"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {/* TAB 2: QUESTIONS BUILDER & STUDENT LIVE PREVIEW */}
        {activeTab === "questions-builder" && (
          <div className="space-y-4">
            
            {/* EXAM SELECTOR DROPDOWN ON TOP */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-indigo-50 border border-indigo-200 py-1 px-2.5 rounded-lg text-indigo-700">
                  Step 1
                </span>
                <label className="text-xs font-bold text-slate-750">Active Exam context:</label>
                <select
                  value={selectedQuiz?.id || ""}
                  onChange={(e) => {
                    const found = quizzes.find((q) => q.id === parseInt(e.target.value));
                    if (found) handleSelectQuizForQuestions(found);
                  }}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-505 font-semibold text-slate-800 cursor-pointer"
                >
                  <option value="">-- Choose Quiz Room --</option>
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.question_count || 0} questions)
                    </option>
                  ))}
                </select>
              </div>
              {selectedQuiz && (
                <div className="text-[10px] font-mono text-slate-400">
                  Direct live updates transmit immediately to active student sockets.
                </div>
              )}
            </div>
            {!selectedQuiz ? (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-xl max-w-md mx-auto shadow-sm space-y-3">
                <ShieldAlert className="text-slate-300 mx-auto" size={40} />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">No Exam Context Selected</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Select a quiz using the selector dropdown above or click "Assemble" on any quiz card in Tab 1 to set up questions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* FORM COLUMN - QUESTION CREATION */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1">
                        <PlusCircle size={13} className="text-indigo-600" />
                        {editingQuestionId !== null ? "Edit Question Block" : "Append New Question"}
                      </h3>
                      {editingQuestionId !== null && (
                        <button
                          onClick={handleCancelQuestionEdit}
                          className="text-[10px] font-mono font-bold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <X size={10} /> Cancel Edit
                        </button>
                      )}
                    </div>
                    <form onSubmit={handleAddOrEditQuestion} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                          Question Description
                        </label>
                        <textarea
                          required
                          rows={3}
                          placeholder="What is the maximum size of an Ethernet packet payload?"
                          value={questionText}
                          onChange={(e) => setQuestionText(e.target.value)}
                          className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans resize-none"
                        />
                      </div>
                      <div className="space-y-3 border-t border-slate-50 pt-2.5">
                        <span className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                          Multiple Choices options (4 mandatory)
                        </span>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-400 shrink-0 w-8">[A]</span>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 1500 Bytes"
                              value={optA}
                              onChange={(e) => setOptA(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 text-xs border border-slate-350 rounded-lg focus:outline-none focus:border-indigo-550"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-400 shrink-0 w-8">[B]</span>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 64 Bytes"
                              value={optB}
                              onChange={(e) => setOptB(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 text-xs border border-slate-350 rounded-lg focus:outline-none focus:border-indigo-550"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-400 shrink-0 w-8">[C]</span>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 65535 Bytes"
                              value={optC}
                              onChange={(e) => setOptC(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 text-xs border border-slate-350 rounded-lg focus:outline-none focus:border-indigo-550"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-400 shrink-0 w-8">[D]</span>
                            <input
                              type="text"
                              required
                              placeholder="e.g. 9000 Bytes"
                              value={optD}
                              onChange={(e) => setOptD(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 text-xs border border-slate-350 rounded-lg focus:outline-none focus:border-indigo-550"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-mono font-bold text-slate-700">Answer Key Solution:</label>
                          <select
                            value={correctAns}
                            onChange={(e) => setCorrectAns(e.target.value as any)}
                            className="p-1 px-2.5 border border-slate-300 rounded-lg text-xs font-bold font-mono bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="A">Class A [Option A]</option>
                            <option value="B">Class B [Option B]</option>
                            <option value="C">Class C [Option C]</option>
                            <option value="D">Class D [Option D]</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="w-full sm:w-auto px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm cursor-pointer"
                        >
                          {editingQuestionId !== null ? "Update Question Block" : "Append to Flow"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                {/* VISUAL LIVE STUDENT PREVIEW COLUMN - RIGHT COLUMN */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border border-slate-200 bg-slate-100 p-5 rounded-xl space-y-4 shadow-inner min-h-[460px]">
                    <div className="flex justify-between items-center border-b border-slate-300 pb-2">
                      <div>
                        <span className="text-[9px] font-mono font-bold text-emerald-700 uppercase tracking-widest block bg-emerald-50 px-1.5 py-0.5 border border-emerald-100 rounded-md w-max">
                          LIVE STUDENT PREVIEW
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 mt-1">Quiz: {selectedQuiz.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {quizQuestions.length} Total Questions
                      </span>
                    </div>
                    {quizQuestions.length === 0 ? (
                      <div className="text-center py-20 border-2 border-dashed border-slate-300 rounded-xl space-y-2 bg-slate-50">
                        <HelpCircle className="text-slate-400 mx-auto" size={32} />
                        <h5 className="text-xs font-bold text-slate-700">Exam Stage is currently Empty</h5>
                        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                          Questions appended through the block editor on the left will render here instantly in real-time.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {quizQuestions.map((q, idx) => (
                          <div key={q.id} className="bg-white p-4.5 rounded-xl border border-slate-250 shadow-sm relative space-y-3 hover:border-slate-300 transition-colors">
                            
                            {/* ACTION CONTROLS */}
                            <div className="absolute top-3.5 right-3.5 flex gap-1 bg-transparent">
                              <button
                                onClick={() => handleEditQuestionClick(q)}
                                className="p-1 px-1.5 text-[10px] text-indigo-700 hover:text-indigo-900 hover:bg-slate-50 rounded border border-indigo-150 transition-colors font-semibold flex items-center gap-0.5 bg-white cursor-pointer"
                                title="Edit Question"
                              >
                                <Edit size={10} /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded border border-slate-200 transition-colors bg-white cursor-pointer"
                                title="Delete Question"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                            <div className="flex gap-2 items-start bg-transparent">
                              <span className="bg-slate-100 font-mono text-[9px] font-bold text-slate-600 px-1.5 py-0.5 border border-slate-200 rounded shrink-0">
                                Question {idx + 1}
                              </span>
                              <p className="text-xs font-bold text-slate-800 leading-snug pt-0.5 pr-20">
                                {q.question}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-8">
                              {[
                                { key: "A", val: q.option_a },
                                { key: "B", val: q.option_b },
                                { key: "C", val: q.option_c },
                                { key: "D", val: q.option_d },
                              ].map((opt) => {
                                const isKey = opt.key.toUpperCase() === q.correct_answer?.toUpperCase();
                                return (
                                  <div
                                    key={opt.key}
                                    className={`p-2 border rounded-lg text-[11px] leading-relaxed flex justify-between items-center transition-colors ${
                                      isKey
                                        ? "bg-emerald-50 border-emerald-350 text-emerald-800 font-semibold"
                                        : "bg-slate-50/40 border-slate-150 text-slate-600"
                                    }`}
                                  >
                                    <div className="bg-transparent">
                                      <span className="font-mono text-[10px] font-bold mr-1.5 text-slate-400">[{opt.key}]</span>
                                      {opt.val}
                                    </div>
                                    {isKey && (
                                      <span className="text-[8px] font-bold font-mono bg-emerald-600 text-white px-1 rounded uppercase tracking-wider shrink-0">
                                        Answer Key
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* TAB 3: STUDENT GRADES */}
        {activeTab === "grade-ledger" && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-2.5 gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Award size={14} className="text-emerald-600" /> 
                Coordinated Student Grade Ledger (SQLite Master)
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={results.length === 0}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export currently recorded grades into a spreadsheet compatible format"
                >
                  <Download size={13} />
                  Export to CSV
                </button>
                <button
                  onClick={handleClearAllGrades}
                  disabled={results.length === 0}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Drop all student grades history records from SQLite database"
                >
                  <Trash2 size={13} />
                  Drop All Records
                </button>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-200 py-1 px-2 rounded-lg">
                  SQLite persistent storage
                </span>
              </div>
            </div>
            {results.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-xl text-xs text-slate-400 font-medium">
                No scores recorded on main data database yet. Student submission scores reflect instantly here via socket pipelines.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="p-3 font-semibold">Student Account</th>
                      <th className="p-3 font-semibold">Exams Category</th>
                      <th className="p-3 font-semibold text-center">Correct Hits</th>
                      <th className="p-3 font-semibold text-center">Percentage Score</th>
                      <th className="p-3 font-semibold">Completed Time (Client RTT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className="border-b border-slate-150 hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-bold text-slate-800 font-sans">{r.student_name}</td>
                        <td className="p-3 text-slate-700 font-medium">{r.quiz_title}</td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700 bg-slate-50/20">
                          {r.score} / {r.total_questions}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded-lg text-[10px] border ${
                              r.percentage >= 50 
                                ? "bg-green-50 text-green-700 border-green-200" 
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {r.percentage}%
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[11px]">{new Date(r.completed_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      {/* CUSTOM DATABASE MUTATION CONFIRMATION MODAL */}
      {confirmDeleteType !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2 text-rose-600 bg-rose-50/30">
              <ShieldAlert size={20} className="shrink-0 animate-bounce" />
              <h3 className="font-bold text-slate-900 text-sm">Dangerous Database Operation</h3>
            </div>
            
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                {confirmDeleteMessage}
              </p>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 bg-slate-50 p-2 rounded border border-slate-100">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
                <span>SYS_REQ: Permanent SQL drop query on database index.</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteType(null);
                  setConfirmDeleteId(null);
                  setConfirmDeleteMessage("");
                }}
                className="px-3.5 py-1.5 border border-slate-200 text-xs text-slate-600 rounded-lg bg-white hover:bg-slate-150 active:bg-slate-200 transition-colors font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs text-white rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition-colors font-semibold shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Trash2 size={12} /> Confirm Drop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}