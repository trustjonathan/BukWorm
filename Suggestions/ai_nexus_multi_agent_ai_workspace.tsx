import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, MessageSquare, Users, Folder, BookOpen, User, 
  Search, Settings, Plus, Send, Code, Globe, Shield, Zap,
  Check, Copy, ChevronRight, Monitor, Smartphone, Terminal,
  Cpu, FileText, Image as ImageIcon, BarChart2, Layers, HelpCircle,
  MoreHorizontal, ArrowUpRight, CheckCircle2, Circle, RefreshCw
} from 'lucide-react';

// Agent Configuration with custom color palettes matching the reference images
const AGENT_CONFIGS = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    role: 'General Assistant',
    subtitle: 'General assistant · Thinks',
    color: '#10b981', // Emerald / Green
    bgColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    badgeBg: 'rgba(16, 185, 129, 0.2)',
    icon: (className = "w-5 h-5") => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    ),
    badgeText: 'General Assistant'
  },
  explainThis: {
    id: 'explainThis',
    name: 'Explain This',
    role: 'Explains Concepts',
    subtitle: 'Explains concepts · Simplifies',
    color: '#a855f7', // Purple / Violet
    bgColor: 'rgba(168, 85, 247, 0.08)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
    badgeBg: 'rgba(168, 85, 247, 0.2)',
    icon: (className = "w-5 h-5") => (
      <Zap className={className} />
    ),
    badgeText: 'Explains Concepts'
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    role: 'Searches & Explores',
    subtitle: 'Searches & explores · Finds info',
    color: '#3b82f6', // Blue / Cyan
    bgColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    badgeBg: 'rgba(59, 130, 246, 0.2)',
    icon: (className = "w-5 h-5") => (
      <Sparkles className={className} />
    ),
    badgeText: 'Searches & Explores'
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    role: 'Builds & Creates',
    subtitle: 'Builds & creates · Writes code',
    color: '#f97316', // Orange / Amber
    bgColor: 'rgba(249, 115, 22, 0.08)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
    badgeBg: 'rgba(249, 115, 22, 0.2)',
    icon: (className = "w-5 h-5") => (
      <Code className={className} />
    ),
    badgeText: 'Builds & Creates'
  }
};

// Initial Seed Messages (matching reference design screenshot)
const INITIAL_MESSAGES = [
  {
    id: 'msg-1',
    sender: 'user',
    senderName: 'You',
    timestamp: '10:12 AM',
    content: 'I want to build a school management system. It should allow students, teachers, and administrators to manage records, track performance, send messages, and handle fees. Can you help me plan and build this?'
  },
  {
    id: 'msg-2',
    sender: 'chatgpt',
    senderName: 'ChatGPT',
    badgeText: 'General Assistant',
    timestamp: '10:13 AM',
    content: `Great! I'll help you plan and build a school management system. Here's a high-level plan:

1. Features
  • Student, teacher, admin dashboards
  • Academic records & performance tracking
  • Messaging/notifications
  • Fee management

2. Tech Stack (suggested)
  • Frontend: React (or Next.js)
  • Backend: Node.js + Express
  • Database: PostgreSQL (or MySQL)
  • Authentication: JWT

I'll also provide the database structure and step-by-step implementation guide.`
  },
  {
    id: 'msg-3',
    sender: 'explainThis',
    senderName: 'Explain This',
    badgeText: 'Explains Concepts',
    timestamp: '10:15 AM',
    content: `Let me break this down in simple terms:
• A school management system helps schools handle daily operations like student records, attendance, grades, fees and communication.
• Think of it as a digital office for the school. It saves time, reduces paperwork and keeps everything organized and secure.`
  },
  {
    id: 'msg-4',
    sender: 'gemini',
    senderName: 'Gemini',
    badgeText: 'Searches & Explores',
    timestamp: '10:17 AM',
    content: `I found some useful resources and ideas:
• Similar open-source projects: OpenEduCat, Frappe School, Snipe-IT (education modules).
• Best practices: Use role-based access, data validation, regular backups.
• You can also look into Firebase if you prefer a simpler setup for smaller schools.

Would you like me to find more examples or templates?`
  },
  {
    id: 'msg-5',
    sender: 'claude',
    senderName: 'Claude',
    badgeText: 'Builds & Creates',
    timestamp: '10:20 AM',
    content: `I'll start building the core structure for you. Here's a simple project structure and sample code for the backend (Node.js + Express):`,
    codeSnippet: {
      tree: `📁 school-system/
└── 📁 src/
    ├── 📁 models/        # Database models
    ├── 📁 controllers/   # Business logic
    ├── 📁 routes/        # API routes
    ├── 📁 middleware/    # Auth, Validation
    └── 📄 app.js         # Main server file`,
      outro: `I'll also set up the database schema and authentication logic next.`
    }
  }
];

export default function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [selectedAgents, setSelectedAgents] = useState(['chatgpt', 'explainThis', 'gemini', 'claude']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // Mobile tab navigation
  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' or 'mobile'
  const [copiedId, setCopiedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Toggle active agent selection
  const toggleAgent = (agentId) => {
    if (selectedAgents.includes(agentId)) {
      if (selectedAgents.length > 1) {
        setSelectedAgents(selectedAgents.filter(id => id !== agentId));
      }
    } else {
      setSelectedAgents([...selectedAgents, agentId]);
    }
  };

  // Handle message sending & simulating multi-agent response pipeline
  const handleSendMessage = async (textToSend) => {
    const prompt = textToSend || inputText;
    if (!prompt.trim() || isGenerating) return;

    const userMsgId = `msg-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      sender: 'user',
      senderName: 'You',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: prompt
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsGenerating(true);

    // Sequence responses from selected agents
    for (let i = 0; i < selectedAgents.length; i++) {
      const agentKey = selectedAgents[i];
      const agent = AGENT_CONFIGS[agentKey];

      await new Promise(resolve => setTimeout(resolve, 1100));

      let generatedContent = '';
      let generatedCode = null;

      if (agentKey === 'chatgpt') {
        generatedContent = `Here is a structured overview for "${prompt}":\n\n1. Key Objectives & Scope\n  • Define core workflows\n  • Establish key metrics and data models\n\n2. Next Steps\n  • Outline API contract\n  • Design frontend layout and state handlers`;
      } else if (agentKey === 'explainThis') {
        generatedContent = `Let's make "${prompt}" super simple:\n• Core concept: Breaking a large goal into modular, actionable stages.\n• Why it matters: Prevents bottlenecks and ensures clean separation of duties across your application layer.`;
      } else if (agentKey === 'gemini') {
        generatedContent = `Recent trends & references regarding "${prompt}":\n• Top libraries: Tailwind CSS, Lucide Icons, Zustand for state management.\n• Best practice pattern: Modular multi-agent pipelines with server-sent events for realtime text streaming.`;
      } else if (agentKey === 'claude') {
        generatedContent = `Here is a foundational code boilerplate to help execute "${prompt}":`;
        generatedCode = {
          tree: `📁 project-root/
├── 📄 package.json
├── 📄 README.md
└── 📁 src/
    ├── 📄 index.js
    └── 📁 modules/`,
          outro: `Ready to run with node index.js`
        };
      }

      const agentMsg = {
        id: `msg-${Date.now()}-${agentKey}`,
        sender: agentKey,
        senderName: agent.name,
        badgeText: agent.badgeText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: generatedContent,
        codeSnippet: generatedCode
      };

      setMessages(prev => [...prev, agentMsg]);
    }

    setIsGenerating(false);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="w-full h-screen bg-[#070a11] text-slate-100 flex flex-col font-sans overflow-hidden antialiased selection:bg-cyan-500/30">
      
      {/* TOP GLOBAL NAVBAR */}
      <header className="h-14 border-b border-slate-800/80 bg-[#0a0f1d]/90 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#0b1120] rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                AI Nexus
              </h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Multiple AI Agents. One Workspace.</p>
          </div>
        </div>

        {/* View mode toggle (Desktop vs Mobile simulator preview) */}
        <div className="flex items-center space-x-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('desktop')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'desktop' 
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Desktop Workspace</span>
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'mobile' 
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mobile App View</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>5 agents online</span>
          </div>

          <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors">
            <Search className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[1px]">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white">
              JD
            </div>
          </div>
        </div>
      </header>

      {/* WORKSPACE CONTENT CONTAINER */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* VIEW CONTAINER - RENDER EITHER DESKTOP FRAME OR MOBILE PREVIEW WRAPPER */}
        {viewMode === 'desktop' ? (
          <div className="w-full h-full flex overflow-hidden">
            
            {/* LEFT SIDEBAR - AI AGENTS & RECENT CHATS */}
            <aside className="w-72 bg-[#090d18] border-r border-slate-800/80 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
              
              {/* New Chat Button */}
              <div className="p-4">
                <button 
                  onClick={() => setMessages([])}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Group Chat</span>
                </button>
              </div>

              {/* ACTIVE AI AGENTS LIST */}
              <div className="px-4 py-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">AI Agents</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">4 Active</span>
                </div>

                <div className="space-y-1.5">
                  {Object.values(AGENT_CONFIGS).map(agent => {
                    const isSelected = selectedAgents.includes(agent.id);
                    return (
                      <div
                        key={agent.id}
                        onClick={() => toggleAgent(agent.id)}
                        className={`group p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'bg-slate-800/40 border-slate-700/80 shadow-sm' 
                            : 'bg-transparent border-transparent hover:bg-slate-800/20'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative transition-transform group-hover:scale-105"
                            style={{ backgroundColor: agent.bgColor, color: agent.color, border: `1px solid ${agent.borderColor}` }}
                          >
                            {agent.icon("w-4 h-4")}
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#090d18]" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                              {agent.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {agent.role}
                            </div>
                          </div>
                        </div>

                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                          isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 text-transparent'
                        }`}>
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add More Agents Chips */}
                <div className="mt-4 pt-3 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400 font-medium block mb-2">+ Add More Agents</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['Perplexity', 'Grok', 'Mistral', 'Claude+'].map(name => (
                      <button 
                        key={name} 
                        className="px-2 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-between transition-colors"
                      >
                        <span className="truncate">{name}</span>
                        <Plus className="w-3 h-3 opacity-50" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RECENT CHATS HISTORY */}
              <div className="px-4 py-3 flex-1">
                <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase block mb-2.5">
                  Recent Chats
                </span>
                <div className="space-y-1">
                  {[
                    { title: 'Build a School Management...', time: '10:24 AM', active: true },
                    { title: 'Python Debugging Help', time: 'Yesterday', active: false },
                    { title: 'Study Plan for S5 Biology', time: '2 days ago', active: false },
                    { title: 'WhatsApp Digest Project', time: '3 days ago', active: false },
                    { title: 'Create a Business Plan', time: '4 days ago', active: false },
                  ].map((chat, idx) => (
                    <button
                      key={idx}
                      className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-all ${
                        chat.active 
                          ? 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-200' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <Users className={`w-3.5 h-3.5 shrink-0 ${chat.active ? 'text-indigo-400' : 'text-slate-500'}`} />
                        <span className="text-xs truncate font-medium">{chat.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-1">{chat.time}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* BOTTOM BANNER */}
              <div className="p-4 m-3 rounded-2xl bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-slate-900 border border-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center space-x-2 text-indigo-400 mb-1">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Nexus Engine</span>
                </div>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  Different minds.<br /><span className="text-indigo-400 font-semibold">Better answers.</span>
                </p>
              </div>

            </aside>

            {/* MAIN CHAT FEED AREA */}
            <main className="flex-1 flex flex-col bg-[#080c17] relative overflow-hidden">
              
              {/* CHAT HEADER */}
              <div className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between bg-[#080c17]/80 backdrop-blur-sm z-10 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      Build a School Management System
                    </h2>
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <span className="flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>{selectedAgents.length} Agents active</span>
                      </span>
                      <span>•</span>
                      <span className="truncate">ChatGPT, Explain This, Gemini, Claude</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/50 transition-colors flex items-center space-x-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Regenerate</span>
                  </button>
                  <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* MESSAGES CONTAINER */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  const agent = AGENT_CONFIGS[msg.sender];

                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex flex-col items-end space-y-1">
                        <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
                          <span className="font-semibold text-slate-300">{msg.senderName}</span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white text-sm shadow-lg shadow-indigo-600/10 leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex items-start space-x-3.5 max-w-4xl group">
                      
                      {/* Agent Avatar Icon with Color Glow */}
                      <div 
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg mt-0.5"
                        style={{ 
                          backgroundColor: agent.bgColor, 
                          color: agent.color, 
                          border: `1.5px solid ${agent.borderColor}`,
                          boxShadow: `0 0 15px ${agent.bgColor}`
                        }}
                      >
                        {agent.icon("w-5 h-5")}
                      </div>

                      {/* Message Content Container */}
                      <div className="flex-1 space-y-2">
                        
                        {/* Agent Title & Timestamp Header */}
                        <div className="flex items-center space-x-2.5">
                          <span className="text-sm font-bold text-slate-100">{msg.senderName}</span>
                          <span 
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: agent.badgeBg, color: agent.color, border: `1px solid ${agent.borderColor}` }}
                          >
                            {msg.badgeText}
                          </span>
                          <span className="text-xs text-slate-400">{msg.timestamp}</span>
                        </div>

                        {/* Card Frame with signature color border highlight */}
                        <div 
                          className="rounded-2xl p-4 text-sm leading-relaxed text-slate-200 border bg-[#0b101f]/90 shadow-md backdrop-blur-sm"
                          style={{ borderColor: agent.borderColor }}
                        >
                          <div className="whitespace-pre-wrap">{msg.content}</div>

                          {/* Render Code Box if present (Claude example) */}
                          {msg.codeSnippet && (
                            <div className="mt-3 rounded-xl bg-[#050811] border border-slate-800 p-3.5 font-mono text-xs text-slate-300 relative overflow-x-auto">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-slate-400 text-[11px]">
                                <span className="flex items-center space-x-2">
                                  <Terminal className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Project Tree & Boilerplate</span>
                                </span>
                                <button 
                                  onClick={() => copyToClipboard(msg.codeSnippet.tree, msg.id)}
                                  className="hover:text-white flex items-center space-x-1"
                                >
                                  {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                              <pre className="text-amber-200/90 leading-relaxed">{msg.codeSnippet.tree}</pre>
                              {msg.codeSnippet.outro && (
                                <p className="mt-3 pt-2 border-t border-slate-800/60 font-sans text-xs text-slate-400">
                                  {msg.codeSnippet.outro}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}

                {/* Simulated Generator Loading Indicator */}
                {isGenerating && (
                  <div className="flex items-center space-x-3 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 w-fit">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-slate-400 font-medium">Agents are processing responses...</span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* INPUT COMPOSER CONTAINER */}
              <div className="p-4 bg-[#080c17] border-t border-slate-800/80">
                <div className="max-w-4xl mx-auto space-y-3">
                  
                  {/* Text Input Box */}
                  <div className="relative rounded-2xl bg-[#0d1322] border border-slate-700/60 p-2 shadow-xl focus-within:border-indigo-500/80 transition-all">
                    <div className="flex items-center space-x-2 px-2">
                      <button className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0">
                        <Plus className="w-5 h-5" />
                      </button>

                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask anything or give a task to the agents..."
                        className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none py-2"
                      />

                      <button
                        onClick={() => handleSendMessage()}
                        disabled={!inputText.trim() || isGenerating}
                        className={`p-2.5 rounded-xl transition-all shrink-0 ${
                          inputText.trim() && !isGenerating
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Agent Toggle Selection Bar */}
                    <div className="flex items-center space-x-2 pt-2 mt-2 border-t border-slate-800/80 px-2 overflow-x-auto custom-scrollbar">
                      <span className="text-[11px] text-slate-400 shrink-0 font-medium">Active:</span>
                      {Object.values(AGENT_CONFIGS).map(agent => {
                        const isSelected = selectedAgents.includes(agent.id);
                        return (
                          <button
                            key={agent.id}
                            onClick={() => toggleAgent(agent.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 shrink-0 border ${
                              isSelected 
                                ? 'bg-slate-800 text-slate-100 border-slate-600 shadow-sm' 
                                : 'bg-slate-900/40 text-slate-400 border-slate-800/60 hover:border-slate-700'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                            <span>{agent.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

            </main>

            {/* RIGHT SIDEBAR - CAPABILITIES & QUICK ACTIONS */}
            <aside className="w-80 bg-[#090d18] border-l border-slate-800/80 p-5 hidden xl:flex flex-col space-y-6 overflow-y-auto custom-scrollbar shrink-0">
              
              {/* Active Agents Summary Widget */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Active Agents</h3>
                  <span className="flex items-center space-x-1 text-xs text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>5 online</span>
                  </span>
                </div>
                
                <div className="space-y-2">
                  {Object.values(AGENT_CONFIGS).map(agent => (
                    <div key={agent.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div 
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: agent.bgColor, color: agent.color, border: `1px solid ${agent.borderColor}` }}
                        >
                          {agent.icon("w-3.5 h-3.5")}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200">{agent.name}</div>
                          <div className="text-[10px] text-slate-400">Ready</div>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Capabilities List */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Capabilities</h3>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { icon: HelpCircle, title: "Answer questions", desc: "General knowledge & reasoning", color: "text-blue-400" },
                    { icon: Zap, title: "Explain concepts", desc: "Simple, clear explanations", color: "text-purple-400" },
                    { icon: Search, title: "Search the web", desc: "Find latest information", color: "text-cyan-400" },
                    { icon: Code, title: "Build & code", desc: "Create, debug, and develop", color: "text-orange-400" },
                    { icon: BarChart2, title: "Analyze data", desc: "Work with files and data", color: "text-emerald-400" },
                    { icon: ImageIcon, title: "Generate images", desc: "Visualize your ideas", color: "text-pink-400" },
                  ].map((cap, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-slate-800/80 ${cap.color}`}>
                        <cap.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-200">{cap.title}</div>
                        <div className="text-[10px] text-slate-400">{cap.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions Prompts */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Quick Actions</h3>
                <div className="space-y-1.5">
                  {[
                    "Plan a project",
                    "Write code",
                    "Research & summarize",
                    "Create study plan",
                    "Build a website"
                  ].map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(`Help me ${action.toLowerCase()}`)}
                      className="w-full p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-left text-xs text-slate-300 flex items-center justify-between transition-colors group"
                    >
                      <span>{action}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>

            </aside>

          </div>
        ) : (
          
          /* MOBILE VIEWPORT SIMULATOR MODE */
          <div className="w-full h-full flex items-center justify-center p-4 bg-[#050811]">
            <div className="w-[390px] h-[780px] bg-[#090d16] border-[8px] border-slate-800 rounded-[48px] shadow-2xl flex flex-col overflow-hidden relative">
              
              {/* Phone Top Notch Bar */}
              <div className="h-10 bg-[#090d16] px-6 flex items-center justify-between text-xs font-semibold text-slate-300 z-30 shrink-0">
                <span>10:24</span>
                <div className="w-20 h-4 bg-slate-900 rounded-full" />
                <div className="flex items-center space-x-1.5 text-[10px]">
                  <span>5G</span>
                  <span>85%</span>
                </div>
              </div>

              {/* Mobile Header */}
              <div className="px-4 py-2 border-b border-slate-800/80 flex items-center justify-between bg-[#090d16] z-20 shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-400 p-[1px]">
                    <div className="w-full h-full bg-slate-900 rounded-[7px] flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white">AI Nexus</h2>
                    <p className="text-[9px] text-slate-400">Multiple AI Agents. One Chat.</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Mobile Agent Status Carousel Header */}
              <div className="p-3 border-b border-slate-800/60 bg-slate-900/30 overflow-x-auto flex space-x-2 custom-scrollbar shrink-0">
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs shrink-0 font-medium">
                  <Users className="w-3.5 h-3.5" />
                  <span>All Agents (5 online)</span>
                </div>
                {Object.values(AGENT_CONFIGS).map(agent => (
                  <div key={agent.id} className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 shrink-0">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                    <span>{agent.name}</span>
                  </div>
                ))}
              </div>

              {/* Mobile Feed */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  const agent = AGENT_CONFIGS[msg.sender];

                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex flex-col items-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 p-3 text-white text-xs leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex items-start space-x-2">
                      <div 
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: agent.bgColor, color: agent.color, border: `1px solid ${agent.borderColor}` }}
                      >
                        {agent.icon("w-3.5 h-3.5")}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-slate-200">{msg.senderName}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded" style={{ backgroundColor: agent.badgeBg, color: agent.color }}>
                            {msg.badgeText}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#0d1322] border border-slate-800 text-xs text-slate-300 leading-relaxed">
                          {msg.content}
                          {msg.codeSnippet && (
                            <div className="mt-2 p-2 bg-[#050811] rounded-lg font-mono text-[10px] text-amber-200 overflow-x-auto">
                              <pre>{msg.codeSnippet.tree}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Composer */}
              <div className="p-2 border-t border-slate-800/80 bg-[#090d16] shrink-0">
                <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
                  <Plus className="w-4 h-4 text-slate-400 ml-1" />
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask anything or give a task..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <button 
                    onClick={() => handleSendMessage()}
                    className="p-1.5 rounded-lg bg-indigo-600 text-white"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Mobile Navigation Bar */}
              <div className="h-14 border-t border-slate-800/80 bg-[#070a12] flex items-center justify-around px-2 z-30 shrink-0">
                {[
                  { id: 'chat', label: 'Chat', icon: MessageSquare },
                  { id: 'agents', label: 'Agents', icon: Users },
                  { id: 'projects', label: 'Projects', icon: Folder },
                  { id: 'library', label: 'Library', icon: BookOpen },
                  { id: 'profile', label: 'Profile', icon: User },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center space-y-0.5 ${
                      activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="text-[10px] font-medium">{tab.label}</span>
                  </button>
                ))}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}