import React, { useState } from "react";
import { User } from "../types";
import { apiService } from "../services/api";
import { LogIn, UserPlus, Info, CheckCircle2 } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "admin">("student");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all credentials.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isRegister) {
        await apiService.register(username, password, role);
        setSuccess(`Registration successful! You can now log in with user: ${username}`);
        setIsRegister(false);
        setPassword("");
      } else {
        const user = await apiService.login(username, password);
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred. Check server state.");
    } finally {
      setLoading(false);
    }
  };

  const loginDemoUser = async (userType: "admin" | "student1" | "student2") => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    let u = "";
    let p = "";
    if (userType === "admin") {
      u = "admin";
      p = "admin123";
    } else if (userType === "student1") {
      u = "student1";
      p = "student123";
    } else {
      u = "student2";
      p = "student123";
    }

    try {
      const user = await apiService.login(u, p);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(`Demo account login failed. Make sure database is seeded: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login_container" className="max-w-md mx-auto my-12 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 p-5 px-6 border-t-4 border-indigo-600">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">
          Network-Based Quiz System
        </h2>
        <p className="text-xs font-mono text-slate-500 mt-0.5">
          DCCN Semester Project • Client-Server Model
        </p>
      </div>

      <div className="p-6 space-y-5">
        {error && (
          <div id="login_error" className="p-3 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-200 font-mono">
            <strong>[ERROR_PACKET]:</strong> {error}
          </div>
        )}

        {success && (
          <div id="login_success" className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200 flex items-center gap-2 font-mono">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>[SYS_OK]: {success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 tracking-wider uppercase mb-1">
              Username
            </label>
            <input
              type="text"
              id="login_username_input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans transition-all"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 tracking-wider uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              id="login_password_input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono transition-all"
              disabled={loading}
            />
          </div>
          {isRegister && (
            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-700 tracking-wider uppercase">
                Registering Node Role
              </span>
              <p className="text-xs text-slate-600 mt-1">
                You are registering as a <strong>Student / Client Node</strong>. Admin registration is prohibited.
              </p>
            </div>
          )}

          <button
            type="submit"
            id="login_btn_submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-semibold text-sm flex justify-center items-center gap-2 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 shadow-sm transition-all cursor-pointer"
          >
            {isRegister ? (
              <>
                <UserPlus size={16} />
                Register Student Account (HTTP POST)
              </>
            ) : (
              <>
                <LogIn size={16} />
                Sign In to Gateway (HTTP POST)
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-1">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setRole("student");
              setError(null);
              setSuccess(null);
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-semibold cursor-pointer"
          >
            {isRegister ? "Already registered? Login here" : "Need an account? Register student here"}
          </button>
        </div>


      </div>

        {/* DCCN EDUCATION BLOCK */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs text-slate-600">
          <h5 className="font-bold text-slate-700 flex items-center gap-1.5">
            <span className="p-1 bg-white text-indigo-600 rounded shadow-sm border border-slate-100"><Info size={11} /></span>
            HTTP Log & Session Establishment
          </h5>
          <p className="leading-relaxed text-[11px]">
            This login utilizes a classic <strong>HTTP Request-Response</strong> architecture running over a secure stateful session. The client encodes credential parameters into a JSON socket payload and sends an <strong>HTTP POST</strong> to `/api/auth/login`.
          </p>
        </div>
      </div>
  );
}
