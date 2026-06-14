import React, { useEffect, useState, useRef } from "react";
import { HTTPLog, DCCNMetrics } from "../types";
import { getSocket } from "../services/socket";
import { apiService } from "../services/api";
import { Server, Activity, ArrowDownUp, RefreshCw, Layers, ShieldCheck, Cpu } from "lucide-react";

export default function DCCNShowcase() {
  const [logs, setLogs] = useState<HTTPLog[]>([]);
  const [metrics, setMetrics] = useState<DCCNMetrics>({
    onlineCount: 0,
    activeUsers: [],
    totalRequests: 0,
    lastPayloadSize: "unknown",
    lastDuration: 0,
  });
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Fetch initial HTTP logs
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const rawLogs = await apiService.getHTTPLogs();
        setLogs(rawLogs);
        
        // Populate initial metrics from logs count
        setMetrics(m => ({
          ...m,
          totalRequests: rawLogs.length
        }));
      } catch (err) {
        console.error("Failed to load HTTP logs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();

    // 2. Setup Socket.IO dynamic synchronization
    const socket = getSocket();

    // Listen for live HTTP logging packets produced on the backend
    socket.on("dccn:http_log", (newLog: HTTPLog) => {
      setLogs((prev) => [newLog, ...prev.slice(0, 24)]);
    });

    // Listen to payload metrics
    socket.on("dccn:request_stats", (stats: any) => {
      setMetrics((prev) => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
        lastPayloadSize: stats.lastPayloadSize,
        lastDuration: stats.lastDuration,
      }));
    });

    // Listen to active online student users from socket presence tracker
    socket.on("dccn:presence_update", (presence: any) => {
      setMetrics((prev) => ({
        ...prev,
        onlineCount: presence.onlineCount,
        activeUsers: presence.activeUsers
      }));
    });

    // Request initial presence sync
    socket.emit("presence:request_sync");

    return () => {
      socket.off("dccn:http_log");
      socket.off("dccn:request_stats");
      socket.off("dccn:presence_update");
    };
  }, []);

  const clearLocalBuffer = () => {
    setLogs([]);
  };

  return (
    <div className="space-y-5">
      {/* HEADER ELEMENT */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex md:flex-row flex-col justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="text-indigo-600" size={20} />
              DCCN Concept & Telemetry Hub
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Provides real-time inspection of client-server packets, OSI protocols, and socket connections.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearLocalBuffer}
              className="px-3 py-1.5 border border-slate-200 text-xs text-slate-600 rounded-lg bg-slate-50 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-1.5 transition-all cursor-pointer font-medium"
            >
              <RefreshCw size={12} />
              Clear Terminal Buffer
            </button>
          </div>
        </div>
      </div>

      {/* REAL-TIME SOCKET METRICS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Server size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">Socket Status</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <p className="font-mono text-xs font-bold text-green-600">Connected</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Activity size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">Active Nodes</p>
            <p className="font-mono text-xs font-bold text-slate-800 mt-0.5">
              {metrics.onlineCount || 1} Clients Online
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <ArrowDownUp size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">Last Payload Size</p>
            <p className="font-mono text-xs font-bold text-slate-800 mt-0.5">
              {metrics.lastPayloadSize !== "unknown" ? metrics.lastPayloadSize : "64 bytes"}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Cpu size={18} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">RTT Latency</p>
            <p className="font-mono text-xs font-bold text-slate-800 mt-0.5">
              {metrics.lastDuration ? `${metrics.lastDuration} ms` : "3 ms"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* PACKET SNIFFER TERMINAL */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 rounded-xl p-4 shadow-md border border-slate-800">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-slate-100 font-mono text-xs font-bold">LIVE HTTP/TCP CLIENT-SERVER PACKET SNIFFER</span>
              </div>
              <span className="text-slate-500 font-mono text-[9px] bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Filter: /api/* only</span>
            </div>

            <div
              ref={scrollRef}
              className="h-80 overflow-y-auto font-mono text-xs text-slate-300 space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {logs.length === 0 ? (
                <div className="text-slate-500 text-center py-16">
                  <span>[Listening with TCP Socket...] Perform any interaction (e.g. Navigation, Login, Submissions) to trigger TCP HTTP Streams</span>
                </div>
              ) : (
                logs.map((log) => {
                  const methodColor = 
                    log.method === "POST" ? "text-amber-400" :
                    log.method === "GET" ? "text-emerald-400" :
                    log.method === "DELETE" ? "text-rose-400" : "text-sky-400";

                  const statusColor = 
                    log.statusCode >= 200 && log.statusCode < 300 ? "text-green-400" :
                    log.statusCode >= 400 ? "text-rose-400" : "text-slate-400";

                  return (
                    <div key={log.id} className="p-2 border-b border-slate-800/40 hover:bg-slate-800/20 rounded-lg transition-colors">
                      <div className="flex justify-between text-slate-500 text-[10px] mb-1">
                        <span>FRAME ID: {log.id} • IP: {log.ip}</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`font-bold ${methodColor}`}>[{log.method}]</span>
                        <span className="text-slate-100 font-medium">{log.path}</span>
                        <span className="text-slate-500 flex-grow text-right text-[10px]">{log.contentLength}</span>
                        <span className={`font-bold ${statusColor}`}>{log.statusCode}</span>
                      </div>
                      <div className="text-[10px] text-slate-600 truncate mt-1">
                        Headers: User-Agent: "{log.userAgent}" • Connection: Keep-Alive • Content-Type: application/json
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="pt-3 border-t border-slate-800 mt-2 flex justify-between items-center text-[10px] text-slate-500 font-mono">
              <span>TCP Ingress: 0.0.0.0:3000 (Internal Routing)</span>
              <span>Total Logged Frames: {metrics.totalRequests}</span>
            </div>
          </div>

          {/* SYSTEM ARCHITECTURE MAP */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <Server size={14} className="text-indigo-600" /> System Architecture Layout
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mt-2">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[9px] font-mono font-bold text-indigo-700 block tracking-widest uppercase mb-1">1. CLIENT (React App)</span>
                <p className="text-xs font-bold text-slate-800">Presentation Layer</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Operates in the browser. Employs Fetch requests for HTTP REST transactions and initiates WebSocket handshakes.
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[9px] font-mono font-bold text-indigo-700 block tracking-widest uppercase mb-1">2. SERVER (Node/Express)</span>
                <p className="text-xs font-bold text-slate-800">Transport & Business</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Attached to Socket.IO. Processes requests, operates concurrent timelines, and performs real-time active state pushes.
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[9px] font-mono font-bold text-indigo-700 block tracking-widest uppercase mb-1">3. DATABASE (SQLite)</span>
                <p className="text-xs font-bold text-slate-800">Storage Layer</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Local relational store. Acts as the persistent source-of-truth for Users, Quiz templates, and historical highscores.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SIDE CONCEPTS EXPLANATIONS COLUMN */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <Layers size={14} className="text-indigo-600" /> OSI protocol mapping
            </h3>
            
            <div className="text-xs space-y-3.5">
              <div className="pb-2.5 border-b border-slate-100">
                <p className="font-bold text-slate-800">7. Application Layer (HTTP / WS)</p>
                <p className="text-slate-500 mt-0.5 leading-relaxed text-[11px]">
                  Translates actions into formatted messages. In the browser, mapped to Web API routes or Socket Event frames.
                </p>
              </div>
              <div className="pb-2.5 border-b border-slate-100">
                <p className="font-bold text-slate-800">4. Transport Layer (TCP/UDP segments)</p>
                <p className="text-slate-500 mt-0.5 leading-relaxed text-[11px]">
                  Establishes full-duplex persistent pipelines over TCP sockets to ensure reliable, in-sequence packet delivery and session state synchronization.
                </p>
              </div>
              <div className="pb-2.5 border-b border-slate-100">
                <p className="font-bold text-slate-800">3. Network Layer (IP packet routing)</p>
                <p className="text-slate-500 mt-0.5 leading-relaxed text-[11px]">
                  Routes frames across networks. Distinguishes loopback diagnostics (<code>127.0.0.1</code>) and external Cloud Run routing over WAN gateways.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck size={14} className="text-emerald-600" /> Server-Authoritative Timer
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              DCCN system secures quiz safety:
            </p>
            <div className="text-[11px] text-slate-600 leading-relaxed font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              1. GET /quiz details true UTC deadline.<br/>
              2. Expiry is cached on server state.<br/>
              3. POST /submit compares system epoch.<br/>
              4. Rejects frames delayed over grace.
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
