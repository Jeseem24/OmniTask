'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Paperclip, Image as ImageIcon, Loader2, Bot, User, Check, Trash2, Calendar, Clock, Plus, AlertCircle, FileText, Mic, MicOff, UploadCloud, X, Camera, FileUp } from 'lucide-react';
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
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Add to Chat Sheet State & File Input Refs
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state & Real-Time Hybrid Dictation (WebSpeech Live Preview + Whisper v3 Precision)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const baseTextRef = useRef<string>('');
  const finalTranscriptRef = useRef<string>('');
  const shouldKeepListeningRef = useRef<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Handle WhatsApp / System Web Share Target URL Params & Binary Files
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const shareId = params.get('shareId');
      const sharedText = params.get('text') || params.get('title') || params.get('url');

      if (shareId) {
        fetch(`/api/share?id=${shareId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.text) setInputText(data.text);
            if (data.files && data.files.length > 0) {
              const convertedFiles: File[] = data.files.map((f: any) => {
                const arr = f.data.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                  u8arr[n] = bstr.charCodeAt(n);
                }
                return new File([u8arr], f.name, { type: mime });
              });
              setAttachedFiles((prev) => [...prev, ...convertedFiles]);
            }
          })
          .catch((err) => console.error('Share fetch error:', err));

        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (sharedText && !sharedText.startsWith('Photo from') && !sharedText.startsWith('Document from')) {
        setInputText(sharedText);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Hybrid Real-Time Dictation: Web Speech Live Preview + Groq Whisper Large v3 Precision Finalizing
  const startRecording = async () => {
    if (typeof window === 'undefined') return;

    try {
      // 1. Capture pristine audio stream with noise suppression & gain control
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      baseTextRef.current = inputText;
      finalTranscriptRef.current = '';
      shouldKeepListeningRef.current = true;

      // 2. High-Fidelity MediaRecorder for Groq Whisper v3 Audio Capture
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Send Pristine Audio to Groq Whisper Large v3 + Llama 3.3 70B Formatting Pipeline
        if (audioBlob.size > 0) {
          setIsTranscribing(true);
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
            if (res.ok) {
              const data = await res.json();
              if (data.text && data.text.trim()) {
                const prefix = baseTextRef.current ? baseTextRef.current.trimEnd() + ' ' : '';
                setInputText(prefix + data.text.trim());
              }
            }
          } catch (err) {
            console.error('Whisper Large v3 transcription error:', err);
          } finally {
            setIsTranscribing(false);
          }
        }
      };

      mediaRecorderRef.current.start(200);

      // 3. Web Speech API for Instantaneous Live Streaming Preview
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let final = '';
            let interim = '';
            for (let i = 0; i < event.results.length; i++) {
              const transcriptChunk = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                final += transcriptChunk + ' ';
              } else {
                interim += transcriptChunk;
              }
            }
            const prefix = baseTextRef.current ? baseTextRef.current.trimEnd() + ' ' : '';
            const cleanLive = (final + interim).replace(/\s+/g, ' ');
            setInputText(prefix + cleanLive);
          };

          recognition.onerror = (e: any) => {
            console.error('Web Speech error:', e);
          };

          recognition.onend = () => {
            if (shouldKeepListeningRef.current && recognitionRef.current) {
              try { recognition.start(); } catch (e) {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.error('Speech recognition live preview note:', e);
        }
      }

      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone permission is required for voice dictation.');
    }
  };

  const stopRecording = () => {
    shouldKeepListeningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    setIsRecording(false);
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
      const droppedFiles = Array.from(e.dataTransfer.files);
      setAttachedFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && attachedFiles.length === 0) || isSending) return;

    const currentText = inputText;
    const currentFiles = [...attachedFiles];
    setInputText('');
    setAttachedFiles([]);

    // 1. Append User Message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: currentText,
      attachmentName: currentFiles.length > 0 ? currentFiles.map(f => f.name).join(', ') : undefined,
      attachmentType: currentFiles.some(f => f.type.includes('pdf'))
        ? 'pdf'
        : currentFiles.some(f => f.type.includes('image'))
        ? 'image'
        : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    const historyPayload = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

    try {
      let res;
      if (currentFiles.length > 0) {
        const formData = new FormData();
        formData.append('message', currentText);
        for (const f of currentFiles) {
          formData.append('file', f);
        }
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
      <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-950/80 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              AI Task Assistant
            </h2>
            <p className="text-[10px] text-zinc-400">Voice, OCR, PDF & Intelligent Task Chat</p>
          </div>
        </div>
      </div>

      {/* Chat Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 transition-all duration-300 ${
              msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}
            style={{
              animation: 'fade-up 350ms cubic-bezier(0.23, 1, 0.32, 1) both',
            }}
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
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5 max-h-24 overflow-y-auto">
            {attachedFiles.map((f, idx) => (
              <span
                key={`${f.name}-${idx}`}
                className="flex h-7 items-center gap-1.5 bg-zinc-900 border border-zinc-800 py-1 pr-1 pl-2 text-xs text-zinc-300 rounded-full shadow-sm animate-in fade-in"
              >
                {f.type.includes('image') ? (
                  <img
                    src={URL.createObjectURL(f)}
                    alt={f.name}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : f.type.includes('pdf') ? (
                  <FileText className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span className="max-w-36 truncate font-medium">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="flex size-4 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              }
            }}
            className="hidden"
          />

          <input
            type="file"
            ref={photosInputRef}
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              }
            }}
            className="hidden"
          />

          <input
            type="file"
            ref={filesInputRef}
            multiple
            accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              }
            }}
            className="hidden"
          />

          {/* Tactile + Button (Triggers Add to Chat Sheet) */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex size-9 items-center justify-center text-zinc-400 hover:text-indigo-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all duration-150 active:scale-[0.94] flex-shrink-0"
            title="Add to chat"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>

          {/* Equalizer Voice Microphone Button (Compact Square Button) */}
          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="flex size-9 items-center justify-center bg-red-600/20 text-red-400 border border-red-500/40 rounded-xl transition-all flex-shrink-0 active:scale-[0.94] shadow-md shadow-red-600/10"
              title="Click to stop dictation"
            >
              <span className="flex h-3.5 items-center gap-[2.5px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] rounded-full bg-red-400"
                    style={{ height: '100%', animation: `pulse 800ms ease-in-out ${i * 180}ms infinite` }}
                  />
                ))}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="flex size-9 items-center justify-center text-zinc-400 hover:text-emerald-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all duration-150 active:scale-[0.94] flex-shrink-0"
              title="Dictate text in real time"
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
            placeholder={
              isTranscribing
                ? "⚡ AI polishing voice transcript with Whisper Large v3..."
                : isRecording
                ? "Listening live & recording audio..."
                : "Write a message or paste notes..."
            }
            className={`flex-1 bg-zinc-900 border ${isRecording ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-zinc-800 focus:border-zinc-700'} rounded-xl px-3.5 py-2 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all resize-none max-h-32 leading-relaxed`}
            disabled={isSending}
          />

          {/* Send button with active scale effect */}
          <button
            type="submit"
            disabled={isSending || (!inputText.trim() && attachedFiles.length === 0) || isRecording}
            className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:opacity-40 text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 enabled:active:scale-[0.95] flex-shrink-0"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Add to Chat Bottom Sheet Overlay (Matching Screenshot) */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-0 sm:p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-6 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle Bar */}
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto" />

            {/* Header */}
            <div className="relative flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="absolute left-0 w-8 h-8 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-zinc-100">Add to chat</h3>
            </div>

            {/* 3 Rounded Action Cards */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {/* Camera Card */}
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  cameraInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center gap-3 p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-850 transition-all group active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800/90 text-zinc-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-zinc-200">Camera</span>
              </button>

              {/* Photos Card */}
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  photosInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center gap-3 p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-850 transition-all group active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800/90 text-zinc-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-zinc-200">Photos</span>
              </button>

              {/* Files Card */}
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  filesInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center gap-3 p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-850 transition-all group active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800/90 text-zinc-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileUp className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-zinc-200">Files</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
