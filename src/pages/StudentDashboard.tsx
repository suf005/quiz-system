import React, { useEffect, useState } from "react";
import { Quiz, QuizResult, User, Question } from "../types";
import { apiService } from "../services/api";
import { getSocket } from "../services/socket";
import { Play, Award, CheckCircle2, RefreshCw, Clock, Network, Eye, Calendar, X } from "lucide-react";

interface StudentDashboardProps {
  currentUser: User;
  onStartQuiz: (quizId: number) => void;
}

export default function StudentDashboard({ currentUser, onStartQuiz }: StudentDashboardProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Historical audit states
  const [reviewQuizId, setReviewQuizId] = useState<number | null>(null);
  const [reviewTitle, setReviewTitle] = useState<string>("");
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const loadReview = async (quizId: number, quizTitle: string) => {
    setReviewLoading(true);
    setReviewQuizId(quizId);
    setReviewTitle(quizTitle);
    try {
      const qWithAnswers = await apiService.getQuizReview(quizId, currentUser.id);
      setReviewQuestions(qWithAnswers);
    } catch (err: any) {
      alert(`Could not fetch historical review: ${err.message}`);
      setReviewQuizId(null);
    } finally {
      setReviewLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Fetch quizzes from Express endpoint
      const liveQuizzes = await apiService.getQuizzes();
      setQuizzes(liveQuizzes);

      // 2. Fetch results of this specific student
      const userResults = await apiService.getResults(currentUser.id);
      setResults(userResults);
    } catch (err: any) {
      setErrorMessage(`Error fetching data from server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time events regarding quizzes created by Admin
    const socket = getSocket();

    socket.on("quiz:created", (newQuiz: any) => {
      console.log("[Student Socket] An admin created a new quiz rooms! Auto-refresh...", newQuiz);
      loadData();
    });

    socket.on("quiz:deleted", (deletedId: any) => {
      console.log(`[Student Socket] Quiz ID ${deletedId} was deleted on server! Auto-refresh...`);
      loadData();
    });

    return () => {
      socket.off("quiz:created");
      socket.off("quiz:deleted");
    };
  }, [currentUser.id]);

  return (
    <div className="space-y-5">
      {/* WELCOME BANNER */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-600 uppercase">STUDENT GATEWAY</span>
          <h1 className="text-lg font-bold text-slate-900">
            Welcome, {currentUser.username}!
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            You are logged in as a Student node on LAN. Select a quiz below to begin a timed network exam.
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3.5 py-1.5 border border-slate-200 text-xs text-slate-600 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer font-medium"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Sync Server Database
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono rounded-lg">
          <strong>[GATEWAY_FAIL]:</strong> {errorMessage}
        </div>
      )}

      {/* DASHBOARD BODY */}
      <div className="grid grid-cols-1 gap-5">
        
        {/* UPPER GRID split on wide screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* AVAILABLE QUIZZES VIEW */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Network size={14} className="text-indigo-600" />
              Available Quizzes on Network
            </h2>

            {loading && quizzes.length === 0 ? (
              <div className="text-center py-10 font-sans text-xs text-slate-400">Loading exam templates...</div>
            ) : quizzes.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg text-xs text-slate-400 font-medium">
                No examination rooms currently set up by admin. Waiting for server deployment...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {quizzes.map((quiz) => {
                  const alreadyDone = results.some((r) => r.quiz_title === quiz.title);
                  
                  // Evaluate scheduling window
                  const now = new Date();
                  const startTime = quiz.start_time ? new Date(quiz.start_time) : null;
                  const endTime = quiz.end_time ? new Date(quiz.end_time) : null;
                  
                  let isLocked = false;
                  let scheduleInfo = "Unscheduled Window (Always Available)";
                  let scheduleColorClass = "text-slate-400";

                  if (startTime && now < startTime) {
                    isLocked = true;
                    scheduleInfo = `Locked: Starts on ${startTime.toLocaleString()}`;
                    scheduleColorClass = "text-amber-655 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200";
                  } else if (endTime && now > endTime) {
                    isLocked = true;
                    scheduleInfo = `Expired: Ended on ${endTime.toLocaleString()}`;
                    scheduleColorClass = "text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200";
                  } else if (startTime || endTime) {
                    scheduleInfo = `Active Window until ${endTime ? endTime.toLocaleString() : "Indefinite"}`;
                    scheduleColorClass = "text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200";
                  }

                  return (
                    <div
                      key={quiz.id}
                      className="p-4 border border-slate-150 bg-white hover:bg-slate-50/20 rounded-xl flex justify-between items-center hover:border-indigo-200 transition-all shadow-sm"
                    >
                      <div className="space-y-1.5">
                        <h3 className="text-xs font-bold text-slate-800">{quiz.title}</h3>
                          <span className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                            {quiz.time_limit > 0 && <>{`${quiz.time_limit}s Limit`}</>}
                            {quiz.time_limit > 0 && <span>•</span>}
                            <span>{quiz.question_count || 0} Questions</span>
                          </span>
                        <div className="flex items-center gap-1.5 text-[9px] font-mono mt-0.5">
                          <Calendar size={10} className="text-slate-400 shrink-0" />
                          <span className={scheduleColorClass}>{scheduleInfo}</span>
                        </div>
                      </div>

                      <div className="shrink-0 pl-3">
                        {alreadyDone ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold font-mono px-2 py-1 rounded-lg flex items-center gap-1">
                            <CheckCircle2 size={11} /> Completed
                          </span>
                        ) : isLocked ? (
                          <button
                            disabled
                            title="This workspace exam is currently outside its scheduled operational boundaries"
                            className="px-3.5 py-1.5 bg-slate-100 border border-slate-200 text-slate-400 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all opacity-60 cursor-not-allowed"
                          >
                            <Calendar size={10} /> Locked
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (quiz.question_count && quiz.question_count > 0) {
                                onStartQuiz(quiz.id);
                              } else {
                                alert("This quiz space was created but contains no operational questions yet. Notify your admin.");
                              }
                            }}
                            className="px-3.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer hover:shadow"
                          >
                            <Play size={10} /> Attempt
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RESULTS HISTORICAL ARCHIVES */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <Award size={14} className="text-indigo-600" />
              Your Graded Attempts (SQLite Sync)
            </h2>

            {loading && results.length === 0 ? (
              <div className="text-center py-10 font-sans text-xs text-slate-400">Syncing grade registries...</div>
            ) : results.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg text-xs text-slate-400 font-medium">
                No historical scores registered on centralized database. Attempt a quiz above!
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {results.map((res) => {
                  const matchingQuiz = quizzes.find((q) => q.title === res.quiz_title);
                  return (
                    <div key={res.id} className="p-3 bg-slate-50 border border-slate-250 hover:border-slate-300 transition-colors rounded-xl flex items-center justify-between">
                      <div className="space-y-1 bg-transparent">
                        <h4 className="text-xs font-bold text-slate-800">{res.quiz_title}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Completed: {new Date(res.completed_at).toLocaleString()}
                        </p>
                        <button
                          onClick={() => loadReview(res.quiz_id, res.quiz_title)}
                          className="text-[10px] font-mono text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={11} /> Review Questions
                        </button>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 bg-transparent">
                        <div className="text-right bg-transparent">
                          <p className="text-xs font-bold text-slate-700 font-mono">
                            {res.score} / {res.total_questions}
                          </p>
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-lg border ${
                              res.percentage >= 50 
                                ? "bg-green-50 text-green-700 border-green-200" 
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {res.percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* HISTORICAL DETAILED AUDIT FOR SELECTIVE ATTEMPT */}
        {reviewQuizId !== null && (
          <div id="historical_review_stage" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest">RETROSPECTIVE EXAM STUDY SHEET</span>
                <h3 className="text-xs font-bold text-slate-900 mt-0.5">Correct Answer Key Audit: {reviewTitle}</h3>
              </div>
              <button
                onClick={() => {
                  setReviewQuizId(null);
                  setReviewQuestions([]);
                }}
                className="p-1 px-2.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg text-xs font-semibold border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <X size={12} /> Close Study Sheet
              </button>
            </div>

            {reviewLoading ? (
              <div className="text-center py-12 bg-transparent">
                <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
                <p className="text-xs text-slate-500 font-mono">Decrypting database answer registries on LAN...</p>
              </div>
            ) : reviewQuestions.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                No question records exist inside that particular operational envelope.
              </div>
            ) : (
              <div className="space-y-4">
                {reviewQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex gap-2.5 items-start">
                      <span className="font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 py-0.5 px-2 rounded-md border border-indigo-100">
                        Q-{idx + 1}
                      </span>
                      <p className="text-xs font-bold text-slate-800 leading-snug pt-0.5 font-sans">
                        {q.question}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-8">
                      {[
                        { key: "A", val: q.option_a },
                        { key: "B", val: q.option_b },
                        { key: "C", val: q.option_c },
                        { key: "D", val: q.option_d },
                      ].map((opt) => {
                        const isCorrect = opt.key.toUpperCase() === (q.correct_answer || "").toUpperCase();
                        return (
                          <div
                            key={opt.key}
                            className={`p-2.5 border rounded-lg text-xs flex justify-between items-center ${
                              isCorrect 
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold" 
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="bg-transparent">
                              <span className="font-mono font-bold mr-1.5 text-slate-400">[{opt.key}]</span>
                              {opt.val}
                            </div>
                            {isCorrect && (
                              <span className="text-[9px] font-bold font-mono bg-emerald-600 text-white px-1.5 py-0.5 rounded uppercase font-semibold">
                                Correct Option
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
        )}

      </div>
    </div>
  );
}
