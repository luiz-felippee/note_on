import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Camera,
  Mic,
  Image as ImageIcon,
  FileText,
  Star,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Cloud,
  Sun,
  Moon,
  Download,
  Upload,
  Square,
  Pause,
  Play,
  Menu,
  X,
  Check,
  Edit3,
  Layers,
  Headphones,
  MoreHorizontal,
  Send,
  ChevronDown,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  Course,
  Subject,
  StudyTopic,
  TimelineItem,
  TimelineItemType,
  PhotoHighlightStroke,
} from './types';
import {
  ensureInitialSeedData,
  getAllCourses,
  saveCourse,
  deleteCourseAndChildren,
  getAllSubjects,
  saveSubject,
  deleteSubjectAndChildren,
  getAllTopics,
  saveTopic,
  deleteTopicAndItems,
  getAllItems,
  saveTimelineItem,
  deleteTimelineItem,
  subscribeToAuth,
  exportFullBackupJson,
  importFullBackupJson,
} from './services/storageService';
import { AudioPlayerCard } from './components/AudioPlayerCard';
import { PhotoViewerModal } from './components/PhotoViewerModal';
import { CameraModal } from './components/CameraModal';
import { FirebaseCloudModal } from './components/FirebaseCloudModal';
import { ExamFlashcardsModal } from './components/ExamFlashcardsModal';
import { BoardCarouselModal } from './components/BoardCarouselModal';

const SUBJECT_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
];

export default function App() {
  // 3-Level Core Hierarchy Data: Course -> Subject -> Topic -> Items
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [allItems, setAllItems] = useState<TimelineItem[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // UI State
  const [lightMode, setLightMode] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | TimelineItemType | 'exam'>('all');
  const [globalSearch, setGlobalSearch] = useState('');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [openCardMenuId, setOpenCardMenuId] = useState<string | null>(null);

  // Unified Bottom Capture Input
  const [noteText, setNoteText] = useState('');
  const [markImportant, setMarkImportant] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  // Modals
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');

  const [showNewSubjectModal, setShowNewSubjectModal] = useState(false);
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjCourseId, setNewSubjCourseId] = useState<string>('');
  const [newSubjColor, setNewSubjColor] = useState(SUBJECT_COLORS[0]);

  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');

  const [activePhotoItem, setActivePhotoItem] = useState<TimelineItem | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showFlashcardsModal, setShowFlashcardsModal] = useState(false);
  const [showCarouselModal, setShowCarouselModal] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  // Programmatic Audio Seek
  const [audioSeekTarget, setAudioSeekTarget] = useState<{
    audioItemId: string;
    timeSeconds: number;
    triggerId: number;
  } | null>(null);

  // Inline Editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');

  // Audio Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [isPausedRecording, setIsPausedRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>(Array(20).fill(0.2));
  const [liveTranscript, setLiveTranscript] = useState('');
  const pendingRecordingSessionIdRef = useRef<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordedPeaksRef = useRef<number[]>([]);
  const speechRecognitionRef = useRef<any>(null);

  const reloadAllData = async () => {
    await ensureInitialSeedData();
    const [crs, subjs, tps, itms] = await Promise.all([
      getAllCourses(),
      getAllSubjects(),
      getAllTopics(),
      getAllItems(),
    ]);
    setCourses(crs);
    setSubjects(subjs);
    setTopics(tps);
    setAllItems(itms);

    setSelectedCourseId((prev) =>
      prev && crs.some((c) => c.id === prev) ? prev : crs[0]?.id || null
    );
  };

  useEffect(() => {
    reloadAllData();
    const unsub = subscribeToAuth((u) => setFirebaseUser(u));
    return () => unsub();
  }, []);

  // Update selected Subject when Course changes
  useEffect(() => {
    if (!selectedCourseId) {
      setSelectedSubjectId(null);
      return;
    }
    const courseSubjects = subjects.filter((s) => s.courseId === selectedCourseId);
    if (!courseSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(courseSubjects[0]?.id || null);
    }
  }, [selectedCourseId, subjects]);

  // Update selected Topic when Subject changes
  useEffect(() => {
    if (!selectedSubjectId) {
      setSelectedTopicId(null);
      return;
    }
    const subjTopics = topics.filter((t) => t.subjectId === selectedSubjectId);
    if (!subjTopics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(subjTopics[0]?.id || null);
    }
  }, [selectedSubjectId, topics]);

  useEffect(() => {
    if (!isRecording || isPausedRecording) return;
    const id = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording, isPausedRecording]);

  // Support Ctrl+V image paste
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!selectedTopicId || !selectedSubjectId) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const dataUrl = await compressAndReadImage(file);
            await addTimelineEntry({
              type: 'photo',
              content: noteText.trim(),
              mediaDataUrl: dataUrl,
            });
            setNoteText('');
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [selectedTopicId, selectedSubjectId, noteText, isRecording, recordingSeconds]);

  // Current selections
  const currentCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  const courseSubjects = useMemo(
    () =>
      subjects
        .filter((s) => s.courseId === selectedCourseId)
        .sort((a, b) => a.createdAt - b.createdAt),
    [subjects, selectedCourseId]
  );

  const currentSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );

  const subjectTopics = useMemo(
    () =>
      topics
        .filter((t) => t.subjectId === selectedSubjectId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [topics, selectedSubjectId]
  );

  const currentTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) || null,
    [topics, selectedTopicId]
  );

  const currentTopicItems = useMemo(() => {
    return allItems
      .filter((i) => i.topicId === selectedTopicId)
      .sort((a, b) => {
        if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
        return a.createdAt - b.createdAt;
      });
  }, [allItems, selectedTopicId]);

  const filteredTimelineItems = useMemo(() => {
    let base = globalSearch.trim()
      ? allItems.filter((item) => {
          const q = globalSearch.toLowerCase();
          return (
            item.content.toLowerCase().includes(q) ||
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.transcript && item.transcript.toLowerCase().includes(q)) ||
            item.timeLabel.includes(q)
          );
        })
      : currentTopicItems;

    if (filterType === 'exam') {
      base = base.filter((i) => i.importantForExam);
    } else if (filterType !== 'all') {
      base = base.filter((i) => i.type === filterType);
    }

    return base;
  }, [allItems, currentTopicItems, filterType, globalSearch]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const compressAndReadImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1500;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(ev.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(ev.target?.result as string);
        img.src = ev.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const parseTitleAndBody = (raw: string, fallbackTitle?: string) => {
    const lines = raw.trim().split('\n');
    if (lines.length > 1 && lines[0].startsWith('#')) {
      return {
        title: lines[0].replace(/^#+\s*/, '').trim(),
        content: lines.slice(1).join('\n').trim(),
      };
    }
    return { title: fallbackTitle, content: raw.trim() };
  };

  const addTimelineEntry = async (params: {
    idOverride?: string;
    type: TimelineItemType;
    title?: string;
    content: string;
    transcript?: string;
    mediaDataUrl?: string;
    audioDurationSeconds?: number;
    audioWaveform?: number[];
    customTimestampMs?: number;
  }) => {
    if (!selectedSubjectId || !selectedTopicId) return;

    const nowMs = params.customTimestampMs || Date.now();
    const dateObj = new Date(nowMs);
    const timeLabel = dateObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const dateLabel = dateObj.toLocaleDateString('pt-BR');

    const maxOrder = currentTopicItems.reduce(
      (max, it) => Math.max(max, it.orderIndex || 0),
      0
    );

    const lectureRelativeTimestamp =
      isRecording && params.type !== 'audio'
        ? `${formatDuration(recordingSeconds)} do áudio`
        : undefined;

    const lectureOffsetSeconds =
      isRecording && params.type !== 'audio' ? recordingSeconds : undefined;

    const linkedAudioItemId =
      isRecording && params.type !== 'audio' && pendingRecordingSessionIdRef.current
        ? pendingRecordingSessionIdRef.current
        : undefined;

    const parsed = parseTitleAndBody(params.content, params.title);

    const newItem: TimelineItem = {
      id:
        params.idOverride ||
        `item-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
      topicId: selectedTopicId,
      subjectId: selectedSubjectId,
      courseId: selectedCourseId || undefined,
      type: params.type,
      createdAt: nowMs,
      timeLabel,
      dateLabel,
      orderIndex: maxOrder + 1,
      title: parsed.title,
      content: parsed.content,
      transcript: params.transcript,
      importantForExam: markImportant,
      mediaDataUrl: params.mediaDataUrl,
      audioDurationSeconds: params.audioDurationSeconds,
      audioWaveform: params.audioWaveform,
      lectureRelativeTimestamp,
      lectureOffsetSeconds,
      linkedAudioItemId,
    };

    setAllItems((prev) => [...prev, newItem]);
    const saved = await saveTimelineItem(newItem);
    setAllItems((prev) => prev.map((it) => (it.id === saved.id ? saved : it)));
    setMarkImportant(false);
  };

  const handleSeekToLectureAudio = (item: TimelineItem) => {
    const targetAudio = item.linkedAudioItemId
      ? allItems.find((i) => i.id === item.linkedAudioItemId)
      : currentTopicItems.find((i) => i.type === 'audio');

    if (!targetAudio) return;

    const el = document.getElementById(`timeline-card-${targetAudio.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setAudioSeekTarget({
      audioItemId: targetAudio.id,
      timeSeconds: item.lectureOffsetSeconds || 0,
      triggerId: Date.now(),
    });
  };

  const handleAddTextNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await addTimelineEntry({
      type: 'text',
      content: noteText,
    });
    setNoteText('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    for (let idx = 0; idx < fileArray.length; idx++) {
      const file = fileArray[idx];
      const dataUrl = await compressAndReadImage(file);
      const baseTime = Date.now() + idx * 100;
      await addTimelineEntry({
        type: 'photo',
        title:
          fileArray.length > 1
            ? `Foto ${idx + 1}/${fileArray.length}`
            : undefined,
        content: noteText.trim(),
        mediaDataUrl: dataUrl,
        customTimestampMs: baseTime,
      });
    }
    setNoteText('');
    e.target.value = '';
  };

  // Audio Recording
  const startAudioRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordedPeaksRef.current = [];
      setLiveTranscript('');
      pendingRecordingSessionIdRef.current = `item-audio-${Date.now()}`;

      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const recognition = new SpeechRec();
          recognition.lang = 'pt-BR';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event: any) => {
            let finalStr = '';
            for (let i = 0; i < event.results.length; i++) {
              finalStr += event.results[i][0].transcript + ' ';
            }
            setLiveTranscript(finalStr.trim());
          };
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch {
          // ignore
        }
      }

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const bars: number[] = [];
        for (let i = 0; i < 20; i++) {
          const val = dataArray[i] / 255;
          bars.push(Math.max(0.18, Math.min(1, val)));
        }
        setLiveWaveform(bars);
        const avg = bars.reduce((a, b) => a + b, 0) / bars.length;
        recordedPeaksRef.current.push(Number(avg.toFixed(2)));
        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      animFrameRef.current = requestAnimationFrame(updateWaveform);

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setIsPausedRecording(false);
      setIsRecording(true);
    } catch {
      alert('Não foi possível acessar o microfone.');
    }
  };

  const togglePauseRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause();
      setIsPausedRecording(true);
    } else if (rec.state === 'paused') {
      rec.resume();
      setIsPausedRecording(false);
    }
  };

  const stopAndSaveRecording = () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    const finalDuration = Math.max(1, recordingSeconds);
    const plannedId = pendingRecordingSessionIdRef.current || `item-audio-${Date.now()}`;
    const notesToSave = noteText.trim();
    const transcriptToSave = liveTranscript.trim() || undefined;

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }

    rec.onstop = () => {
      const blob = new Blob(audioChunksRef.current, {
        type: rec.mimeType || 'audio/webm',
      });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const rawPeaks = recordedPeaksRef.current;
        const sampledBars: number[] = [];
        const targetCount = 28;
        for (let i = 0; i < targetCount; i++) {
          const idx = Math.floor((i / targetCount) * rawPeaks.length);
          sampledBars.push(
            rawPeaks[idx] ? Math.max(0.22, Math.min(0.98, rawPeaks[idx] * 1.4)) : 0.45
          );
        }

        await addTimelineEntry({
          idOverride: plannedId,
          type: 'audio',
          content: notesToSave,
          transcript: transcriptToSave,
          mediaDataUrl: base64Audio,
          audioDurationSeconds: finalDuration,
          audioWaveform: sampledBars,
        });
        setNoteText('');
      };
      reader.readAsDataURL(blob);

      rec.stream.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      setIsRecording(false);
      setIsPausedRecording(false);
      setRecordingSeconds(0);
      setLiveTranscript('');
      pendingRecordingSessionIdRef.current = null;
    };

    rec.stop();
  };

  const cancelRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec) {
      rec.onstop = null;
      rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    setIsRecording(false);
    setIsPausedRecording(false);
    setRecordingSeconds(0);
    setLiveTranscript('');
    pendingRecordingSessionIdRef.current = null;
  };

  const moveItemOrder = async (itemId: string, direction: 'up' | 'down') => {
    const idx = currentTopicItems.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= currentTopicItems.length) return;

    const itemA = { ...currentTopicItems[idx] };
    const itemB = { ...currentTopicItems[swapIdx] };
    const tempOrder = itemA.orderIndex;
    itemA.orderIndex = itemB.orderIndex;
    itemB.orderIndex = tempOrder;

    setAllItems((prev) =>
      prev.map((it) => {
        if (it.id === itemA.id) return itemA;
        if (it.id === itemB.id) return itemB;
        return it;
      })
    );
    setOpenCardMenuId(null);
    await Promise.all([saveTimelineItem(itemA), saveTimelineItem(itemB)]);
  };

  const restoreStrictChronologicalOrder = async () => {
    const sortedByTime = [...currentTopicItems].sort(
      (a, b) => a.createdAt - b.createdAt
    );
    const updatedList: TimelineItem[] = sortedByTime.map((it, index) => ({
      ...it,
      orderIndex: index + 1,
    }));

    setAllItems((prev) =>
      prev.map((it) => {
        const found = updatedList.find((u) => u.id === it.id);
        return found || it;
      })
    );
    setShowHeaderMenu(false);
    for (const u of updatedList) {
      await saveTimelineItem(u);
    }
  };

  const toggleExamStar = async (item: TimelineItem) => {
    const updated: TimelineItem = {
      ...item,
      importantForExam: !item.importantForExam,
    };
    setAllItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
    await saveTimelineItem(updated);
  };

  const handleUpdateFlashcardStatus = async (
    itemId: string,
    status: 'mastered' | 'review_again'
  ) => {
    const target = allItems.find((i) => i.id === itemId);
    if (!target) return;
    const updated: TimelineItem = { ...target, flashcardStatus: status };
    setAllItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)));
    await saveTimelineItem(updated);
  };

  const handleSaveItemEdit = async (item: TimelineItem) => {
    const updated: TimelineItem = {
      ...item,
      title: editingTitle.trim() || undefined,
      content: editingContent.trim(),
    };
    setAllItems((prev) => prev.map((it) => (it.id === item.id ? updated : it)));
    setEditingItemId(null);
    await saveTimelineItem(updated);
  };

  const handleSavePhotoHighlights = async (
    itemId: string,
    strokes: PhotoHighlightStroke[]
  ) => {
    const target = allItems.find((i) => i.id === itemId);
    if (!target) return;
    const updated: TimelineItem = { ...target, photoHighlights: strokes };
    setAllItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)));
    setActivePhotoItem(updated);
    await saveTimelineItem(updated);
  };

  const handleDeleteItem = async (itemId: string) => {
    setAllItems((prev) => prev.filter((i) => i.id !== itemId));
    setOpenCardMenuId(null);
    await deleteTimelineItem(itemId);
  };

  // Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    const now = Date.now();
    const course: Course = {
      id: `course-${now}`,
      name: newCourseName.trim(),
      description: newCourseDesc.trim() || undefined,
      color: '#6366f1',
      createdAt: now,
      updatedAt: now,
    };
    await saveCourse(course);

    // Create a default first subject inside this new course
    const firstSubject: Subject = {
      id: `subj-${now + 1}`,
      courseId: course.id,
      name: 'Geral',
      color: '#6366f1',
      icon: 'BookOpen',
      createdAt: now + 1,
      updatedAt: now + 1,
    };
    await saveSubject(firstSubject);

    // Create a first lesson inside that subject
    const firstTopic: StudyTopic = {
      id: `topic-${now + 2}`,
      courseId: course.id,
      subjectId: firstSubject.id,
      title: 'Aula 01',
      date: new Date().toISOString().slice(0, 10),
      startTime: new Date().toLocaleTimeString('pt-BR'),
      studyDurationSeconds: 0,
      createdAt: now + 2,
      updatedAt: now + 2,
    };
    await saveTopic(firstTopic);

    setCourses((prev) => [...prev, course]);
    setSubjects((prev) => [...prev, firstSubject]);
    setTopics((prev) => [firstTopic, ...prev]);

    setSelectedCourseId(course.id);
    setSelectedSubjectId(firstSubject.id);
    setSelectedTopicId(firstTopic.id);

    setNewCourseName('');
    setNewCourseDesc('');
    setShowNewCourseModal(false);
  };

  // Create Subject bound to Course
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;
    const targetCourseId = newSubjCourseId || selectedCourseId;
    if (!targetCourseId) return;

    const now = Date.now();
    const subj: Subject = {
      id: `subj-${now}`,
      courseId: targetCourseId,
      name: newSubjName.trim(),
      color: newSubjColor,
      icon: 'BookOpen',
      createdAt: now,
      updatedAt: now,
    };
    await saveSubject(subj);

    // Automatically create first lesson bound to this subject & course
    const firstTopic: StudyTopic = {
      id: `topic-${now + 1}`,
      courseId: targetCourseId,
      subjectId: subj.id,
      title: 'Aula 01',
      date: new Date().toISOString().slice(0, 10),
      startTime: new Date().toLocaleTimeString('pt-BR'),
      studyDurationSeconds: 0,
      createdAt: now + 1,
      updatedAt: now + 1,
    };
    await saveTopic(firstTopic);

    setSubjects((prev) => [...prev, subj]);
    setTopics((prev) => [firstTopic, ...prev]);

    setSelectedCourseId(targetCourseId);
    setSelectedSubjectId(subj.id);
    setSelectedTopicId(firstTopic.id);

    setNewSubjName('');
    setShowNewSubjectModal(false);
  };

  // Create Topic (Lesson) bound to Subject & Course
  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !newTopicTitle.trim()) return;
    const now = Date.now();
    const topic: StudyTopic = {
      id: `topic-${now}`,
      courseId: selectedCourseId || undefined,
      subjectId: selectedSubjectId,
      title: newTopicTitle.trim(),
      date: new Date().toISOString().slice(0, 10),
      startTime: new Date().toLocaleTimeString('pt-BR'),
      studyDurationSeconds: 0,
      createdAt: now,
      updatedAt: now,
    };
    await saveTopic(topic);
    setTopics((prev) => [topic, ...prev]);
    setSelectedTopicId(topic.id);
    setNewTopicTitle('');
    setShowNewTopicModal(false);
  };

  const handleExportFullBackup = async () => {
    setShowHeaderMenu(false);
    const json = await exportFullBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noteon-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFullBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importFullBackupJson(text);
      await reloadAllData();
      setShowHeaderMenu(false);
    } catch (err: any) {
      alert('Erro ao importar backup: ' + (err?.message || 'Arquivo inválido'));
    } finally {
      e.target.value = '';
    }
  };

  const exportTopicStudySheet = () => {
    setShowHeaderMenu(false);
    if (!currentTopic || !currentSubject) return;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${currentCourse?.name || ''} — ${currentSubject.name} — ${currentTopic.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 820px; margin: 32px auto; padding: 0 20px; color: #0f172a; background: #f8fafc; }
    .header { background: #0f172a; color: white; padding: 24px; border-radius: 16px; margin-bottom: 24px; border-left: 6px solid ${currentSubject.color}; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 14px; }
    .meta { font-family: monospace; font-size: 12px; color: #64748b; margin-bottom: 8px; }
    img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
    audio { width: 100%; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:13px;opacity:0.8;">${currentCourse?.name || 'Curso'} • ${currentSubject.name} • ${currentTopic.date}</div>
    <h1 style="margin:6px 0 0 0;font-size:22px;">${currentTopic.title}</h1>
  </div>
  ${currentTopicItems
    .map(
      (item, idx) => `
    <div class="card">
      <div class="meta">#${idx + 1} • ${item.timeLabel} (${item.dateLabel}) ${
        item.importantForExam ? '• ⭐ Importante' : ''
      }</div>
      ${item.title ? `<h3 style="margin:4px 0 8px 0;">${item.title}</h3>` : ''}
      ${item.type === 'photo' && item.mediaDataUrl ? `<img src="${item.mediaDataUrl}" />` : ''}
      ${item.type === 'audio' && item.mediaDataUrl ? `<audio controls src="${item.mediaDataUrl}"></audio>` : ''}
      <p style="white-space:pre-wrap;line-height:1.6;margin:6px 0 0 0;">${item.content}</p>
    </div>`
    )
    .join('')}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentTopic.title.replace(/\s+/g, '-').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const photos = currentTopicItems.filter((i) => i.type === 'photo').length;
    const audios = currentTopicItems.filter((i) => i.type === 'audio').length;
    const exams = currentTopicItems.filter((i) => i.importantForExam).length;
    return { photos, audios, exams };
  }, [currentTopicItems]);

  const subjectExamFlashcards = useMemo(
    () => allItems.filter((i) => i.subjectId === selectedSubjectId && i.importantForExam),
    [allItems, selectedSubjectId]
  );

  const currentTopicPhotos = useMemo(
    () => currentTopicItems.filter((i) => i.type === 'photo'),
    [currentTopicItems]
  );

  return (
    <div
      className={`min-h-screen flex flex-col md:flex-row transition-colors ${
        lightMode ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Mobile Top Bar */}
      <header
        className={`md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b ${
          lightMode
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-200 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="truncate">
            <div className="text-[11px] text-slate-400 truncate">
              {currentCourse?.name} › {currentSubject?.name}
            </div>
            <div className="text-sm font-bold truncate">
              {currentTopic?.title || 'NoteOn'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {stats.photos > 0 && (
            <button
              type="button"
              onClick={() => setShowCarouselModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-xs text-cyan-300 font-medium cursor-pointer"
            >
              Fotos ({stats.photos})
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCloudModal(true)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
          >
            <Cloud className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Clean 3-Level Sidebar (Course Selector -> Subjects -> Topics) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 shrink-0 flex flex-col border-r transition-transform duration-200 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${
          lightMode
            ? 'bg-white border-slate-200'
            : 'bg-slate-900/70 border-slate-800/80'
        }`}
      >
        {/* Brand */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-tight">NoteOn</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 md:hidden cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Level 1: Course Selector Tab / Dropdown */}
        <div className="p-3 border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Curso Ativo
            </span>
            <button
              type="button"
              onClick={() => setShowNewCourseModal(true)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-medium cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Novo Curso</span>
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCourseDropdown((v) => !v)}
              className={`w-full px-3 py-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                lightMode
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-slate-900 border-slate-700/80 text-white'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <GraduationCap className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="truncate">
                  {currentCourse?.name || 'Selecione um Curso'}
                </span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </button>

            {showCourseDropdown && (
              <>
                <div
                  onClick={() => setShowCourseDropdown(false)}
                  className="fixed inset-0 z-30"
                />
                <div
                  className={`absolute left-0 right-0 mt-1 rounded-xl border shadow-2xl z-40 py-1 max-h-56 overflow-y-auto ${
                    lightMode
                      ? 'bg-white border-slate-200 text-slate-800'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  {courses.map((crs) => {
                    const isSelected = crs.id === selectedCourseId;
                    const subjCount = subjects.filter(
                      (s) => s.courseId === crs.id
                    ).length;
                    return (
                      <div
                        key={crs.id}
                        onClick={() => {
                          setSelectedCourseId(crs.id);
                          setShowCourseDropdown(false);
                        }}
                        className={`group px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-600/15 text-indigo-400 font-semibold'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="truncate">
                          <div>{crs.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {subjCount} matérias
                          </div>
                        </div>

                        {courses.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `Excluir o curso "${crs.name}" e todas as suas matérias e aulas vinculadas?`
                                )
                              ) {
                                deleteCourseAndChildren(crs.id).then(reloadAllData);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Clean Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Buscar anotação ou horário..."
              className={`w-full rounded-lg pl-8 pr-7 py-1.5 text-xs border focus:outline-none focus:border-indigo-500 ${
                lightMode
                  ? 'bg-slate-100 border-slate-200 text-slate-900'
                  : 'bg-slate-950/80 border-slate-800 text-slate-100'
              }`}
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Level 2 & 3: Subjects & Lessons of the Active Course */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-5">
          {/* Subjects inside selected Course */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Matérias de {currentCourse?.name || 'Curso'} ({courseSubjects.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewSubjCourseId(selectedCourseId || '');
                  setShowNewSubjectModal(true);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Matéria</span>
              </button>
            </div>

            {courseSubjects.length === 0 ? (
              <div className="p-3 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-400">
                Nenhuma matéria neste curso. Clique em "+ Nova Matéria" para criar.
              </div>
            ) : (
              <div className="space-y-0.5">
                {courseSubjects.map((subj) => {
                  const isSelected = subj.id === selectedSubjectId;
                  const lessonsCount = topics.filter(
                    (t) => t.subjectId === subj.id
                  ).length;
                  return (
                    <div
                      key={subj.id}
                      onClick={() => {
                        setSelectedSubjectId(subj.id);
                        setGlobalSearch('');
                      }}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition ${
                        isSelected
                          ? lightMode
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'bg-slate-800 text-white font-semibold'
                          : lightMode
                          ? 'text-slate-600 hover:bg-slate-100'
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span
                          style={{ backgroundColor: subj.color }}
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                        />
                        <span className="truncate">{subj.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({lessonsCount})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            confirm(
                              `Excluir a matéria "${subj.name}" e todas as suas aulas?`
                            )
                          ) {
                            deleteSubjectAndChildren(subj.id).then(reloadAllData);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Level 3: Lessons inside Selected Subject */}
          {currentSubject && (
            <div>
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Aulas de {currentSubject.name} ({subjectTopics.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewTopicModal(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Aula</span>
                </button>
              </div>

              <div className="space-y-1">
                {subjectTopics.map((tp) => {
                  const isSelected = tp.id === selectedTopicId;
                  const count = allItems.filter((i) => i.topicId === tp.id).length;
                  return (
                    <div
                      key={tp.id}
                      onClick={() => {
                        setSelectedTopicId(tp.id);
                        setGlobalSearch('');
                        setMobileSidebarOpen(false);
                      }}
                      className={`group rounded-lg px-3 py-2.5 cursor-pointer transition ${
                        isSelected
                          ? lightMode
                            ? 'bg-slate-200/80 text-slate-900 font-semibold'
                            : 'bg-indigo-600/15 border border-indigo-500/30 text-white'
                          : lightMode
                          ? 'hover:bg-slate-100 text-slate-600'
                          : 'hover:bg-slate-800/40 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">
                          {tp.title}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Excluir "${tp.title}"?`)) {
                              deleteTopicAndItems(tp.id).then(reloadAllData);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono opacity-70 mt-1">
                        <span>
                          {tp.date.split('-').reverse().join('/')} • {tp.startTime.slice(0, 5)}
                        </span>
                        <span>{count} itens</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Simple Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/50">
          <button
            type="button"
            onClick={() => setShowCloudModal(true)}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition cursor-pointer ${
              firebaseUser
                ? 'bg-emerald-500/10 text-emerald-300'
                : lightMode
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Cloud className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">
                {firebaseUser ? firebaseUser.email : 'Nuvem Firebase'}
              </span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Clean Header: Course › Subject › Lesson */}
        {currentTopic && currentSubject && (
          <div
            className={`px-4 md:px-8 py-3.5 border-b shrink-0 flex flex-wrap items-center justify-between gap-4 ${
              lightMode
                ? 'bg-white border-slate-200'
                : 'bg-slate-950/90 border-slate-800/80'
            }`}
          >
            {/* Breadcrumb Hierarchy */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="text-slate-300 font-semibold">
                  {currentCourse?.name || 'Curso'}
                </span>
                <span>›</span>
                <span
                  style={{ color: currentSubject.color }}
                  className="font-medium"
                >
                  {currentSubject.name}
                </span>
                <span>›</span>
                <span className="font-mono">
                  {currentTopic.date.split('-').reverse().join('/')} às{' '}
                  {currentTopic.startTime.slice(0, 5)}
                </span>
              </div>
              <h2 className="text-base md:text-lg font-bold tracking-tight truncate mt-0.5">
                {currentTopic.title}
              </h2>
            </div>

            {/* Right: Clean Filter Tabs + Secondary Options Menu */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center p-1 rounded-xl border text-xs ${
                  lightMode
                    ? 'bg-slate-100 border-slate-200'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tudo ({currentTopicItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('photo')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    filterType === 'photo'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fotos ({stats.photos})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('audio')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    filterType === 'audio'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Áudios ({stats.audios})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('exam')}
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition cursor-pointer ${
                    filterType === 'exam'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <Star className="w-3 h-3" />
                  <span className="hidden sm:inline">Importantes</span> ({stats.exams})
                </button>
              </div>

              {/* Options Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowHeaderMenu((v) => !v)}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    lightMode
                      ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Mais opções"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {showHeaderMenu && (
                  <>
                    <div
                      onClick={() => setShowHeaderMenu(false)}
                      className="fixed inset-0 z-30"
                    />
                    <div
                      className={`absolute right-0 mt-2 w-56 rounded-xl border shadow-xl z-40 py-1.5 text-xs ${
                        lightMode
                          ? 'bg-white border-slate-200 text-slate-700'
                          : 'bg-slate-900 border-slate-800 text-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(false);
                          setShowCarouselModal(true);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-cyan-400" />
                        <span>Modo Slides de Fotos ({stats.photos})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(false);
                          setShowFlashcardsModal(true);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Star className="w-4 h-4 text-amber-400" />
                        <span>Revisar Importantes (Flashcards)</span>
                      </button>

                      <button
                        type="button"
                        onClick={restoreStrictChronologicalOrder}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-indigo-400" />
                        <span>Reordenar por Horário Exato</span>
                      </button>

                      <div className="my-1 border-t border-slate-800/60" />

                      <button
                        type="button"
                        onClick={exportTopicStudySheet}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>Exportar Apostila da Aula</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportFullBackup}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-slate-400" />
                        <span>Salvar Backup Completo (.json)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => backupInputRef.current?.click()}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>Restaurar Backup (.json)</span>
                      </button>

                      <div className="my-1 border-t border-slate-800/60" />

                      <button
                        type="button"
                        onClick={() => {
                          setLightMode((v) => !v);
                          setShowHeaderMenu(false);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer"
                      >
                        {lightMode ? (
                          <Moon className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Sun className="w-4 h-4 text-amber-400" />
                        )}
                        <span>{lightMode ? 'Modo Escuro' : 'Modo Claro'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFullBackup}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Chronological Timeline */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          <div className="max-w-3xl mx-auto">
            {filteredTimelineItems.length === 0 ? (
              <div
                className={`rounded-2xl border border-dashed p-12 text-center my-8 ${
                  lightMode
                    ? 'border-slate-300 text-slate-500'
                    : 'border-slate-800 text-slate-400'
                }`}
              >
                <Layers className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-80" />
                <h3 className="text-sm font-semibold text-slate-200">
                  Linha do tempo vazia
                </h3>
                <p className="text-xs mt-1">
                  Use a barra abaixo para digitar notas, tirar fotos ou gravar áudio em ordem cronológica.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTimelineItems.map((item, idx) => {
                  const isEditing = editingItemId === item.id;
                  const isMenuOpen = openCardMenuId === item.id;

                  return (
                    <div
                      key={item.id}
                      id={`timeline-card-${item.id}`}
                      className="flex gap-3 md:gap-4 items-start group"
                    >
                      {/* Left Column: Chronological Timestamp */}
                      <div className="w-16 md:w-20 shrink-0 pt-3 text-right select-none">
                        <div className="font-mono text-xs font-semibold text-indigo-400">
                          {item.timeLabel}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          #{String(idx + 1).padStart(2, '0')}
                        </div>
                      </div>

                      {/* Vertical Timeline Line + Dot */}
                      <div className="flex flex-col items-center self-stretch pt-4">
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            item.type === 'photo'
                              ? 'bg-cyan-400'
                              : item.type === 'audio'
                              ? 'bg-emerald-400'
                              : 'bg-indigo-400'
                          }`}
                        />
                        <div className="w-px flex-1 bg-slate-800/80 my-1" />
                      </div>

                      {/* Right Column: Card */}
                      <div
                        className={`flex-1 min-w-0 rounded-2xl border p-4 transition ${
                          item.importantForExam
                            ? lightMode
                              ? 'bg-amber-50/60 border-amber-300'
                              : 'bg-slate-900/90 border-amber-500/40'
                            : lightMode
                            ? 'bg-white border-slate-200/90'
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80'
                        }`}
                      >
                        {/* Minimal Card Top Row */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                              {item.type === 'photo' ? (
                                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                              ) : item.type === 'audio' ? (
                                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                              )}
                              <span>
                                {item.title ||
                                  (item.type === 'photo'
                                    ? 'Foto'
                                    : item.type === 'audio'
                                    ? 'Gravação de Áudio'
                                    : 'Anotação')}
                              </span>
                            </span>

                            {item.lectureRelativeTimestamp && (
                              <button
                                type="button"
                                onClick={() => handleSeekToLectureAudio(item)}
                                className="px-2 py-0.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[11px] font-mono flex items-center gap-1 transition cursor-pointer"
                                title="Ouvir este momento no áudio da aula"
                              >
                                <Headphones className="w-3 h-3" />
                                <span>{item.lectureRelativeTimestamp}</span>
                              </button>
                            )}
                          </div>

                          {/* Minimal Actions: Star + ⋯ Dropdown */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleExamStar(item)}
                              className={`p-1 rounded-lg transition cursor-pointer ${
                                item.importantForExam
                                  ? 'text-amber-400'
                                  : 'text-slate-500 opacity-0 group-hover:opacity-100 hover:text-amber-300'
                              }`}
                              title="Destacar como importante"
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  item.importantForExam ? 'fill-amber-400' : ''
                                }`}
                              />
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenCardMenuId(isMenuOpen ? null : item.id)
                                }
                                className="p-1 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:text-slate-200 transition cursor-pointer"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>

                              {isMenuOpen && (
                                <>
                                  <div
                                    onClick={() => setOpenCardMenuId(null)}
                                    className="fixed inset-0 z-20"
                                  />
                                  <div
                                    className={`absolute right-0 mt-1 w-36 rounded-xl border shadow-xl z-30 py-1 text-xs ${
                                      lightMode
                                        ? 'bg-white border-slate-200 text-slate-700'
                                        : 'bg-slate-900 border-slate-800 text-slate-200'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingItemId(item.id);
                                        setEditingTitle(item.title || '');
                                        setEditingContent(item.content);
                                        setOpenCardMenuId(null);
                                      }}
                                      className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => moveItemOrder(item.id, 'up')}
                                      className="w-full px-3 py-1.5 text-left hover:bg-slate-800 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                      <span>Subir</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        idx === filteredTimelineItems.length - 1
                                      }
                                      onClick={() => moveItemOrder(item.id, 'down')}
                                      className="w-full px-3 py-1.5 text-left hover:bg-slate-800 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                      <span>Descer</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="w-full px-3 py-1.5 text-left hover:bg-rose-500/15 text-rose-400 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Excluir</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Photo Body */}
                        {item.type === 'photo' && item.mediaDataUrl && (
                          <div
                            onClick={() => setActivePhotoItem(item)}
                            className="relative rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950 max-h-80 flex items-center justify-center cursor-zoom-in my-2"
                          >
                            <img
                              src={item.mediaDataUrl}
                              alt={item.title || 'Foto'}
                              className="max-h-80 w-auto object-contain"
                            />
                            {item.photoHighlights &&
                              item.photoHighlights.length > 0 && (
                                <svg
                                  viewBox="0 0 100 100"
                                  preserveAspectRatio="none"
                                  className="absolute inset-0 w-full h-full pointer-events-none"
                                >
                                  {item.photoHighlights.map((st, sIdx) => (
                                    <polyline
                                      key={sIdx}
                                      fill="none"
                                      stroke={st.color}
                                      strokeWidth={st.width}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      points={st.points
                                        .map((p) => `${p.x},${p.y}`)
                                        .join(' ')}
                                    />
                                  ))}
                                </svg>
                              )}
                          </div>
                        )}

                        {/* Audio Body */}
                        {item.type === 'audio' && item.mediaDataUrl && (
                          <div className="my-2">
                            <AudioPlayerCard
                              src={item.mediaDataUrl}
                              durationHint={item.audioDurationSeconds}
                              waveform={item.audioWaveform}
                              accentColor={currentSubject?.color || '#6366f1'}
                              title={item.title}
                              transcript={item.transcript}
                              markers={item.audioMarkers}
                              seekRequest={
                                audioSeekTarget &&
                                audioSeekTarget.audioItemId === item.id
                                  ? {
                                      timeSeconds: audioSeekTarget.timeSeconds,
                                      triggerId: audioSeekTarget.triggerId,
                                    }
                                  : null
                              }
                            />
                          </div>
                        )}

                        {/* Text or Caption */}
                        {isEditing ? (
                          <div className="space-y-2 mt-2 pt-2 border-t border-slate-800">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              placeholder="Título (opcional)"
                              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white"
                            />
                            <textarea
                              rows={3}
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingItemId(null)}
                                className="px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveItemEdit(item)}
                                className="px-3 py-1 rounded-lg bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                        ) : (
                          item.content && (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200 mt-1">
                              {item.content}
                            </p>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sleek Unified Bottom Capture Bar */}
        {currentTopic && (
          <div className="px-4 md:px-8 pb-4 pt-2 shrink-0">
            <div className="max-w-3xl mx-auto">
              {isRecording && (
                <div className="mb-2 px-4 py-2.5 rounded-2xl bg-rose-950/90 border border-rose-500/40 flex items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                    <span className="font-mono text-xs font-bold text-white">
                      {formatDuration(recordingSeconds)}
                    </span>
                    <div className="flex items-center gap-0.5 h-5">
                      {liveWaveform.map((v, i) => (
                        <div
                          key={i}
                          style={{ height: `${Math.max(20, Math.round(v * 100))}%` }}
                          className="w-1 bg-rose-400 rounded-full"
                        />
                      ))}
                    </div>
                    {liveTranscript && (
                      <span className="text-xs text-rose-200/80 italic truncate hidden sm:inline">
                        "{liveTranscript}"
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={togglePauseRecording}
                      className="p-1.5 rounded-lg bg-slate-900/80 text-slate-200 hover:bg-slate-800 cursor-pointer"
                      title={isPausedRecording ? 'Retomar' : 'Pausar'}
                    >
                      {isPausedRecording ? (
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={stopAndSaveRecording}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar Áudio</span>
                    </button>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleAddTextNote}
                className={`flex items-center gap-2 rounded-2xl border p-2 shadow-lg ${
                  lightMode
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition cursor-pointer"
                  title="Câmera"
                >
                  <Camera className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition cursor-pointer"
                  title="Adicionar Foto da Galeria"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={isRecording ? stopAndSaveRecording : startAudioRecording}
                  className={`p-2 rounded-xl transition cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60'
                  }`}
                  title={isRecording ? 'Parar e salvar áudio' : 'Gravar Áudio'}
                >
                  {isRecording ? (
                    <Square className="w-4 h-4 fill-white" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>

                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Escreva uma nota ou cole uma foto (Ctrl+V)..."
                  className="flex-1 bg-transparent px-2 py-1.5 text-sm focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => setMarkImportant((v) => !v)}
                  className={`p-2 rounded-xl transition cursor-pointer ${
                    markImportant
                      ? 'text-amber-400 bg-amber-500/15'
                      : 'text-slate-500 hover:text-amber-300'
                  }`}
                  title="Marcar como importante"
                >
                  <Star
                    className={`w-4 h-4 ${markImportant ? 'fill-amber-400' : ''}`}
                  />
                </button>

                <button
                  type="submit"
                  disabled={!noteText.trim()}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition cursor-pointer"
                  title="Enviar anotação"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Modal: New Course */}
      {showNewCourseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-400" />
                <span>Novo Curso / Formação</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCourseModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nome do Curso *
                </label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Ex: Medicina, Direito, Concurso Receita..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  placeholder="Ex: Graduação 2026 / Turno Noturno"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewCourseModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                >
                  Criar Curso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Subject (Directly linked to Course) */}
      {showNewSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Nova Matéria</h3>
              <button
                type="button"
                onClick={() => setShowNewSubjectModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Vincular ao Curso *
                </label>
                <select
                  value={newSubjCourseId || selectedCourseId || ''}
                  onChange={(e) => setNewSubjCourseId(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nome da Matéria *
                </label>
                <input
                  type="text"
                  required
                  value={newSubjName}
                  onChange={(e) => setNewSubjName(e.target.value)}
                  placeholder="Ex: Anatomia Humana, Direito Penal..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Cor de Identificação
                </label>
                <div className="flex items-center gap-2">
                  {SUBJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewSubjColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                        newSubjColor === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewSubjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                >
                  Criar Matéria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Topic / Aula */}
      {showNewTopicModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">
                Nova Aula em {currentSubject?.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowNewTopicModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTopic} className="space-y-4">
              <input
                type="text"
                required
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="Título da aula (ex: Aula 02 - Sistema Circulatório)..."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTopicModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                >
                  Criar Aula
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activePhotoItem && (
        <PhotoViewerModal
          item={activePhotoItem}
          onClose={() => setActivePhotoItem(null)}
          onSaveHighlights={handleSavePhotoHighlights}
        />
      )}

      {showCameraModal && (
        <CameraModal
          onClose={() => setShowCameraModal(false)}
          onCapture={(dataUrl, title, caption) => {
            addTimelineEntry({
              type: 'photo',
              title,
              content: caption,
              mediaDataUrl: dataUrl,
            });
          }}
        />
      )}

      {showCloudModal && (
        <FirebaseCloudModal
          user={firebaseUser}
          onClose={() => setShowCloudModal(false)}
          onSynced={reloadAllData}
        />
      )}

      {showFlashcardsModal && currentSubject && (
        <ExamFlashcardsModal
          items={subjectExamFlashcards}
          subjectName={currentSubject.name}
          accentColor={currentSubject.color}
          onClose={() => setShowFlashcardsModal(false)}
          onUpdateStatus={handleUpdateFlashcardStatus}
        />
      )}

      {showCarouselModal && currentSubject && (
        <BoardCarouselModal
          photoItems={currentTopicPhotos}
          allItems={allItems}
          subjectName={currentSubject.name}
          accentColor={currentSubject.color}
          onClose={() => setShowCarouselModal(false)}
        />
      )}
    </div>
  );
}
