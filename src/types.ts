export interface User {
  id: number;
  username: string;
  role: "admin" | "student";
}

export interface Quiz {
  id: number;
  title: string;
  time_limit: number; // in seconds
  start_time?: string;
  end_time?: string;
  question_count?: number;
}

export interface Question {
  id: number;
  quiz_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer?: string; // Only returned/visible for admins, or during submission validation
}

export interface QuizResult {
  id: number;
  quiz_id: number;
  score: number;
  total_questions: number;
  percentage: number;
  completed_at: string;
  student_name: string;
  quiz_title: string;
}

export interface HTTPLog {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  ip: string;
  timestamp: string;
  contentLength: string;
  userAgent: string;
}

export interface DCCNMetrics {
  onlineCount: number;
  activeUsers: {
    username: string;
    role: string;
    connectedAt: string;
  }[];
  totalRequests: number;
  lastPayloadSize: string;
  lastDuration: number;
}
