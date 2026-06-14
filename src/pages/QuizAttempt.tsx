import React, { useEffect, useState } from "react";
import { Quiz, Question, User } from "../types";
import { apiService } from "../services/api";
import { Clock, ShieldAlert, CheckSquare, Loader2, ArrowLeft } from "lucide-react";

interface QuizAttemptProps {
  currentUser: User;
  quizId: number;
  onFinishQuiz: () => void;
}

export default function QuizAttempt({ currentUser, quizId, onFinishQuiz }: QuizAttemptProps) {
  const [quizInfo, setQuizInfo] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  
  // Timer states
  const [deadline, setDeadline] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Flow states
  const [starting, setStarting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resultsSheet, setResultsSheet] = useState<{
    score: number;
    totalQuestions: number;
    percentage: number;
    message: string;
  } | null>(null);
  
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [fetchingReview, setFetchingReview] = useState(false);
  const [showIncompleteWarn, setShowIncompleteWarn] = useState(false);

  const loadSubmissionReview = async () => {
    setFetchingReview(true);
    try {
      const questionsWithAnswers = await apiService.getQuizReview(quizId, currentUser.id);
      setReviewQuestions(questionsWithAnswers);
      setShowReview(true);
    } catch (err: any) {
      alert(`Could not fetch review data: ${err.message}`);
    } finally {
      setFetchingReview(false);
    }
  };
  
  const [attemptError, setAttemptError] = useState<string | null>(null);

  useEffect(() => {
    const initializeQuizSession = async () => {
      setStarting(true);
      setAttemptError(null);
      try {
        // 1. Fetch quiz structure
        const quizAndQuestions = await apiService.getQuiz(quizId);
        setQuizInfo(quizAndQuestions);
        setQuestions(quizAndQuestions.questions);

        // 2. Transmit START message to the server (Synchronizes the server-side authoritative timer)
        const initTimer = await apiService.startQuiz(quizId, currentUser.id);
        setDeadline(initTimer.expiryTime);

        // Calculate initial remaining seconds
        const currentMs = Date.now();
        const secondsRemaining = Math.max(0, Math.round((initTimer.expiryTime - currentMs) / 1000));
        setTimeLeft(secondsRemaining);
      } catch (err: any) {
        setAttemptError(`Failed to start examination session: ${err.message}`);
      } finally {
        setStarting(false);
      }
    };

    initializeQuizSession();
  }, [quizId, currentUser.id]);

  // Handle client-side countdown ticking
  useEffect(() => {
    if (!deadline || resultsSheet || submitting) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.round((deadline - now) / 1000));
      
      setTimeLeft(diffSeconds);

      if (diffSeconds <= 0) {
        clearInterval(timer);
        // Force automatic submission since time limit reached!
        handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline, resultsSheet, submitting]);

  const selectOption = (questionId: number, letterOption: string) => {
    if (resultsSheet || submitting) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: letterOption
    }));
  };

  const handleAutoSubmit = () => {
    console.warn("[Timer Engine] Deadline elapsed! Triggering server-side evaluation frame...");
    executeSubmission(true);
  };

  const executeSubmission = async (isAuto: boolean = false) => {
    if (submitting) return;
    
    setSubmitting(true);
    setAttemptError(null);
    try {
      const responseScores = await apiService.submitQuiz(quizId, currentUser.id, selectedAnswers);
      setResultsSheet(responseScores);
    } catch (err: any) {
      setAttemptError(err.message || "An authentication or timing restriction error occurred on submission");
    } finally {
      setSubmitting(false);
    }
  };

  const manualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const answeredCount = Object.keys(selectedAnswers).length;
    if (answeredCount < questions.length) {
      setShowIncompleteWarn(true);
      return;
    }
    executeSubmission(false);
  };

  if (starting) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-xl text-center shadow-md">
        <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={32} />
        <h3 className="font-bold text-slate-900 text-sm">Establishing Secure TCP Session...</h3>
        <p className="text-xs text-slate-500 mt-1">Downloading quiz packets, reserving server-side session clock.</p>
      </div>
    );
  }

  // RENDER GRADED RESULTS COVER PAGE UPON SUBMISSION SUCCESS
  if (resultsSheet) {
    return (
      <div className="max-w-2xl mx-auto my-8 space-y-5">
        <div id="quiz_result_card" className="max-w-md mx-auto p-6 bg-white border border-slate-200 rounded-xl shadow-lg text-center space-y-5">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex justify-center items-center mx-auto border border-emerald-200">
            <CheckSquare size={26} />
          </div>

          <div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 tracking-wider uppercase">SUBMISSION ACCEPTED</span>
            <h2 className="text-lg font-bold text-slate-900 mt-1">Quiz Finished!</h2>
            <p className="text-xs text-slate-400 font-mono">Exam room: {quizInfo?.title}</p>
          </div>

          <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-3">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Central Storage Answer Grade</p>
            <div className="my-1">
              <span className="text-3xl font-mono font-bold text-slate-800">
                {resultsSheet.score} / {resultsSheet.totalQuestions}
              </span>
            </div>
            <span
              className={`font-mono text-xs font-bold px-3 py-1 rounded-full inline-block border ${
                resultsSheet.percentage >= 50 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              SCORE: {resultsSheet.percentage}%
            </span>
            <p className="text-[11px] text-slate-500 leading-relaxed font-sans pt-1">
              Your results were safely broadcasted over Socket.IO and written to the <code>results</code> SQL table.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {!showReview ? (
              <button
                type="button"
                onClick={loadSubmissionReview}
                disabled={fetchingReview}
                className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800 text-xs font-semibold cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {fetchingReview ? (
                  <>
                    <Loader2 className="animate-spin" size={13} />
                    Syncing Answers...
                  </>
                ) : (
                  "Show Question-by-Question Review"
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="w-full py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-xs font-semibold cursor-pointer transition-all shadow-sm"
              >
                Hide Detailed Review
              </button>
            )}

            <button
              onClick={onFinishQuiz}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 text-xs font-semibold cursor-pointer transition-all shadow-sm"
            >
              Return to Student Dashboard
            </button>
          </div>
        </div>

        {showReview && reviewQuestions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-550 uppercase tracking-widest text-center mt-6">
              Detailed Answers Audit
            </h3>
            {reviewQuestions.map((q, idx) => {
              const studentAns = selectedAnswers[q.id] || "No Answer";
              const correctAns = q.correct_answer || "";
              const isCorrect = studentAns.toUpperCase() === correctAns.toUpperCase();

              return (
                <div key={q.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex gap-2.5 items-start">
                    <span className={`font-mono text-[10px] font-bold py-1 px-2 rounded-md shrink-0 ${
                      isCorrect ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
                    }`}>
                      Q-{idx + 1} ({isCorrect ? "CORRECT" : "WRONG"})
                    </span>
                    <p className="text-xs font-bold text-slate-800 leading-snug font-sans pt-0.5">
                      {q.question}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8">
                    {[
                      { key: "A", val: q.option_a },
                      { key: "B", val: q.option_b },
                      { key: "C", val: q.option_c },
                      { key: "D", val: q.option_d },
                    ].map((opt) => {
                      const isOptCorrect = opt.key === correctAns;
                      const isOptSelected = opt.key === studentAns;

                      let styleClass = "bg-white border-slate-200 text-slate-700";
                      if (isOptCorrect) {
                        styleClass = "bg-emerald-500/10 border-emerald-500 text-emerald-800 font-semibold";
                      } else if (isOptSelected && !isCorrect) {
                        styleClass = "bg-rose-500/10 border-rose-500 text-rose-800";
                      }

                      return (
                        <div
                          key={opt.key}
                          className={`p-3 border rounded-lg text-xs leading-relaxed flex items-center justify-between ${styleClass}`}
                        >
                          <div>
                            <span className="font-mono font-bold mr-2 font-semibold">[{opt.key}]</span>
                            {opt.val}
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            {isOptCorrect && (
                              <span className="text-[9px] font-bold font-mono bg-emerald-550 text-white px-1.5 py-0.5 rounded uppercase">
                                Right Answer
                              </span>
                            )}
                            {isOptSelected && (
                              <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase ${
                                isCorrect ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"
                              }`}>
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      
      {/* TIMEOUT ERROR ALERT STATE */}
      {attemptError && (
        <div id="quiz_error_frame" className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl space-y-2">
          <h3 className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider text-rose-700 font-mono">
            <ShieldAlert size={15} /> Submission Conflict / Late Rejected
          </h3>
          <p className="text-xs leading-relaxed">
            {attemptError}
          </p>
          <div className="pt-2 flex gap-2">
            <button
              onClick={onFinishQuiz}
              className="px-4 py-1.5 bg-rose-100 border border-rose-200 text-rose-800 font-bold hover:bg-rose-200 text-xs rounded-lg transition-all cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* QUIZ MAIN CARD */}
      {quizInfo && !attemptError && (
        <form onSubmit={manualSubmit} className="space-y-5">
          {/* HEADER AND SECONDS TICKER */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center sticky top-0 bg-opacity-95 backdrop-blur z-20">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{quizInfo.title}</h2>
              <p className="text-[10px] text-slate-500 font-mono">Student: {currentUser.username} • Node #{currentUser.id}</p>
            </div>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all ${
              timeLeft <= 15 ? "bg-rose-50 text-rose-600 border-rose-200 animate-pulse" : "bg-slate-50 text-slate-800 border-slate-200"
            }`}>
              <Clock size={13} />
              <span>TIME LEFT: {timeLeft}s</span>
            </div>
          </div>

          {/* QUESTIONS LIST */}
          <div className="space-y-4">
            {questions.map((q, index) => {
              const currentSel = selectedAnswers[q.id] || "";
              return (
                <div key={q.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex gap-2.5 items-start">
                    <span className="bg-slate-100 text-slate-700 font-mono text-[10px] font-bold py-1 px-2 rounded-md shrink-0">
                      Q-{index + 1}
                    </span>
                    <p className="text-xs font-bold text-slate-800 leading-snug font-sans pt-0.5">
                      {q.question}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8">
                    {[
                      { key: "A", val: q.option_a },
                      { key: "B", val: q.option_b },
                      { key: "C", val: q.option_c },
                      { key: "D", val: q.option_d },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => selectOption(q.id, opt.key)}
                        className={`p-3 text-left border rounded-lg text-xs leading-relaxed transition-all cursor-pointer ${
                          currentSel === opt.key
                            ? "bg-indigo-600 border-indigo-600 text-white font-semibold shadow"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-mono font-bold mr-2">[{opt.key}]</span>
                        {opt.val}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* SUBMISSION BLOCK */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center sm:flex-row flex-col gap-3">
            <span className="text-[10px] text-slate-400 font-mono">
              Server validation prevents payload tamper
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={13} />
                  Evaluating Answers...
                </>
              ) : (
                <>
                  <CheckSquare size={13} />
                  Submit Examination (POST)
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* CUSTOM INCOMPLETE SUBMISSION WARNING MODAL */}
      {showIncompleteWarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 text-amber-600 bg-amber-50/50">
              <ShieldAlert size={20} className="shrink-0 animate-pulse" />
              <h3 className="font-bold text-slate-900 text-sm">Incomplete Examination</h3>
            </div>
            
            <div className="p-4.5 space-y-3 bg-white">
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                You have only answered <strong className="font-mono text-indigo-600">{Object.keys(selectedAnswers).length}</strong> out of <strong className="font-mono text-slate-700">{questions.length}</strong> questions in this exam.
              </p>
              <p className="text-[11px] text-slate-500 font-sans">
                Are you absolutely sure you wish to submit? Unanswered questions will receive a grade mark of 0.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowIncompleteWarn(false)}
                className="px-3 py-1.5 border border-slate-200 text-[11px] text-slate-600 rounded-lg bg-white hover:bg-slate-100 transition-colors font-semibold cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowIncompleteWarn(false);
                  executeSubmission(false);
                }}
                className="px-3.5 py-1.5 text-[11px] text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors font-semibold shadow-xs cursor-pointer flex items-center gap-1"
              >
                <CheckSquare size={11} /> Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
