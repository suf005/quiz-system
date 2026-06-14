import fs from "fs";
import path from "path";

const dbPath = path.resolve(process.cwd(), "database.json");
console.log(`[DCCN DB] Initializing pure-TypeScript persistent database at: ${dbPath}`);

interface User {
  id: number;
  username: string;
  password: string;
  role: string;
}

interface Quiz {
  id: number;
  title: string;
  time_limit: number;
  start_time?: string;
  end_time?: string;
}

interface Question {
  id: number;
  quiz_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
}

interface Result {
  id: number;
  student_id: number;
  quiz_id: number;
  score: number;
  total_questions: number;
  percentage: number;
  completed_at: string;
}

interface DBState {
  users: User[];
  quizzes: Quiz[];
  questions: Question[];
  results: Result[];
}

let dbState: DBState = {
  users: [],
  quizzes: [],
  questions: [],
  results: []
};

// Read database.json if it exists, otherwise initialize it
try {
  if (fs.existsSync(dbPath)) {
    const rawData = fs.readFileSync(dbPath, "utf-8");
    dbState = JSON.parse(rawData);
    dbState.users = dbState.users || [];
    dbState.quizzes = dbState.quizzes || [];
    dbState.questions = dbState.questions || [];
    dbState.results = dbState.results || [];
  } else {
    fs.writeFileSync(dbPath, JSON.stringify(dbState, null, 2), "utf-8");
  }
} catch (err) {
  console.error("[DCCN DB] Error reading/initializing database.json:", err);
}

function saveToDisk() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(dbState, null, 2), "utf-8");
  } catch (err) {
    console.error("[DCCN DB] Error saving database.json to disk:", err);
  }
}

// Helper wrapper to run SQL commands as Promises (Mutations: INSERT / DELETE)
export const dbRun = (sql: string, params: any[] = []): Promise<{ id: number }> => {
  return new Promise((resolve, reject) => {
    try {
      const sqlNormalized = sql.trim().replace(/\s+/g, " ");

      // CREATE TABLE (No-op)
      if (sqlNormalized.toUpperCase().startsWith("CREATE TABLE")) {
        resolve({ id: 0 });
        return;
      }

      // INSERT INTO users (username, password, role) VALUES (?, ?, ?)
      if (sqlNormalized.toLowerCase().startsWith("insert into users")) {
        const username = params[0];
        const password = params[1];
        const role = params[2];
        const newId = dbState.users.length > 0 ? Math.max(...dbState.users.map((u) => u.id)) + 1 : 1;
        
        dbState.users.push({ id: newId, username, password, role });
        saveToDisk();
        resolve({ id: newId });
        return;
      }

      // INSERT INTO quizzes (title, time_limit, start_time, end_time) VALUES (?, ?, ?, ?)
      if (sqlNormalized.toLowerCase().startsWith("insert into quizzes")) {
        const title = params[0];
        const time_limit = parseInt(params[1], 10);
        const start_time = params[2] || "";
        const end_time = params[3] || "";
        const newId = dbState.quizzes.length > 0 ? Math.max(...dbState.quizzes.map((q) => q.id)) + 1 : 1;
        
        dbState.quizzes.push({ id: newId, title, time_limit, start_time, end_time });
        saveToDisk();
        resolve({ id: newId });
        return;
      }

      // UPDATE quizzes SET title = ?, time_limit = ?, start_time = ?, end_time = ? WHERE id = ?
      if (sqlNormalized.toLowerCase().startsWith("update quizzes")) {
        const title = params[0];
        const time_limit = parseInt(params[1], 10);
        const start_time = params[2] || "";
        const end_time = params[3] || "";
        const id = parseInt(params[4], 10);

        const quizIndex = dbState.quizzes.findIndex((q) => q.id === id);
        if (quizIndex !== -1) {
          dbState.quizzes[quizIndex] = {
            ...dbState.quizzes[quizIndex],
            title,
            time_limit,
            start_time,
            end_time
          };
          saveToDisk();
          resolve({ id });
        } else {
          reject(new Error("Quiz not found to update"));
        }
        return;
      }

      // UPDATE questions SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ? WHERE id = ?
      if (sqlNormalized.toLowerCase().startsWith("update questions")) {
        const question = params[0];
        const option_a = params[1];
        const option_b = params[2];
        const option_c = params[3];
        const option_d = params[4];
        const correct_answer = params[5];
        const id = parseInt(params[6], 10);

        const qIndex = dbState.questions.findIndex((q) => q.id === id);
        if (qIndex !== -1) {
          dbState.questions[qIndex] = {
            ...dbState.questions[qIndex],
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_answer
          };
          saveToDisk();
          resolve({ id });
        } else {
          reject(new Error("Question not found to update"));
        }
        return;
      }

      // DELETE FROM questions WHERE id = ?
      if (sqlNormalized.toLowerCase().startsWith("delete from questions where id =")) {
        const id = parseInt(params[0], 10);
        dbState.questions = dbState.questions.filter((q) => q.id !== id);
        saveToDisk();
        resolve({ id: 0 });
        return;
      }

      // INSERT INTO questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer) VALUES (?, ?, ?, ?, ?, ?, ?)
      if (sqlNormalized.toLowerCase().startsWith("insert into questions")) {
        const quiz_id = parseInt(params[0], 10);
        const question = params[1];
        const option_a = params[2];
        const option_b = params[3];
        const option_c = params[4];
        const option_d = params[5];
        const correct_answer = params[6];
        const newId = dbState.questions.length > 0 ? Math.max(...dbState.questions.map((q) => q.id)) + 1 : 1;

        dbState.questions.push({
          id: newId,
          quiz_id,
          question,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer
        });
        saveToDisk();
        resolve({ id: newId });
        return;
      }

      // INSERT INTO results (student_id, quiz_id, score, total_questions, percentage) VALUES (?, ?, ?, ?, ?)
      if (sqlNormalized.toLowerCase().startsWith("insert into results")) {
        const student_id = parseInt(params[0], 10);
        const quiz_id = parseInt(params[1], 10);
        const score = parseInt(params[2], 10);
        const total_questions = parseInt(params[3], 10);
        const percentage = parseFloat(params[4]);
        const newId = dbState.results.length > 0 ? Math.max(...dbState.results.map((r) => r.id)) + 1 : 1;

        dbState.results.push({
          id: newId,
          student_id,
          quiz_id,
          score,
          total_questions,
          percentage,
          completed_at: new Date().toISOString()
        });
        saveToDisk();
        resolve({ id: newId });
        return;
      }

      // DELETE FROM quizzes WHERE id = ?
      if (sqlNormalized.toLowerCase().startsWith("delete from quizzes")) {
        const id = parseInt(params[0], 10);
        dbState.quizzes = dbState.quizzes.filter((q) => q.id !== id);
        saveToDisk();
        resolve({ id: 0 });
        return;
      }

      // DELETE FROM results
      if (sqlNormalized.toLowerCase().startsWith("delete from results")) {
        dbState.results = [];
        saveToDisk();
        resolve({ id: 0 });
        return;
      }

      // DELETE FROM questions WHERE quiz_id = ? or id = ?
      if (sqlNormalized.toLowerCase().startsWith("delete from questions")) {
        if (sqlNormalized.toLowerCase().includes("where quiz_id =") || sqlNormalized.toLowerCase().includes("quiz_id =")) {
          const quiz_id = parseInt(params[0], 10);
          dbState.questions = dbState.questions.filter((q) => q.quiz_id !== quiz_id);
        } else if (sqlNormalized.toLowerCase().includes("where id =") || sqlNormalized.toLowerCase().includes("id =")) {
          const id = parseInt(params[0], 10);
          dbState.questions = dbState.questions.filter((q) => q.id !== id);
        }
        saveToDisk();
        resolve({ id: 0 });
        return;
      }

      console.warn(`[DCCN DB] Unhandled dbRun query: ${sql}`);
      resolve({ id: 0 });
    } catch (err) {
      reject(err);
    }
  });
};

// Helper wrapper to query multiple rows (Queries: SELECT ALL)
export const dbAll = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    try {
      const sqlNormalized = sql.trim().replace(/\s+/g, " ");

      // SELECT id, title, time_limit FROM quizzes
      if (sqlNormalized.toLowerCase().startsWith("select id, title, time_limit from quizzes")) {
        resolve(dbState.quizzes as unknown as T[]);
        return;
      }

      // SELECT id, question, option_a, option_b, option_c, option_d FROM questions WHERE quiz_id = ?
      // (Handles both student filter and admin question queries)
      if (sqlNormalized.toLowerCase().includes("from questions where quiz_id")) {
        const quiz_id = parseInt(params[0], 10);
        const questionsFiltered = dbState.questions.filter((q) => q.quiz_id === quiz_id);
        resolve(questionsFiltered as unknown as T[]);
        return;
      }

      // SELECT r.id, r.score ... FROM results JOIN users JOIN quizzes ...
      if (sqlNormalized.toLowerCase().includes("from results r") || sqlNormalized.toLowerCase().includes("join users u")) {
        let joined = dbState.results.map((r) => {
          const u = dbState.users.find((user) => user.id === r.student_id);
          const q = dbState.quizzes.find((quiz) => quiz.id === r.quiz_id);
          return {
            id: r.id,
            quiz_id: r.quiz_id,
            score: r.score,
            total_questions: r.total_questions,
            percentage: r.percentage,
            completed_at: r.completed_at,
            student_id: r.student_id,
            student_name: u ? u.username : "Unknown Student",
            quiz_title: q ? q.title : "Deleted Quiz"
          };
        });

        // Optional filter: WHERE r.student_id = ?
        if (sqlNormalized.toLowerCase().includes("r.student_id = ?") || sqlNormalized.toLowerCase().includes("student_id = ?")) {
          const studentId = parseInt(params[0], 10);
          joined = joined.filter((r) => r.student_id === studentId);
        }

        // Optional match sort: ORDER BY r.completed_at DESC
        if (sqlNormalized.toLowerCase().includes("order by r.completed_at desc") || sqlNormalized.toLowerCase().includes("completed_at desc")) {
          joined.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
        }

        resolve(joined as unknown as T[]);
        return;
      }

      console.warn(`[DCCN DB] Unhandled dbAll query: ${sql}`);
      resolve([] as T[]);
    } catch (err) {
      reject(err);
    }
  });
};

// Helper wrapper to query a single row (Queries: SELECT ONE / COUNT)
export const dbGet = <T>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    try {
      const sqlNormalized = sql.trim().replace(/\s+/g, " ");

      // SELECT COUNT(*) as count FROM users
      if (sqlNormalized.toLowerCase().includes("count(*) as count from users")) {
        resolve({ count: dbState.users.length } as unknown as T);
        return;
      }

      // SELECT COUNT(*) as count FROM quizzes
      if (sqlNormalized.toLowerCase().includes("count(*) as count from quizzes")) {
        resolve({ count: dbState.quizzes.length } as unknown as T);
        return;
      }

      // SELECT COUNT(*) as count FROM questions WHERE quiz_id = ?
      if (sqlNormalized.toLowerCase().includes("count(*) as count from questions where quiz_id")) {
        const quiz_id = parseInt(params[0], 10);
        const count = dbState.questions.filter((q) => q.quiz_id === quiz_id).length;
        resolve({ count } as unknown as T);
        return;
      }

      // SELECT id, username, password, role FROM users WHERE username = ?
      if (sqlNormalized.toLowerCase().includes("from users where username")) {
        const username = params[0];
        const user = dbState.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
        resolve(user as unknown as T | undefined);
        return;
      }

      // SELECT id, title, time_limit FROM quizzes WHERE id = ?
      if (sqlNormalized.toLowerCase().includes("from quizzes where id")) {
        const id = parseInt(params[0], 10);
        const quiz = dbState.quizzes.find((q) => q.id === id);
        resolve(quiz as unknown as T | undefined);
        return;
      }

      // SELECT id FROM results WHERE student_id = ? AND quiz_id = ? LIMIT 1
      if (sqlNormalized.toLowerCase().includes("from results where student_id = ? and quiz_id = ?")) {
        const student_id = parseInt(params[0], 10);
        const quiz_id = parseInt(params[1], 10);
        const result = dbState.results.find((r) => r.student_id === student_id && r.quiz_id === quiz_id);
        resolve(result as unknown as T | undefined);
        return;
      }

      console.warn(`[DCCN DB] Unhandled dbGet query: ${sql}`);
      resolve(undefined);
    } catch (err) {
      reject(err);
    }
  });
};

// Initialize the database schema and seed data
export async function initDatabase() {
  try {
    // Seed default/starter users if empty
    if (dbState.users.length === 0) {
      console.log("[DCCN DB] Seeding default users (Admin & Students)...");
      dbState.users.push({ id: 1, username: "admin", password: "admin123", role: "admin" });
      dbState.users.push({ id: 2, username: "student1", password: "student123", role: "student" });
      dbState.users.push({ id: 3, username: "student2", password: "student123", role: "student" });
      saveToDisk();
    }

    // Seed default computer networks quizzes for DCCN context
    if (dbState.quizzes.length === 0) {
      console.log("[DCCN DB] Seeding default DCCN Quizzes...");
      
      const quiz1Id = 1;
      dbState.quizzes.push({ id: quiz1Id, title: "TCP/IP vs OSI model Quiz", time_limit: 120 });
      
      dbState.questions.push({
        id: 1,
        quiz_id: quiz1Id,
        question: "Which layer of the TCP/IP model corresponds directly to the Application, Presentation, and Session layers of the OSI model?",
        option_a: "Network Layer",
        option_b: "Transport Layer",
        option_c: "Application Layer",
        option_d: "Link Layer",
        correct_answer: "C"
      });

      dbState.questions.push({
        id: 2,
        quiz_id: quiz1Id,
        question: "What is the standard port number for secure HTTP (HTTPS) communication over TCP/IP?",
        option_a: "80",
        option_b: "443",
        option_c: "21",
        option_d: "8080",
        correct_answer: "B"
      });

      dbState.questions.push({
        id: 3,
        quiz_id: quiz1Id,
        question: "Which DCCN protocol uses a 3-Way Handshake to establish a reliable end-to-end connection?",
        option_a: "UDP",
        option_b: "ICMP",
        option_c: "IP",
        option_d: "TCP",
        correct_answer: "D"
      });

      const quiz2Id = 2;
      dbState.quizzes.push({ id: quiz2Id, title: "Network Topology & IP Routing Quiz", time_limit: 185 });

      dbState.questions.push({
        id: 4,
        quiz_id: quiz2Id,
        question: "Which IP address represents a standard loopback address used for local network diagnostics?",
        option_a: "192.168.1.1",
        option_b: "127.0.0.1",
        option_c: "10.0.0.1",
        option_d: "255.255.255.255",
        correct_answer: "B"
      });

      dbState.questions.push({
        id: 5,
        quiz_id: quiz2Id,
        question: "In a subnetwork with the subnet mask 255.255.255.0 (/24), how many usable IP addresses are available for clients?",
        option_a: "256",
        option_b: "254",
        option_c: "512",
        option_d: "128",
        correct_answer: "B"
      });

      saveToDisk();
    }

    console.log("[DCCN DB] Pure-TypeScript database initialized successfully!");
  } catch (error) {
    console.error("[DCCN DB] Error initializing tables/seed data:", error);
  }
}

// Dummy db object to avoid default import issues
const db = {};
export default db;
