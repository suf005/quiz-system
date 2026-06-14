import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initDatabase, dbRun, dbAll, dbGet } from "./server/db";

// Global in-memory map to store server-side timers and active quiz tracking
// Key: "studentId-quizId", Value: { startTime: number, expiryTime: number }
const activeQuizAttempts = new Map<string, { startTime: number; expiryTime: number }>();

// Simple in-memory socket active user tracking
const onlineSockets = new Map<string, { username: string; role: string; connectedAt: Date }>();

// Circular buffer for last 50 HTTP Logs to feed our DCCN analyzer
interface HTTPLog {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  ip: string;
  timestamp: string;
  contentLength: string;
  userAgent: string;
}
const httpLogs: HTTPLog[] = [];

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  
  // Attach Socket.IO to the same HTTP server
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Initialize SQLite Database tables & Seed Data
  await initDatabase();

  // Middleware to log HTTP requests (and feed our real-time DCCN monitor)
  app.use(express.json());
  
  app.use((req, res, next) => {
    // Override end to capture response status
    const start = Date.now();
    const oldEnd = res.end;
    
    res.end = function (...args: any[]) {
      const duration = Date.now() - start;
      const contentLength = res.get("Content-Length") || "0";
      const reqPath = req.originalUrl || req.url;

      // Only capture/display requests where the path starts with /api/
      if (reqPath.startsWith("/api/")) {
        let ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
        if (ip.includes(",")) {
          ip = ip.split(",")[0].trim();
        }
        // Replace real public/internal system IPs with a fake local IP 192.168.1.10
        if (
          ip === "160.191.228.116" ||
          ip === "169.254.169.126" ||
          (!ip.startsWith("127.0.0.1") && ip !== "::1" && ip !== "::ffff:127.0.0.1")
        ) {
          ip = "192.168.1.10";
        }

        const logEntry: HTTPLog = {
          id: Math.random().toString(36).substring(3, 9).toUpperCase(),
          method: req.method,
          path: reqPath,
          statusCode: res.statusCode,
          ip: ip,
          timestamp: new Date().toLocaleTimeString(),
          contentLength: `${contentLength} bytes`,
          userAgent: (req.headers["user-agent"] || "Unknown Browser").substring(0, 60)
        };

        // Add to server buffer
        httpLogs.unshift(logEntry);
        if (httpLogs.length > 50) {
          httpLogs.pop();
        }

        // Broadcast to all active clients for real-time DCCN metrics
        io.emit("dccn:http_log", logEntry);
        io.emit("dccn:request_stats", {
          totalRequests: httpLogs.length,
          lastPayloadSize: contentLength,
          lastDuration: duration
        });
      }

      return oldEnd.apply(this, args);
    };

    next();
  });

  // ==========================================
  // AUTHENTICATION ENDPOINTS
  // ==========================================
  
  // POST /api/auth/login
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    try {
      const user = await dbGet<any>(
        "SELECT id, username, password, role FROM users WHERE username = ?",
        [username]
      );

      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      if (user.password !== password) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      return res.json({
        id: user.id,
        username: user.username,
        role: user.role
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/auth/register
  app.post("/api/auth/register", async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Username, password and role are required" });
    }

    if (role !== "student" && role !== "admin") {
      return res.status(400).json({ error: "Role must be 'student' or 'admin'" });
    }

    try {
      const existingUser = await dbGet("SELECT id FROM users WHERE username = ?", [username]);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const result = await dbRun(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        [username, password, role]
      );

      return res.status(201).json({
        id: result.id,
        username,
        role
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // QUIZZES MANAGEMENT ENDPOINTS
  // ==========================================

  // GET /api/quizzes
  app.get("/api/quizzes", async (req, res) => {
    try {
      const quizzes = await dbAll<any>("SELECT id, title, time_limit FROM quizzes");
      
      // For each quiz, count questions
      const quizzesWithCounts = await Promise.all(
        quizzes.map(async (quiz) => {
          const countRow = await dbGet<{ count: number }>(
            "SELECT COUNT(*) as count FROM questions WHERE quiz_id = ?",
            [quiz.id]
          );
          return {
            ...quiz,
            question_count: countRow ? countRow.count : 0
          };
        })
      );

      return res.json(quizzesWithCounts);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/quizzes/:id
  app.get("/api/quizzes/:id", async (req, res) => {
    const quizId = parseInt(req.params.id);
    try {
      const quiz = await dbGet<any>("SELECT id, title, time_limit FROM quizzes WHERE id = ?", [quizId]);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      const questions = await dbAll<any>(
        "SELECT id, question, option_a, option_b, option_c, option_d FROM questions WHERE quiz_id = ?",
        [quizId]
      );

      // Return answers only if admin, or omit correct_answer for student previewing
      // We will also structure it cleanly
      return res.json({
        ...quiz,
        questions
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/quizzes/:id/admin-questions (Admin details including correct answer)
  app.get("/api/quizzes/:id/admin-questions", async (req, res) => {
    const quizId = parseInt(req.params.id);
    try {
      const questions = await dbAll<any>(
        "SELECT id, question, option_a, option_b, option_c, option_d, correct_answer FROM questions WHERE quiz_id = ?",
        [quizId]
      );
      return res.json(questions);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/quizzes/:id/review (Student detailed review - answers unlocked after submission)
  app.get("/api/quizzes/:id/review", async (req, res) => {
    const quizId = parseInt(req.params.id);
    const studentId = parseInt(req.query.studentId as string);
    if (!studentId) {
      return res.status(400).json({ error: "Student ID is required to fetch review." });
    }

    try {
      const finished = await dbGet<any>(
        "SELECT id FROM results WHERE student_id = ? AND quiz_id = ? LIMIT 1",
        [studentId, quizId]
      );

      if (!finished) {
        return res.status(403).json({ error: "Access Denied: You must submit the quiz before reviewing right/wrong answers." });
      }

      const questions = await dbAll<any>(
        "SELECT id, question, option_a, option_b, option_c, option_d, correct_answer FROM questions WHERE quiz_id = ?",
        [quizId]
      );

      return res.json(questions);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/quizzes/create
  app.post("/api/quizzes/create", async (req, res) => {
    const { title, time_limit, start_time, end_time } = req.body;
    if (!title || !time_limit) {
      return res.status(400).json({ error: "Title and time limit are required" });
    }

    try {
      const result = await dbRun(
        "INSERT INTO quizzes (title, time_limit, start_time, end_time) VALUES (?, ?, ?, ?)",
        [title, parseInt(time_limit), start_time || "", end_time || ""]
      );
      
      // Notify active students of a new quiz added in real time!
      io.emit("quiz:created", { id: result.id, title, time_limit, start_time, end_time });

      return res.status(201).json({
        id: result.id,
        title,
        time_limit,
        start_time,
        end_time
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/quizzes/:id/edit
  app.post("/api/quizzes/:id/edit", async (req, res) => {
    const id = parseInt(req.params.id);
    const { title, time_limit, start_time, end_time } = req.body;
    if (!title || !time_limit) {
      return res.status(400).json({ error: "Title and time limit are required" });
    }

    try {
      await dbRun(
        "UPDATE quizzes SET title = ?, time_limit = ?, start_time = ?, end_time = ? WHERE id = ?",
        [title, parseInt(time_limit), start_time || "", end_time || "", id]
      );

      // Notify clients of updated quiz
      io.emit("quiz:updated", { id, title, time_limit, start_time, end_time });

      return res.json({ id, title, time_limit, start_time, end_time });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/questions/:id/edit
  app.post("/api/questions/:id/edit", async (req, res) => {
    const questionId = parseInt(req.params.id);
    const { question, option_a, option_b, option_c, option_d, correct_answer } = req.body;

    if (!question || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
      return res.status(400).json({ error: "All question fields are required" });
    }

    try {
      await dbRun(
        "UPDATE questions SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ? WHERE id = ?",
        [question, option_a, option_b, option_c, option_d, correct_answer, questionId]
      );

      return res.json({ id: questionId, question, option_a, option_b, option_c, option_d, correct_answer });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/questions/:id
  app.delete("/api/questions/:id", async (req, res) => {
    const questionId = parseInt(req.params.id);
    try {
      await dbRun("DELETE FROM questions WHERE id = ?", [questionId]);
      return res.json({ message: "Question deleted successfully" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/quizzes/:id/questions
  app.post("/api/quizzes/:id/questions", async (req, res) => {
    const quizId = parseInt(req.params.id);
    const { question, option_a, option_b, option_c, option_d, correct_answer } = req.body;

    if (!question || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
      return res.status(400).json({ error: "All question parameters are required" });
    }

    try {
      const quiz = await dbGet("SELECT id FROM quizzes WHERE id = ?", [quizId]);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found" });
      }

      const result = await dbRun(
        `INSERT INTO questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [quizId, question, option_a, option_b, option_c, option_d, correct_answer]
      );

      return res.status(201).json({
        id: result.id,
        quiz_id: quizId,
        question,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/quizzes/:id
  app.delete("/api/quizzes/:id", async (req, res) => {
    const quizId = parseInt(req.params.id);
    try {
      await dbRun("DELETE FROM quizzes WHERE id = ?", [quizId]);
      await dbRun("DELETE FROM questions WHERE quiz_id = ?", [quizId]);
      
      // Broadcast real-time deletion
      io.emit("quiz:deleted", quizId);

      return res.json({ message: "Quiz deleted successfully" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // SERVER-SIDE SERVER TRACKED TIMERS & SUBMISSIONS
  // ==========================================

  // POST /api/quizzes/:id/start
  // Initializes start time and computes true expiry on server.
  app.post("/api/quizzes/:id/start", async (req, res) => {
    const quizId = parseInt(req.params.id);
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: "Student ID is required." });
    }

    try {
      const quiz = await dbGet<any>("SELECT time_limit FROM quizzes WHERE id = ?", [quizId]);
      if (!quiz) {
        return res.status(404).json({ error: "Quiz not found." });
      }

      const key = `${studentId}-${quizId}`;
      const rightNow = Date.now();
      const expiryTime = rightNow + (quiz.time_limit * 1000);

      activeQuizAttempts.set(key, {
        startTime: rightNow,
        expiryTime: expiryTime
      });

      console.log(`[Timer Engine] Started quiz ${quizId} for student ${studentId}. Expiry in ${quiz.time_limit}s.`);

      return res.json({
        startTime: rightNow,
        expiryTime: expiryTime,
        timeLimitSeconds: quiz.time_limit
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/quizzes/:id/submit
  // Server-side timed submission validator!
  app.post("/api/quizzes/:id/submit", async (req, res) => {
    const quizId = parseInt(req.params.id);
    const { studentId, answers } = req.body; // answers is an object tracking {questionId: "A"}

    if (!studentId || !answers) {
      return res.status(400).json({ error: "studentId and answers are required" });
    }

    try {
      // 1. TIMING VALIDATION
      const key = `${studentId}-${quizId}`;
      const timerInfo = activeQuizAttempts.get(key);
      const rightNow = Date.now();

      if (!timerInfo) {
        return res.status(400).json({
          error: "No active timer session found. Did you start the quiz properly?"
        });
      }

      // Allow 5 seconds network latency grace period
      const GRACE_PERIOD_MS = 5000;
      if (rightNow > timerInfo.expiryTime + GRACE_PERIOD_MS) {
        // Automatically reject late submission
        activeQuizAttempts.delete(key);
        return res.status(403).json({
          error: "TIMED OUT! Your submission was rejected by the server because the quiz time limit expired.",
          serverTime: rightNow,
          expiryTime: timerInfo.expiryTime,
          lateBySeconds: Math.round((rightNow - timerInfo.expiryTime) / 1000)
        });
      }

      // Clean up server-side timer as student has finished
      activeQuizAttempts.delete(key);

      // 2. RETRIEVE CORRECT ANSWERS FROM SQL DB
      const dbQuestions = await dbAll<any>(
        "SELECT id, correct_answer FROM questions WHERE quiz_id = ?",
        [quizId]
      );

      if (dbQuestions.length === 0) {
        return res.status(400).json({ error: "Quiz has no questions to grade!" });
      }

      // 3. SCORE CALCULATION
      let correctCount = 0;
      dbQuestions.forEach((q) => {
        const studentOption = answers[q.id];
        if (studentOption && studentOption.trim().toUpperCase() === q.correct_answer.toUpperCase()) {
          correctCount++;
        }
      });

      const totalQuestions = dbQuestions.length;
      const percentage = parseFloat(((correctCount / totalQuestions) * 100).toFixed(2));

      // 4. WRITE RESULT TO CENTRALIZED SQLITE DB
      const resultDoc = await dbRun(
        `INSERT INTO results (student_id, quiz_id, score, total_questions, percentage)
         VALUES (?, ?, ?, ?, ?)`,
        [studentId, quizId, correctCount, totalQuestions, percentage]
      );

      // Broadcast update to real-time users about a completed attempt!
      io.emit("quiz:submitted", {
        studentId,
        quizId,
        score: correctCount,
        totalQuestions,
        percentage
      });

      return res.json({
        resultId: resultDoc.id,
        score: correctCount,
        totalQuestions,
        percentage,
        message: "Quiz graded and submitted successfully!"
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // RESULTS ENDPOINTS
  // ==========================================

  // GET /api/results
  app.get("/api/results", async (req, res) => {
    const { studentId } = req.query;
    try {
      let query = `
        SELECT r.id, r.quiz_id, r.score, r.total_questions, r.percentage, r.completed_at,
               u.username as student_name,
               q.title as quiz_title
        FROM results r
        JOIN users u ON r.student_id = u.id
        JOIN quizzes q ON r.quiz_id = q.id
      `;
      const params: any[] = [];

      if (studentId) {
        query += " WHERE r.student_id = ?";
        params.push(studentId);
      }

      query += " ORDER BY r.completed_at DESC";
      const results = await dbAll<any>(query, params);
      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/results/clear
  app.delete("/api/results/clear", async (req, res) => {
    try {
      await dbRun("DELETE FROM results");
      // Broadcast update to real-time users
      io.emit("results:cleared");
      return res.json({ message: "All grade ledger records have been dropped successfully." });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/dccn/logs
  app.get("/api/dccn/logs", (req, res) => {
    return res.json(httpLogs);
  });

  // ==========================================
  // VITE DEVELOPMENT MIDDLEWARE / PRODUCTION SERVING
  // ==========================================

  if (process.env.NODE_ENV === "production") {
    // Serve production static assets from 'dist'
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // Development middleware using Vite
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // ==========================================
  // SOCKET.IO REAL-TIME EVENT ENGINE
  // ==========================================
  io.on("connection", (socket) => {
    console.log(`[DCCN Socket] New client TCP connection established. ID: ${socket.id}`);
    
    // Send immediate stats to the newly connected client
    socket.emit("dccn:init", {
      onlineCount: onlineSockets.size,
      activeUsers: Array.from(onlineSockets.values()),
      httpLogs: httpLogs.slice(0, 15)
    });

    // Handle student signing-in to Socket.IO for presence awareness
    socket.on("auth:presence", (data: { username: string; role: string }) => {
      if (data && data.username) {
        onlineSockets.set(socket.id, {
          username: data.username,
          role: data.role,
          connectedAt: new Date()
        });
        
        console.log(`[DCCN Socket] User presence registered: ${data.username} (${data.role})`);
        
        // Broadcast updated presence stats
        io.emit("dccn:presence_update", {
          onlineCount: onlineSockets.size,
          activeUsers: Array.from(onlineSockets.values())
        });
      }
    });

    // Handle manual disconnect or heartbeat loss over TCP keepalive
    socket.on("disconnect", () => {
      const removedUser = onlineSockets.get(socket.id);
      onlineSockets.delete(socket.id);
      console.log(`[DCCN Socket] Client disconnected: ${socket.id} (${removedUser?.username || "Unknown"})`);
      
      io.emit("dccn:presence_update", {
        onlineCount: onlineSockets.size,
        activeUsers: Array.from(onlineSockets.values())
      });
    });
  });

  // Start Server on PORT 3000
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`=========================================`);
    console.log(`[DCCN Core Server] running at http://0.0.0.0:${PORT}`);
    console.log(`[DCCN Socket.IO] engine configured and bonded`);
    console.log(`=========================================`);
  });
}

startServer().catch((err) => {
  console.error("[DCCN Bootup Error] Failed to start server:", err);
});
