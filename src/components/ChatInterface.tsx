'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Paperclip, Image as ImageIcon, Loader2, Bot, User, Check, Trash2, Calendar, Clock, Plus, AlertCircle, FileText, Mic, MicOff, UploadCloud } from 'lucide-react';
import { ExtractedCandidateTask } from '@/lib/aiExtractor';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf' | 'audio';
  candidateTasks?: ExtractedCandidateTask[];
  confirmedCount?: number;
  timestamp: string;
}

interface ChatInterfaceProps {
  onTasksUpdated?: () => void;
}

export default function ChatInterface({ onTasksUpdated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `Hello! I'm your AI task & responsibility assistant. Tell me about anything you need to do, paste a message, attach a screenshot/PDF/voice note, or ask *"What should I do now?"*!`,
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Handle WhatsApp / System Web Share Target URL Params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sharedText = params.get('text') || params.get('title') || params.get('url');
      if (sharedText) {
        setInputText(sharedText);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Voice Recording Handlers (Live Web Speech + Groq Whisper Rich Transcription)
  const recognitionRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      // 1. Try Browser Native Web Speech Recognition for live typing effect
      if (typeof window !== 'undefined') {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
              let currentTranscript = '';
              for (let i = event.resultIndex; i < event.results.length; i++) {
                currentTranscript += event.results[i][0].transcript;
              }
              if (currentTranscript.trim()) {
                setInputText((prev) => {
                  const prefix = prev && !prev.endsWith(' ') ? prev + ' ' : prev;
                  return prefix + currentTranscript;
                });
              }
            };

            recognition.start();
            recognitionRef.current = recognition;
          } catch (e) {
            console.log('Web Speech API init note:', e);
          }
        }
      }

      // 2. Also record MediaRecorder audio chunk for Groq Whisper v3 precision transcription
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        // Send to Groq Whisper for rich, accurate transcription
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'recording.webm');
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.text) {
              setInputText((prev) => {
                // If text was already added by Web Speech, don't duplicate if identical
                if (prev.includes(data.text.trim())) return prev;
                return prev ? `${prev}\n${data.text}` : data.text;
              });
            }
          }
        } catch (err) {
          console.error('Whisper transcription fetch error:', err);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Could not access microphone. Please check browser permissions.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !file) || isSending) return;

    const currentText = inputText;
    const currentFile = file;
    setInputText('');
    setFile(null);

    // 1. Append User Message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: currentText || (currentFile?.type.includes('audio') ? '🎙️ Voice Note' : ''),
      attachmentName: currentFile?.name,
      attachmentType: currentFile?.type.includes('pdf')
        ? 'pdf'
        : currentFile?.type.includes('audio')
        ? 'audio'
        : currentFile
        ? 'image'
        : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    const historyPayload = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

    try {
      let res;
      if (currentFile) {
        const formData = new FormData();
        formData.append('message', currentText);
        formData.append('file', currentFile);
        formData.append('history', JSON.stringify(historyPayload));
        res = await fetch('/api/chat', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: currentText, history: historyPayload }),
        });
      }

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.content,
          attachmentName: data.attachmentName,
          attachmentType: data.attachmentType,
          candidateTasks: data.candidateTasks,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (data.taskActionTaken && onTasksUpdated) {
          onTasksUpdated();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmCandidateTask = async (msgId: string, candidateIndex: number, updatedTask: ExtractedCandidateTask) => {
    try {
      const res = await fetch('/api/tasks/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedTasks: [updatedTask] }),
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === msgId && msg.candidateTasks) {
              const nextCandidates = msg.candidateTasks.filter((_, i) => i !== candidateIndex);
              return {
                ...msg,
                candidateTasks: nextCandidates,
                confirmedCount: (msg.confirmedCount || 0) + 1,
              };
            }
            return msg;
          })
        );
        if (onTasksUpdated) onTasksUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col h-[calc(100vh-6.5rem)] bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md"
    >
      {/* Drag & Drop Overlay Indicator */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-950/90 border-2 border-dashed border-indigo-400 rounded-2xl flex flex-col items-center justify-center text-indigo-200 animate-in fade-in duration-200">
          <UploadCloud className="w-12 h-12 text-indigo-400 mb-2 animate-bounce" />
          <p className="text-base font-bold">Drop files here to extract tasks!</p>
          <p className="text-xs text-indigo-300 mt-1">Supports Screenshots, Images, PDFs, and Voice Notes</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-zinc-950/80 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              AI Task Assistant
            </h2>
            <p className="text-[11px] text-zinc-400">Voice, OCR, PDF & Intelligent Task Chat</p>
          </div>
        </div>
      </div>

      {/* Chat Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${
                msg.role === 'user'
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  : 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className="max-w-[85%] sm:max-w-[75%] space-y-2">
              {/* Message Bubble */}
              <div
                className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
                    : 'bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-tl-none shadow-md'
                }`}
              >
                {msg.attachmentName && (
                  <div className="mb-2 flex items-center gap-2 px-2.5 py-1 bg-black/20 rounded-lg text-xs font-mono">
                    {msg.attachmentType === 'pdf' ? (
                      <FileText className="w-3.5 h-3.5 text-red-300" />
                    ) : msg.attachmentType === 'audio' ? (
                      <Mic className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-300" />
                    )}
                    <span className="truncate">{msg.attachmentName}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.confirmedCount !== undefined && msg.confirmedCount > 0 && (
                  <div className="mt-2 text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Added {msg.confirmedCount} task(s) to your list!
                  </div>
                )}

                <div suppressHydrationWarning className="text-[10px] opacity-60 text-right font-mono mt-1">{msg.timestamp}</div>
              </div>

              {/* Candidate Tasks Review Block */}
              {msg.candidateTasks && msg.candidateTasks.length > 0 && (
                <div className="space-y-3 pt-1">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                    Review Extracted Candidate Tasks:
                  </span>

                  {msg.candidateTasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-zinc-950/90 border border-indigo-500/30 rounded-xl space-y-2 shadow-lg"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={task.title}
                          onChange={(e) => {
                            const updated = { ...task, title: e.target.value };
                            setMessages((prev) =>
                              prev.map((m) => {
                                if (m.id === msg.id && m.candidateTasks) {
                                  const nextC = [...m.candidateTasks];
                                  nextC[idx] = updated;
                                  return { ...m, candidateTasks: nextC };
                                }
                                return m;
                              })
                            );
                          }}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-indigo-500"
                        />

                        <button
                          onClick={() => handleConfirmCandidateTask(msg.id, idx, task)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 shadow transition-all flex-shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" /> Confirm Task
                        </button>
                      </div>

                      {/* Editable Description (Auto-adjusting multi-line) */}
                      <textarea
                        rows={2}
                        placeholder="Description / Context notes..."
                        value={task.description || ''}
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = `${Math.max(el.scrollHeight, 44)}px`;
                          }
                        }}
                        onChange={(e) => {
                          const updated = { ...task, description: e.target.value };
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.max(e.target.scrollHeight, 44)}px`;
                          setMessages((prev) =>
                            prev.map((m) => {
                              if (m.id === msg.id && m.candidateTasks) {
                                const nextC = [...m.candidateTasks];
                                nextC[idx] = updated;
                                return { ...m, candidateTasks: nextC };
                              }
                              return m;
                            })
                          );
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-normal resize-none leading-relaxed"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {/* Editable Priority Selector */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Priority:</span>
                          {(() => {
                            // Helper to check if task deadline is today/overdue
                            const isTodayOrOverdue = task.deadlineISO && !task.userModified && (() => {
                              const d = new Date(task.deadlineISO);
                              const now = new Date();
                              return d.toDateString() === now.toDateString() || d.getTime() < now.getTime();
                            })();

                            const currentVal = isTodayOrOverdue
                              ? '5'
                              : task.importance >= 5 ? '5' : task.importance === 4 ? '4' : task.importance === 2 ? '2' : task.importance === 1 ? '1' : '3';

                            return (
                              <select
                                value={currentVal}
                                onChange={(e) => {
                                  const imp = parseInt(e.target.value, 10);
                                  const updated = { ...task, importance: imp, userModified: true };
                                  setMessages((prev) =>
                                    prev.map((m) => {
                                      if (m.id === msg.id && m.candidateTasks) {
                                        const nextC = [...m.candidateTasks];
                                        nextC[idx] = updated;
                                        return { ...m, candidateTasks: nextC };
                                      }
                                      return m;
                                    })
                                  );
                                }}
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border bg-zinc-900 focus:outline-none transition-all ${
                                  currentVal === '5'
                                    ? 'text-red-400 border-red-500/40'
                                    : currentVal === '4'
                                    ? 'text-amber-400 border-amber-500/40'
                                    : currentVal === '1' || currentVal === '2'
                                    ? 'text-zinc-400 border-zinc-700'
                                    : 'text-emerald-400 border-emerald-500/40'
                                }`}
                              >
                                <option value="5" className="bg-zinc-950 text-red-400 font-bold">🔴 Critical</option>
                                <option value="4" className="bg-zinc-950 text-amber-400 font-bold">🟠 High</option>
                                <option value="3" className="bg-zinc-950 text-emerald-400 font-bold">🟢 Medium</option>
                                <option value="1" className="bg-zinc-950 text-zinc-400 font-bold">⚪ Low</option>
                              </select>
                            );
                          })()}
                        </div>

                        {/* Due Date Display */}
                        {task.deadlineISO && (
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-500" />
                            Due: {new Date(task.deadlineISO).toLocaleDateString('en-GB')}
                          </div>
                        )}
                      </div>

                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="pt-1 text-[11px] text-zinc-400 space-y-1">
                          <span className="font-semibold text-zinc-500">Subtasks:</span>
                          {task.subtasks.map((st, stI) => (
                            <div key={stI} className="pl-2 border-l border-zinc-800">
                              • {st.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" /> AI is processing text & files...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-zinc-950/80 border-t border-zinc-800 space-y-2">
        {file && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300">
            <div className="flex items-center gap-2 truncate">
              {file.type.includes('pdf') ? (
                <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
              ) : file.type.includes('audio') ? (
                <Mic className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-pulse" />
              ) : (
                <ImageIcon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              )}
              <span className="truncate font-medium">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-zinc-500 hover:text-red-400 p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,application/pdf,audio/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-zinc-400 hover:text-indigo-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all flex-shrink-0"
            title="Attach screenshot, image, PDF, or audio file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Voice Microphone Button */}
          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all animate-pulse flex-shrink-0"
              title="Stop Recording"
            >
              <MicOff className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="p-2.5 text-zinc-400 hover:text-emerald-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all flex-shrink-0"
              title="Record Voice Note"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          {/* Text input (Auto-adjusting multi-line textarea) */}
          <textarea
            rows={1}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={isRecording ? "Recording voice note... click red mic to stop" : "Tell assistant a task, paste message, or drag & drop files..."}
            className={`flex-1 bg-zinc-900 border ${isRecording ? 'border-red-500/50' : 'border-zinc-800 focus:border-indigo-500'} rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all resize-none max-h-32 leading-relaxed`}
            disabled={isSending || isRecording}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isSending || (!inputText.trim() && !file) || isRecording}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 transition-all flex-shrink-0"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
