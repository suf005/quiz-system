import React, { useEffect, useState } from "react";
import { User } from "../types";
import { getSocket } from "../services/socket";
import { Network, Activity, LogOut, Terminal, BookOpen, Layers } from "lucide-react";

interface HeaderProps {
  currentUser: User | null;
  activeTab: "dashboard" | "dccn";
  setActiveTab: (tab: "dashboard" | "dccn") => void;
  onLogout: () => void;
}

export default function Header({ currentUser, activeTab, setActiveTab, onLogout }: HeaderProps) {
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [activeSocketId, setActiveSocketId] = useState<string>("connecting...");

  useEffect(() => {
    // Connect client and listen to real-time telemetry changes
    const socket = getSocket();

    socket.on("connect", () => {
      setActiveSocketId(socket.id || "unknown");
    });

    socket.on("dccn:presence_update", (presence: any) => {
      if (presence && typeof presence.onlineCount === "number") {
        setOnlineCount(presence.onlineCount);
      }
    });

    socket.on("dccn:init", (initPayload: any) => {
      if (initPayload && typeof initPayload.onlineCount === "number") {
        setOnlineCount(initPayload.onlineCount);
      }
    });

    // Register user presence in Socket server if authenticated
    if (currentUser) {
      socket.emit("auth:presence", {
        username: currentUser.username,
        role: currentUser.role
      });
    }

    return () => {
      socket.off("dccn:presence_update");
      socket.off("dccn:init");
    };
  }, [currentUser]);

  return (
    <header className="bg-indigo-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
        {/* LOGO & TITLE */}
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white rounded text-indigo-700 shadow-sm flex items-center justify-center">
            <Network size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none tracking-tight mb-1">NetQuiz</h1>
            <span className="text-[10px] text-indigo-200 block mt-0.5">
              DCCN Semester Project • Client-Server Model
            </span>
          </div>
        </div>

        {/* NAVIGATION MENUS */}
        <div className="flex flex-wrap items-center gap-1 bg-indigo-800/40 p-1 rounded-lg border border-indigo-600/40">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-indigo-600 text-white shadow border border-indigo-500"
                : "text-indigo-100 hover:bg-indigo-700/50 hover:text-white"
            }`}
          >
            <Layers size={13} />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab("dccn")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "dccn"
                ? "bg-indigo-600 text-white shadow border border-indigo-500"
                : "text-indigo-100 hover:bg-indigo-700/50 hover:text-white"
            }`}
          >
            <Terminal size={13} />
            DCCN Concepts Tab
          </button>

          {currentUser && (
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-rose-200 hover:bg-rose-950/20 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut size={13} />
              Sign Out
            </button>
          )}
        </div>

        {/* PEER LIVE SENSORS (Theme Socket Widget) */}
        <div className="flex items-center gap-2 bg-indigo-800 px-3 py-1 rounded-full border border-indigo-500 shadow-inner">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs font-mono text-indigo-100">
            Socket.IO: <strong className="text-white">{onlineCount > 0 ? onlineCount : 1} Active</strong> Nodes
          </span>
        </div>
      </div>

      {/* SECURE SUB-ACCENTS HEADER METRICS */}
      {currentUser && (
        <div className="bg-indigo-900/60 py-2 px-6 border-t border-indigo-600/30">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-indigo-200 gap-1">
            <span>CLIENT-SERVER CONNECTION LIVE • SOCKET REF: {activeSocketId}</span>
            <span>
              NODE STATUS: <strong className="text-green-300">ONLINE</strong> | ROLE: <strong className="text-amber-200 uppercase">{currentUser.role}</strong> | HOST DIAGNOSTIC: 127.0.0.1
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
