import { User, Quiz, Question, QuizResult, HTTPLog } from "../types";

const API_BASE = "/api";

// Helper for handling fetch responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // response might not be JSON, ignore and use status message
    }
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

export const apiService = {
  // Authentication
  async login(username: string, password: string): Promise<User> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    return handleResponse<User>(response);
  },

  async register(username: string, password: string, role: string): Promise<User> {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role })
    });
    return handleResponse<User>(response);
  },

  // Quizzes API
  async getQuizzes(): Promise<Quiz[]> {
    const response = await fetch(`${API_BASE}/quizzes`);
    return handleResponse<Quiz[]>(response);
  },

  async getQuiz(id: number): Promise<Quiz & { questions: Question[] }> {
    const response = await fetch(`${API_BASE}/quizzes/${id}`);
    return handleResponse<Quiz & { questions: Question[] }>(response);
  },

  async getAdminQuestions(quizId: number): Promise<Question[]> {
    const response = await fetch(`${API_BASE}/quizzes/${quizId}/admin-questions`);
    return handleResponse<Question[]>(response);
  },

  async getQuizReview(quizId: number, studentId: number): Promise<Question[]> {
    const response = await fetch(`${API_BASE}/quizzes/${quizId}/review?studentId=${studentId}`);
    return handleResponse<Question[]>(response);
  },

  async createQuiz(title: string, timeLimitSeconds: number, startTime?: string, endTime?: string): Promise<Quiz> {
    const response = await fetch(`${API_BASE}/quizzes/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, time_limit: timeLimitSeconds, start_time: startTime, end_time: endTime })
    });
    return handleResponse<Quiz>(response);
  },

  async editQuiz(id: number, title: string, timeLimitSeconds: number, startTime?: string, endTime?: string): Promise<Quiz> {
    const response = await fetch(`${API_BASE}/quizzes/${id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, time_limit: timeLimitSeconds, start_time: startTime, end_time: endTime })
    });
    return handleResponse<Quiz>(response);
  },

  async addQuestion(quizId: number, questionData: Omit<Question, "id" | "quiz_id">): Promise<Question> {
    const response = await fetch(`${API_BASE}/quizzes/${quizId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questionData)
    });
    return handleResponse<Question>(response);
  },

  async editQuestion(questionId: number, questionData: Omit<Question, "id" | "quiz_id">): Promise<Question> {
    const response = await fetch(`${API_BASE}/questions/${questionId}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questionData)
    });
    return handleResponse<Question>(response);
  },

  async deleteQuestion(questionId: number): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/questions/${questionId}`, {
      method: "DELETE"
    });
    return handleResponse<{ message: string }>(response);
  },

  async deleteQuiz(quizId: number): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/quizzes/${quizId}`, {
      method: "DELETE"
    });
    return handleResponse<{ message: string }>(response);
  },

  // Quiz Timing & Grading
  async startQuiz(quizId: number, studentId: number): Promise<{ startTime: number; expiryTime: number; timeLimitSeconds: number }> {
    const response = await fetch(`${API_BASE}/quizzes/${quizId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId })
    });
    return handleResponse<{ startTime: number; expiryTime: number; timeLimitSeconds: number }>(response);
  },

  async submitQuiz(quizId: number, studentId: number, answers: Record<number, string>): Promise<{
    resultId: number;
    score: number;
    totalQuestions: number;
    percentage: number;
    message: string;
  }> {
    const response = await fetch(`${API_BASE}/quizzes/${quizId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, answers })
    });
    return handleResponse<{
      resultId: number;
      score: number;
      totalQuestions: number;
      percentage: number;
      message: string;
    }>(response);
  },

  // Results Historical Data
  async getResults(studentId?: number): Promise<QuizResult[]> {
    let url = `${API_BASE}/results`;
    if (studentId) {
      url += `?studentId=${studentId}`;
    }
    const response = await fetch(url);
    return handleResponse<QuizResult[]>(response);
  },

  async clearAllResults(): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/results/clear`, {
      method: "DELETE"
    });
    return handleResponse<{ message: string }>(response);
  },

  // DCCN Telemetry
  async getHTTPLogs(): Promise<HTTPLog[]> {
    const response = await fetch(`${API_BASE}/dccn/logs`);
    return handleResponse<HTTPLog[]>(response);
  }
};
