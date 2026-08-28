'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Check, Calendar, Plus, FileText, Mic, X, Camera, FileUp, UploadCloud, Image as ImageIcon, Paperclip, AlertCircle, Sparkles } from 'lucide-react';
import { ExtractedCandidateTask } from '@/lib/aiExtractor';
import { toast } from '@/lib/toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'pdf' | 'audio';
  candidateTasks?: ExtractedCandidateTask[];
  confirmedCount?: number;
  timestamp: string;
  isError?: boolean;
}

interface ChatInterfaceProps {
  onTasksUpdated?: () => void;
}

/* Simple inline markdown: bold, italic, bullet lists */
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bullet point
    if (line.match(/^[\s]*[-•]\s/)) {
      const content = line.replace(/^[\s]*[-•]\s/, '');
      return (
        <div key={i} className="flex items-start gap-2 ml-1 my-0.5">
          <span className="text-indigo-400 mt-0.5 text-xs">•</span>
          <span>{formatInline(content)}</span>
        </div>
      );
    }
    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\./)?.[1];
      const content = line.replace(/^\d+\.\s/, '');
      return (
        <div key={i} className="flex items-start gap-2 ml-1 my-0.5">
          <span className="text-indigo-400 mt-0.5 text-xs font-mono">{num}.</span>
          <span>{formatInline(content)}</span>
        </div>
      );
    }
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return <p key={i} className="my-0.5">{formatInline(line)}</p>;
  });
}

function formatInline(text: string) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    // Italic *text*
    const italicParts = part.split(/(\*[^*]+\*)/g);
    return italicParts.map((ip, j) => {
      if (ip.startsWith('*') && ip.endsWith('*') && !ip.startsWith('**')) {
        return <em key={`${i}-${j}`} className="italic text-zinc-300">{ip.slice(1, -1)}</em>;
      }
      return <span key={`${i}-${j}`}>{ip}</span>;
    });
  });
}

export default function ChatInterface({ onTasksUpdated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `Hey! I'm your AI task assistant. Here's what I can do:\n\n• **Add tasks** — just tell me what you need to do\n• **Attach files** — drop screenshots, PDFs, or voice notes\n• **Get advice** — ask "What should I do now?"\n• **Manage tasks** — mark complete, reschedule, or reprioritize\n\nWhat's on your plate today?`,
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const baseTextRef = useRef<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

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

  const startRecording = async () => {
    if (typeof window === 'undefined') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      baseTextRef.current = inputText;

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
                toast.success('Voice dictation transcribed');
              }
            }
          } catch (err) {
            console.error('Transcription error:', err);
            toast.error('Voice transcription failed');
          } finally {
            setIsTranscribing(false);
          }
        }
      };

      mediaRecorderRef.current.start(200);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      toast.error('Microphone permission required for voice dictation');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    setIsRecording(false);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
      toast.info(`Attached ${e.dataTransfer.files.length} file(s)`);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // 1. If pasting images/files from clipboard (e.g. screenshot or photo)
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const files = Array.from(e.clipboardData.files);
      setAttachedFiles((prev) => [...prev, ...files]);
      toast.info(`Attached ${files.length} image(s) from clipboard`);
      return;
    }

    // 2. If pasting text, allow browser default and auto-resize textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
      }
    }, 0);
  };

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 1.5 * 1024 * 1024) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = textToSend !== undefined ? textToSend : inputText;
    if ((!messageContent.trim() && attachedFiles.length === 0) || isSending) return;

    const currentText = messageContent;
    const rawFiles = [...attachedFiles];
    setInputText('');
    setAttachedFiles([]);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: currentText,
      attachmentName: rawFiles.length > 0 ? rawFiles.map(f => f.name).join(', ') : undefined,
      attachmentType: rawFiles.some(f => f.type.includes('pdf'))
        ? 'pdf'
        : rawFiles.some(f => f.type.includes('image'))
        ? 'image'
        : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    const historyPayload = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const userDateISO = new Date().toISOString();

    try {
      let res;
      if (rawFiles.length > 0) {
        const compressedFiles = await Promise.all(rawFiles.map((f) => compressImageIfNeeded(f)));
        const formData = new FormData();
        formData.append('message', currentText);
        formData.append('userTimezone', userTimezone);
        formData.append('userDateISO', userDateISO);
        for (const f of compressedFiles) formData.append('file', f);
        formData.append('history', JSON.stringify(historyPayload));
        res = await fetch('/api/chat', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: currentText,
            history: historyPayload,
            userTimezone,
            userDateISO,
          }),
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
          if (data.taskActionTaken === 'TASK_COMPLETED') toast.success('Task marked as completed');
          if (data.taskActionTaken === 'TASK_RESCHEDULED') toast.info('Task rescheduled');
        }
      } else {
        setMessages((prev) => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong processing your request. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Network error — couldn\'t reach the server. Check your connection and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      }]);
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
        toast.success(`Added "${updatedTask.title}"`);
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === msgId && msg.candidateTasks) {
              const nextCandidates = msg.candidateTasks.filter((_, i) => i !== candidateIndex);
              return { ...msg, candidateTasks: nextCandidates, confirmedCount: (msg.confirmedCount || 0) + 1 };
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

  const quickPrompts = [
    { label: '✨ What should I do now?', query: 'What should I do now?' },
    { label: '📅 What tasks are due soon?', query: 'What tasks are due soon?' },
    { label: '💡 Prioritize my tasks', query: 'Prioritize my tasks' },
  ];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className="doppelrand-shell relative flex flex-col h-[calc(100dvh-4.75rem)] lg:h-[calc(100vh-6.5rem)] overflow-hidden rounded-2xl sm:rounded-3xl p-0.5 sm:p-1.5"
    >
      {/* Inner Core Container */}
      <div className="doppelrand-core relative flex flex-col flex-1 overflow-hidden rounded-[calc(1rem-2px)] sm:rounded-[calc(1.5rem-2px)]">
        {/* Drag & Drop Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-indigo-950/90 border-2 border-dashed border-indigo-400 rounded-3xl flex flex-col items-center justify-center text-indigo-200 animate-fade-in">
            <UploadCloud className="w-12 h-12 text-indigo-400 mb-3 animate-float" />
            <p className="text-base font-bold">Drop files to extract tasks</p>
            <p className="text-xs text-indigo-300/70 mt-1">Screenshots, PDFs, or voice notes</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-white/[0.06] bg-black/20">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-semibold text-xs sm:text-sm text-white">AI Assistant</h2>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 animate-fade-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white'
                  : msg.isError
                  ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                  : 'bg-white/[0.06] text-indigo-300 border border-white/[0.08]'
              }`}>
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : msg.isError ? <AlertCircle className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div className="max-w-[88%] sm:max-w-[80%] space-y-2">
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-sm shadow-[0_8px_20px_-4px_rgba(99,102,241,0.4)]'
                    : msg.isError
                    ? 'bg-red-950/40 text-red-200 border border-red-500/25 rounded-tl-sm'
                    : 'bg-[#14141a]/90 text-zinc-200 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] rounded-tl-sm'
                }`}>
                  {msg.attachmentName && (
                    <div className="mb-2.5 flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-xl text-xs font-medium border border-white/[0.05]">
                      {msg.attachmentType === 'pdf' ? <FileText className="w-3.5 h-3.5 text-red-400" /> :
                       msg.attachmentType === 'audio' ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> :
                       <ImageIcon className="w-3.5 h-3.5 text-indigo-300" />}
                      <span className="truncate">{msg.attachmentName}</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}</div>

                  {msg.confirmedCount !== undefined && msg.confirmedCount > 0 && (
                    <div className="mt-2.5 text-xs text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5">
                      <Check className="w-3.5 h-3.5" /> Added {msg.confirmedCount} task{msg.confirmedCount > 1 ? 's' : ''} to queue!
                    </div>
                  )}

                  <div suppressHydrationWarning className="text-[9px] opacity-40 text-right font-mono mt-1.5">{msg.timestamp}</div>
                </div>

                {/* Candidate Task Cards */}
                {msg.candidateTasks && msg.candidateTasks.length > 0 && (
                  <div className="space-y-2.5 pt-1">
                    <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">
                      Generated Action Cards:
                    </span>

                    {msg.candidateTasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl space-y-3 bg-[#111116] border border-indigo-500/30 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] animate-scale-in"
                        style={{ animationDelay: `${idx * 80}ms` }}
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
                                    const nextC = [...m.candidateTasks]; nextC[idx] = updated;
                                    return { ...m, candidateTasks: nextC };
                                  }
                                  return m;
                                })
                              );
                            }}
                            className="flex-1 bg-zinc-950/80 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          />
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleConfirmCandidateTask(msg.id, idx, task)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-all active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Add
                            </button>
                            <button
                              onClick={() => {
                                setMessages((prev) =>
                                  prev.map((m) => {
                                    if (m.id === msg.id && m.candidateTasks) {
                                      const nextC = m.candidateTasks.filter((_, i) => i !== idx);
                                      return { ...m, candidateTasks: nextC.length > 0 ? nextC : undefined };
                                    }
                                    return m;
                                  })
                                );
                                toast.info('Dismissed candidate task');
                              }}
                              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-95 border border-white/[0.08]"
                              title="Cancel / Dismiss card"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={task.description || ''}
                          placeholder="Task notes / description (optional)..."
                          rows={2}
                          onChange={(e) => {
                            const updated = { ...task, description: e.target.value, userModified: true };
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
                          className="w-full bg-zinc-950/60 border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none leading-relaxed"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={task.importance >= 5 ? '5' : task.importance === 4 ? '4' : task.importance <= 2 ? '1' : '3'}
                            onChange={(e) => {
                              const imp = parseInt(e.target.value, 10);
                              const updated = { ...task, importance: imp, userModified: true };
                              setMessages((prev) =>
                                prev.map((m) => {
                                  if (m.id === msg.id && m.candidateTasks) {
                                    const nextC = [...m.candidateTasks]; nextC[idx] = updated;
                                    return { ...m, candidateTasks: nextC };
                                  }
                                  return m;
                                })
                              );
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border bg-zinc-950 text-zinc-200 border-white/[0.1] focus:outline-none"
                          >
                            <option value="5">🔴 Critical</option>
                            <option value="4">🟠 High</option>
                            <option value="3">🟢 Medium</option>
                            <option value="1">⚪ Low</option>
                          </select>

                          <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/[0.1] rounded-lg px-2.5 py-1 text-[11px] text-zinc-300">
                            <Calendar className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                            <input
                              type="date"
                              value={
                                task.deadlineISO
                                  ? new Date(task.deadlineISO).toISOString().split('T')[0]
                                  : ''
                              }
                              onChange={(e) => {
                                const newDateVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                                const updated = { ...task, deadlineISO: newDateVal, userModified: true };
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
                              className="bg-transparent text-[11px] text-zinc-300 focus:outline-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isSending && (
            <div className="flex items-start gap-2.5 animate-fade-up">
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-sm bg-[#14141a] border border-white/[0.08] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span className="text-xs text-zinc-400 font-medium">Synthesizing response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Quick Prompt Chips */}
        <div className="px-4 py-2 border-t border-white/[0.04] bg-black/20 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(p.query)}
              disabled={isSending}
              className="flex-shrink-0 text-[10px] font-semibold text-zinc-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] hover:border-indigo-500/40 border border-white/[0.08] px-3 py-1.5 rounded-full transition-all duration-200 active:scale-95 disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-2.5 sm:p-4 border-t border-white/[0.06] bg-black/30 space-y-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:pb-3.5">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 max-h-20 overflow-y-auto">
              {attachedFiles.map((f, idx) => (
                <span
                  key={`${f.name}-${idx}`}
                  className="flex h-7 items-center gap-1.5 bg-white/[0.06] border border-white/[0.1] py-1 pr-1 pl-2.5 text-xs text-zinc-200 rounded-full animate-scale-in"
                >
                  {f.type.includes('image') ? (
                    <img src={URL.createObjectURL(f)} alt={f.name} className="w-4 h-4 rounded-full object-cover" />
                  ) : f.type.includes('pdf') ? (
                    <FileText className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span className="max-w-28 truncate font-medium">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="flex size-4 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 bg-[#09090c] border border-white/[0.1] rounded-2xl p-1.5 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)] focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            {/* Hidden File Inputs */}
            <input type="file" ref={cameraInputRef} accept="image/*" capture="environment"
              onChange={(e) => { if (e.target.files) setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }}
              className="hidden" />
            <input type="file" ref={photosInputRef} multiple accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/*"
              onChange={(e) => { if (e.target.files) setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }}
              className="hidden" />
            <input type="file" ref={filesInputRef} multiple accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              onChange={(e) => { if (e.target.files) setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }}
              className="hidden" />

            {/* Add Attachments Trigger */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex size-8 items-center justify-center text-zinc-400 hover:text-indigo-300 hover:bg-white/[0.06] rounded-xl transition-all active:scale-95 flex-shrink-0"
              title="Add attachment"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Voice Dictation Trigger */}
            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="px-2.5 py-1.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 active:scale-95"
              >
                <span className="flex h-3 items-center gap-[2px]">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="w-[2px] rounded-full bg-red-400 animate-pulse"
                      style={{ height: '100%', animation: `pulse 700ms ease-in-out ${i * 150}ms infinite` }} />
                  ))}
                </span>
                <span className="text-[11px] font-mono font-bold">
                  {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={isTranscribing}
                className="flex size-8 items-center justify-center text-zinc-400 hover:text-emerald-400 disabled:opacity-40 hover:bg-white/[0.06] rounded-xl transition-all active:scale-95 flex-shrink-0"
                title="Voice dictation"
              >
                {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {/* Text Input */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
              }}
              placeholder={
                isTranscribing ? "Transcribing..." : isRecording ? "Recording..." : "Ask AI or describe tasks..."
              }
              className="flex-1 bg-transparent px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none max-h-32 leading-relaxed"
              disabled={isSending || isTranscribing}
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isSending || (!inputText.trim() && attachedFiles.length === 0) || isRecording}
              className="flex size-8 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:opacity-40 text-white shadow-md shadow-indigo-600/30 transition-all enabled:active:scale-95 flex-shrink-0"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </form>
      </div>

      {/* Add to Chat Bottom Sheet */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="w-full max-w-md glass-elevated rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto sm:hidden" />
            <div className="relative flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="absolute left-0 w-8 h-8 rounded-full bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-white">Add to chat</h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Camera, label: 'Camera', color: 'text-indigo-400', ref: cameraInputRef },
                { icon: ImageIcon, label: 'Photos', color: 'text-emerald-400', ref: photosInputRef },
                { icon: FileUp, label: 'Files', color: 'text-purple-400', ref: filesInputRef },
              ].map(({ icon: Icon, label, color, ref }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); ref.current?.click(); }}
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-indigo-500/30 hover:bg-white/[0.06] transition-all group active:scale-95"
                >
                  <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <span className="text-sm font-medium text-zinc-300">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
