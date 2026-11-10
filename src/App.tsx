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
  AlertTriangle,
  Sparkles,
  Smartphone,
  Bell,
  HelpCircle,
  Monitor,
  Puzzle,
  CheckCircle2,
  BookOpen,
  MessageCircle,
} from 'lucide-react';
import {
  dispatchStudyToWhatsApp,
  getStoredWhatsAppConfig,
  saveStoredWhatsAppConfig,
  formatPhoneForDisplay,
} from './services/whatsappService';
import {
  Course,
  Subject,
  StudyTopic,
  TimelineItem,
  TimelineItemType,
  PhotoHighlightStroke,
  StudyQuestion,
} from './types';
import {
  calculateSM2Review,
  getDueItemsForReview,
  SM2Rating,
} from './services/spacedRepetitionService';
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
  getAllQuestions,
  saveQuestion,
  saveQuestionsBatch,
  deleteQuestion,
  exportFullBackupJson,
  importFullBackupJson,
  saveMergedCloudData,
} from './services/storageService';
import { AudioPlayerCard } from './components/AudioPlayerCard';
import { PhotoViewerModal } from './components/PhotoViewerModal';
import { CameraModal } from './components/CameraModal';
import { ExamFlashcardsModal } from './components/ExamFlashcardsModal';
import { BoardCarouselModal } from './components/BoardCarouselModal';
import { TopicQuestionsView } from './components/TopicQuestionsView';
import { ExtensionPluginModal } from './components/ExtensionPluginModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { GlobalSearchView } from './components/GlobalSearchView';
import { StudyAiChatModal } from './components/StudyAiChatModal';
import { generateQuestionsFromTranscript } from './services/questionGeneratorService';
import {
  getCloudUser,
  syncWithCloud,
  CloudUser,
  checkCloudVersion,
  pullFromCloud,
  saveCloudSession,
} from './services/cloudSyncService';

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
  const [allQuestions, setAllQuestions] = useState<StudyQuestion[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // UI State
  const [lightMode, setLightMode] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeMainView, setActiveMainView] = useState<'timeline' | 'global_search'>('timeline');
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<
    'all' | TimelineItemType | 'exam' | 'questions'
  >('all');
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

  // Editing state for Course, Subject, Topic
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseDesc, setEditCourseDesc] = useState('');

  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjName, setEditSubjName] = useState('');
  const [editSubjCourseId, setEditSubjCourseId] = useState('');
  const [editSubjColor, setEditSubjColor] = useState(SUBJECT_COLORS[0]);

  const [editingTopic, setEditingTopic] = useState<StudyTopic | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState('');

  const [showNewSubjectModal, setShowNewSubjectModal] = useState(false);
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjCourseId, setNewSubjCourseId] = useState<string>('');
  const [newSubjColor, setNewSubjColor] = useState(SUBJECT_COLORS[0]);

  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');

  const [activePhotoItem, setActivePhotoItem] = useState<TimelineItem | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showAiChatModal, setShowAiChatModal] = useState(false);
  const [showFlashcardsModal, setShowFlashcardsModal] = useState(false);
  const [showCarouselModal, setShowCarouselModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [isExtensionDetected, setIsExtensionDetected] = useState(false);

  // Native In-Browser Screen Share & Capture
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isCapturingScreen, setIsCapturingScreen] = useState(false);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Discreet Toast Notification
  const [toastInfo, setToastInfo] = useState<{
    message: string;
    type?: 'success' | 'info';
    timestamp: number;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToastInfo({ message, type, timestamp: Date.now() });
  };

  useEffect(() => {
    if (toastInfo) {
      const timer = setTimeout(() => setToastInfo(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastInfo]);

  // NoteOn Cloud Sync States (Cloudflare Pages Functions + Upstash Redis)
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(getCloudUser());
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<number | null>(null);
  const lastSyncedTimeRef = useRef<number | null>(null);
  const isInitialLoadedRef = useRef(false);
  const autoSyncTimeoutRef = useRef<any>(null);

  // 1-Click Device Pairing from URL (ex: abrindo pelo link gerado no PC para o celular)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const syncToken = urlParams.get('sync_token');
      const syncEmail = urlParams.get('sync_email');
      const syncUserId = urlParams.get('sync_userid');

      if (syncToken && syncEmail && syncUserId) {
        const pairedUser: CloudUser = { userId: syncUserId, email: syncEmail };
        saveCloudSession(pairedUser, syncToken);
        setCloudUser(pairedUser);
        showToast(`📱 Aparelho sincronizado com ${syncEmail}!`, 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (_) {}
  }, []);

  const handlePerformCloudSync = async (silent = false) => {
    if (!cloudUser || !isInitialLoadedRef.current) return;
    setIsSyncingCloud(true);
    try {
      const res = await syncWithCloud({
        courses,
        subjects,
        topics,
        items: allItems,
        questions: allQuestions,
      });

      if (res && res.data) {
        await saveMergedCloudData(res.data);
        setCourses(res.data.courses || []);
        setSubjects(res.data.subjects || []);
        setTopics(res.data.topics || []);
        setAllItems(res.data.items || []);
        setAllQuestions(res.data.questions || []);

        const syncedAt = res.data.lastSyncedAt || Date.now();
        lastSyncedTimeRef.current = syncedAt;
        setLastSyncedTime(syncedAt);

        if (!silent) {
          showToast('☁️ NoteOn sincronizado com a nuvem!');
        }
      }
    } catch (err: any) {
      console.warn('Erro ao sincronizar com a nuvem:', err);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Push Automático de Alta Velocidade (Debounce de 700ms após qualquer alteração no PC ou celular)
  useEffect(() => {
    if (!cloudUser || !isInitialLoadedRef.current) return;

    if (autoSyncTimeoutRef.current) {
      clearTimeout(autoSyncTimeoutRef.current);
    }

    autoSyncTimeoutRef.current = setTimeout(() => {
      handlePerformCloudSync(true);
    }, 700);

    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
    };
  }, [courses, subjects, topics, allItems, allQuestions, cloudUser]);

  // Polling em Background Assíncrono Contínuo (Realtime Sync PC ↔ Celular a cada 3.5 segundos)
  useEffect(() => {
    if (!cloudUser) return;

    let isPolling = false;
    const interval = setInterval(async () => {
      if (isPolling || isSyncingCloud || !isInitialLoadedRef.current) return;
      isPolling = true;
      try {
        const { serverLastSyncedAt } = await checkCloudVersion();
        const localLast = lastSyncedTimeRef.current || 0;

        // Se o servidor tiver versão mais recente que o último sync local
        if (serverLastSyncedAt && serverLastSyncedAt > localLast + 500) {
          const freshData = await pullFromCloud();
          if (freshData) {
            await saveMergedCloudData(freshData);
            setCourses(freshData.courses || []);
            setSubjects(freshData.subjects || []);
            setTopics(freshData.topics || []);
            setAllItems(freshData.items || []);
            setAllQuestions(freshData.questions || []);

            const newTime = freshData.lastSyncedAt || serverLastSyncedAt;
            lastSyncedTimeRef.current = newTime;
            setLastSyncedTime(newTime);
          }
        }
      } catch (_) {
        // Silencioso em caso de oscilação momentânea
      } finally {
        isPolling = false;
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [cloudUser, isSyncingCloud]);

  // Sincroniza imediatamente ao abrir/focar a janela ou desbloquear a tela do celular
  useEffect(() => {
    const onFocus = () => {
      if (cloudUser && isInitialLoadedRef.current) {
        handlePerformCloudSync(true);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cloudUser && isInitialLoadedRef.current) {
        handlePerformCloudSync(true);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [cloudUser]);

  // Navegar a partir da Pesquisa Global diretamente para a aula e focar no item
  const handleNavigateFromGlobalSearch = (
    courseId: string | undefined,
    subjectId: string,
    topicId: string,
    itemId?: string
  ) => {
    if (courseId) {
      setSelectedCourseId(courseId);
    }
    setSelectedSubjectId(subjectId);
    setSelectedTopicId(topicId);
    setActiveMainView('timeline');
    if (itemId) {
      setHighlightItemId(itemId);
      setTimeout(() => {
        const el = document.getElementById(`timeline-card-${itemId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
      setTimeout(() => setHighlightItemId(null), 3500);
    }
  };

  // Custom In-App Confirmation Modal (Replaces browser confirm() dialog)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const requestConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmText = 'Excluir'
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm,
    });
  };

  // PWA Install & Notifications
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [reviewOnlyDueCards, setReviewOnlyDueCards] = useState(false);

  useEffect(() => {
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!isStandaloneMode) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) {
      alert(
        'Para instalar no iPhone/iPad: Toque no botão Compartilhar do Safari e selecione "Adicionar à Tela de Início".'
      );
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setInstallPrompt(null);
  };

  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      new Notification('NoteOn — Lembretes Ativados! 🔔', {
        body: 'Você receberá avisos quando houver flashcards pendentes de revisão.',
        icon: '/favicon.svg',
      });
    }
  };

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
    const [crs, subjs, tps, itms, qsts] = await Promise.all([
      getAllCourses(),
      getAllSubjects(),
      getAllTopics(),
      getAllItems(),
      getAllQuestions(),
    ]);
    setCourses(crs);
    setSubjects(subjs);
    setTopics(tps);
    setAllItems(itms);
    setAllQuestions(qsts);

    setSelectedCourseId((prev) =>
      prev && crs.some((c) => c.id === prev) ? prev : crs[0]?.id || null
    );

    isInitialLoadedRef.current = true;

    // Sincronização inicial com a nuvem ao carregar a página
    if (cloudUser) {
      try {
        const res = await syncWithCloud({
          courses: crs,
          subjects: subjs,
          topics: tps,
          items: itms,
          questions: qsts,
        });

        if (res && res.data) {
          await saveMergedCloudData(res.data);
          setCourses(res.data.courses || []);
          setSubjects(res.data.subjects || []);
          setTopics(res.data.topics || []);
          setAllItems(res.data.items || []);
          setAllQuestions(res.data.questions || []);
          setLastSyncedTime(Date.now());
        }
      } catch (err: any) {
        console.warn('Falha no sync inicial com nuvem:', err);
      }
    }
  };

  useEffect(() => {
    reloadAllData();
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
    } else if (filterType !== 'all' && filterType !== 'questions') {
      base = base.filter((i) => i.type === filterType);
    }

    return base;
  }, [allItems, currentTopicItems, filterType, globalSearch]);

  // Questions Memoized for Current Topic
  const currentTopicQuestions = useMemo(() => {
    return allQuestions
      .filter((q) => q.topicId === selectedTopicId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [allQuestions, selectedTopicId]);

  const topicAudiosWithTranscript = useMemo(() => {
    return currentTopicItems.filter(
      (i) => i.type === 'audio' && i.transcript && i.transcript.trim().length > 15
    );
  }, [currentTopicItems]);

  const generateQuestionsAndSave = async (params: {
    transcript: string;
    topicTitle: string;
    subjectName: string;
    audioItemId?: string;
    topicId: string;
    subjectId: string;
    courseId?: string;
  }) => {
    setIsGeneratingQuestions(true);
    try {
      const generated = await generateQuestionsFromTranscript(params);
      if (generated && generated.length > 0) {
        await saveQuestionsBatch(generated);
        setAllQuestions((prev) => [...prev, ...generated]);
        return generated;
      }
    } catch (err: any) {
      console.warn('Erro ao gerar questões:', err);
    } finally {
      setIsGeneratingQuestions(false);
    }
    return [];
  };

  const handleGenerateQuestionsForCurrentTopic = async () => {
    if (!selectedTopicId || !selectedSubjectId) return;
    const audios = topicAudiosWithTranscript;
    if (audios.length === 0) return;

    const combinedTranscript = audios.map((a) => a.transcript).join('\n\n');
    const questions = await generateQuestionsAndSave({
      transcript: combinedTranscript,
      topicTitle: currentTopic?.title || 'Aula',
      subjectName: currentSubject?.name || 'Disciplina',
      topicId: selectedTopicId,
      subjectId: selectedSubjectId,
      courseId: selectedCourseId || undefined,
    });
    if (questions.length > 0) {
      setFilterType('questions');
    }
  };

  const handleGenerateQuestionsForSingleAudio = async (item: TimelineItem) => {
    if (!item.transcript) return;
    const questions = await generateQuestionsAndSave({
      transcript: item.transcript,
      topicTitle: currentTopic?.title || 'Aula',
      subjectName: currentSubject?.name || 'Disciplina',
      audioItemId: item.id,
      topicId: item.topicId,
      subjectId: item.subjectId,
      courseId: item.courseId,
    });
    if (questions.length > 0) {
      setFilterType('questions');
    }
  };

  const handleUpdateQuestion = async (updated: StudyQuestion) => {
    setAllQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    await saveQuestion(updated);
  };

  const handleDeleteQuestion = (questionId: string) => {
    requestConfirm('Excluir Questão', 'Deseja realmente excluir esta questão de estudo?', async () => {
      setAllQuestions((prev) => prev.filter((q) => q.id !== questionId));
      await deleteQuestion(questionId);
    });
  };

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
    topicIdOverride?: string;
    subjectIdOverride?: string;
    courseIdOverride?: string;
    type: TimelineItemType;
    title?: string;
    content: string;
    transcript?: string;
    mediaDataUrl?: string;
    audioDurationSeconds?: number;
    audioWaveform?: number[];
    customTimestampMs?: number;
  }) => {
    const targetTopicId = params.topicIdOverride || selectedTopicId;
    const targetSubjectId = params.subjectIdOverride || selectedSubjectId;
    if (!targetSubjectId || !targetTopicId) return;

    const targetCourseId =
      params.courseIdOverride ||
      selectedCourseId ||
      subjects.find((s) => s.id === targetSubjectId)?.courseId ||
      undefined;

    const nowMs = params.customTimestampMs || Date.now();
    const dateObj = new Date(nowMs);
    const timeLabel = dateObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const dateLabel = dateObj.toLocaleDateString('pt-BR');

    const topicItems = allItems.filter((it) => it.topicId === targetTopicId);
    const maxOrder = topicItems.reduce(
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
      topicId: targetTopicId,
      subjectId: targetSubjectId,
      courseId: targetCourseId,
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

  // Screen Share & Snapshot Capture Functions
  const handleStartScreenShare = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        showToast('Seu navegador não suporta compartilhamento direto. Use a Extensão NoteOn!', 'info');
        setShowExtensionModal(true);
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      setScreenStream(stream);
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          setScreenStream(null);
        };
      }
      showToast('🖥️ Tela conectada! Você pode tirar prints com 1 clique ou Alt+S.');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn('Erro ao compartilhar tela:', err);
      }
    }
  };

  const handleStopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
  };

  const handleCaptureScreenSnapshot = async () => {
    const video = screenVideoRef.current;
    if (!video || !screenStream || video.videoWidth === 0) {
      handleStartScreenShare();
      return;
    }
    setIsCapturingScreen(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        await addTimelineEntry({
          type: 'photo',
          title: 'Print da Tela / Slide',
          content: '',
          mediaDataUrl: dataUrl,
        });
        showToast(
          isRecording
            ? `📸 Print capturado e salvo em ${formatDuration(recordingSeconds)} do áudio!`
            : '📸 Print da tela salvo na aula!'
        );
      }
    } catch (err) {
      console.error('Erro ao capturar frame da tela:', err);
    } finally {
      setIsCapturingScreen(false);
    }
  };

  // Browser Extension & Alt + S Listener
  useEffect(() => {
    const handleExtensionMessage = async (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'NOTEON_EXTENSION') return;

      const resolveTargetTopic = async (): Promise<{ topicId: string; subjectId: string }> => {
        if (selectedTopicId && selectedSubjectId) {
          return { topicId: selectedTopicId, subjectId: selectedSubjectId };
        }

        // 1. Tópicos já no estado React
        if (topics && topics.length > 0) {
          const found = topics[0];
          setSelectedTopicId(found.id);
          setSelectedSubjectId(found.subjectId);
          return { topicId: found.id, subjectId: found.subjectId };
        }

        // 2. Tópicos salvos no IndexedDB
        try {
          const dbTopics = await getAllTopics();
          if (dbTopics && dbTopics.length > 0) {
            const found = dbTopics[0];
            setTopics(dbTopics);
            setSelectedTopicId(found.id);
            setSelectedSubjectId(found.subjectId);
            return { topicId: found.id, subjectId: found.subjectId };
          }
        } catch (_) {}

        // 3. Matérias disponíveis
        let dbSubjects: Subject[] = subjects;
        if (!dbSubjects || dbSubjects.length === 0) {
          try {
            dbSubjects = await getAllSubjects();
          } catch (_) {}
        }

        let courseId = selectedCourseId;
        if (!courseId) {
          try {
            const dbCourses = courses.length > 0 ? courses : await getAllCourses();
            if (dbCourses && dbCourses.length > 0) {
              courseId = dbCourses[0].id;
              setSelectedCourseId(courseId);
            } else {
              courseId = 'course-default';
            }
          } catch (_) {
            courseId = 'course-default';
          }
        }

        const now = Date.now();
        let targetSubj: Subject;
        if (dbSubjects && dbSubjects.length > 0) {
          targetSubj = dbSubjects[0];
        } else {
          targetSubj = {
            id: `subj-ext-${now}`,
            courseId: courseId || 'course-default',
            name: 'Aulas & Gravações',
            color: '#6366f1',
            icon: 'BookOpen',
            createdAt: now,
            updatedAt: now,
          };
          await saveSubject(targetSubj);
          setSubjects((prev) => [targetSubj, ...prev]);
        }

        // Criar tópico para receber gravações e prints
        const targetTop: StudyTopic = {
          id: `topic-ext-${now}`,
          courseId: targetSubj.courseId,
          subjectId: targetSubj.id,
          title: 'Gravações da Extensão',
          date: new Date().toISOString().slice(0, 10),
          startTime: new Date().toLocaleTimeString('pt-BR'),
          studyDurationSeconds: 0,
          createdAt: now,
          updatedAt: now,
        };
        await saveTopic(targetTop);
        setTopics((prev) => [targetTop, ...prev]);
        setSelectedSubjectId(targetSubj.id);
        setSelectedTopicId(targetTop.id);

        return { topicId: targetTop.id, subjectId: targetSubj.id };
      };

      if (event.data.type === 'EXTENSION_READY') {
        setIsExtensionDetected(true);
      } else if (event.data.type === 'SCREENSHOT_CAPTURED' && event.data.dataUrl) {
        setIsExtensionDetected(true);
        const { topicId: targetTopicId, subjectId: targetSubjectId } = await resolveTargetTopic();

        const titleText = event.data.pageTitle
          ? `Print: ${event.data.pageTitle.slice(0, 50)}`
          : 'Print do Slide (Plugin)';

        await addTimelineEntry({
          topicIdOverride: targetTopicId,
          subjectIdOverride: targetSubjectId,
          type: 'photo',
          title: titleText,
          content: '',
          mediaDataUrl: event.data.dataUrl,
        });

        showToast(
          isRecording
            ? `📸 Print recebido do Plugin e salvo em ${formatDuration(recordingSeconds)} do áudio!`
            : '📸 Print recebido do Plugin e salvo na aula!'
        );
      } else if (
        (event.data.type === 'AUDIO_RECORDED' || event.data.type === 'AUDIO_CAPTURED') &&
        event.data.dataUrl
      ) {
        setIsExtensionDetected(true);
        const { topicId: targetTopicId, subjectId: targetSubjectId } = await resolveTargetTopic();

        const plannedId = `rec-${Date.now()}`;
        const finalDuration = Math.max(1, Math.round(event.data.duration || 10));
        const transcriptToSave = (event.data.transcript || '').trim();
        const titleText = event.data.pageTitle
          ? `Áudio: ${event.data.pageTitle.slice(0, 50)}`
          : 'Gravação da Extensão';

        const sampledBars = Array.from({ length: 28 }, () =>
          Number((0.3 + Math.random() * 0.55).toFixed(2))
        );

        await addTimelineEntry({
          idOverride: plannedId,
          topicIdOverride: targetTopicId,
          subjectIdOverride: targetSubjectId,
          type: 'audio',
          title: titleText,
          content: '',
          transcript: transcriptToSave,
          mediaDataUrl: event.data.dataUrl,
          audioDurationSeconds: finalDuration,
          audioWaveform: sampledBars,
        });

        showToast(
          `🎙️ Áudio recebido da Extensão (${formatDuration(finalDuration)}) e salvo na aula!`,
          'success'
        );

        // Auto-generate questions if speech transcript is rich
        if (transcriptToSave && transcriptToSave.length > 15) {
          generateQuestionsAndSave({
            transcript: transcriptToSave,
            topicTitle: currentTopic?.title || 'Aula',
            subjectName: currentSubject?.name || 'Disciplina',
            audioItemId: plannedId,
            topicId: targetTopicId,
            subjectId: targetSubjectId,
            courseId: selectedCourseId || undefined,
          });
        }
      }
    };

    window.addEventListener('message', handleExtensionMessage);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (screenStream) {
          handleCaptureScreenSnapshot();
        } else {
          handleStartScreenShare();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('message', handleExtensionMessage);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTopicId, selectedSubjectId, topics, isRecording, recordingSeconds, screenStream]);

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

        // Auto-generate questions on the fly from the teacher speech transcription!
        if (
          transcriptToSave &&
          transcriptToSave.trim().length > 15 &&
          selectedTopicId &&
          selectedSubjectId
        ) {
          generateQuestionsAndSave({
            transcript: transcriptToSave.trim(),
            topicTitle: currentTopic?.title || 'Aula',
            subjectName: currentSubject?.name || 'Disciplina',
            audioItemId: plannedId,
            topicId: selectedTopicId,
            subjectId: selectedSubjectId,
            courseId: selectedCourseId || undefined,
          });
        }
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

  const handleSM2Grade = async (itemId: string, rating: SM2Rating) => {
    const target = allItems.find((i) => i.id === itemId);
    if (!target) return;
    const sm2Updates = calculateSM2Review(target, rating);
    const updated: TimelineItem = { ...target, ...sm2Updates };
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

  const handleDeleteItem = (itemId: string) => {
    setOpenCardMenuId(null);
    requestConfirm(
      'Excluir Item',
      'Tem certeza que deseja remover este item da linha do tempo?',
      async () => {
        setAllItems((prev) => prev.filter((i) => i.id !== itemId));
        await deleteTimelineItem(itemId);
      },
      'Excluir Item'
    );
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

  // Update Existing Course
  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !editCourseName.trim()) return;
    const updated: Course = {
      ...editingCourse,
      name: editCourseName.trim(),
      description: editCourseDesc.trim() || undefined,
      updatedAt: Date.now(),
    };
    await saveCourse(updated);
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditingCourse(null);
  };

  // Update Existing Subject
  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editSubjName.trim()) return;
    const updated: Subject = {
      ...editingSubject,
      name: editSubjName.trim(),
      courseId: editSubjCourseId || editingSubject.courseId,
      color: editSubjColor,
      updatedAt: Date.now(),
    };
    await saveSubject(updated);
    setSubjects((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setEditingSubject(null);
  };

  // Update Existing Topic / Lesson
  const handleUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic || !editTopicTitle.trim()) return;
    const updated: StudyTopic = {
      ...editingTopic,
      title: editTopicTitle.trim(),
      updatedAt: Date.now(),
    };
    await saveTopic(updated);
    setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingTopic(null);
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

  const handleSendLessonToWhatsApp = async () => {
    setShowHeaderMenu(false);
    if (!currentTopic || !currentSubject) return;

    const audios = currentTopicItems.filter((i) => i.type === 'audio');
    const photos = currentTopicItems.filter((i) => i.type === 'photo');
    const examItems = currentTopicItems.filter((i) => i.importantForExam);

    const lines: string[] = [];
    lines.push(`Resumo da aula: *${currentTopic.title}*`);
    lines.push(`Disciplina: *${currentSubject.name}*`);
    if (currentCourse) lines.push(`Curso: *${currentCourse.name}*`);
    lines.push('');
    lines.push(`📊 *Estatísticas:*`);
    lines.push(`• ${audios.length} gravações de áudio`);
    lines.push(`• ${photos.length} fotos de lousa/slides`);
    lines.push(`• ${examItems.length} marcações de "Cai na Prova"`);
    lines.push('');

    if (examItems.length > 0) {
      lines.push('🎯 *Pontos Críticos para a Prova:*');
      examItems.slice(0, 5).forEach((item, idx) => {
        const desc = item.title || item.transcript?.slice(0, 100) || item.content || 'Ponto importante';
        lines.push(`${idx + 1}. ${desc}`);
      });
      lines.push('');
    }

    if (audios.some((a) => a.transcript)) {
      lines.push('🎙️ *Trechos Principais dos Áudios:*');
      audios
        .filter((a) => a.transcript)
        .slice(0, 3)
        .forEach((a) => {
          lines.push(`• "${a.transcript?.slice(0, 140)}..."`);
        });
      lines.push('');
    }

    const content = lines.join('\n');

    const config = getStoredWhatsAppConfig();
    if (!config.phone && !config.webhookUrl) {
      setShowAiChatModal(true);
      showToast('Configure seu número de WhatsApp no Tutor IA para envio!', 'info');
      return;
    }

    const res = await dispatchStudyToWhatsApp({
      topicTitle: currentTopic.title,
      subjectName: currentSubject.name,
      courseName: currentCourse?.name,
      content,
      audioCount: audios.length,
      photoCount: photos.length,
      questionsCount: currentTopicQuestions.length,
    });

    if (res.success) {
      showToast(res.message || 'Resumo enviado para o WhatsApp!', 'success');
    } else {
      showToast('Informe seu número de WhatsApp nas configurações.', 'info');
      setShowAiChatModal(true);
    }
  };

  const handleEditWhatsAppNumber = () => {
    setShowHeaderMenu(false);
    const config = getStoredWhatsAppConfig();
    const current = config.phone ? formatPhoneForDisplay(config.phone) : '';
    const newNumber = window.prompt(
      'Digite seu número de WhatsApp com DDD (ex: 11 99999-8888):',
      current
    );
    if (newNumber !== null) {
      saveStoredWhatsAppConfig({ phone: newNumber.trim() });
      showToast('Número de WhatsApp salvo com sucesso!', 'success');
    }
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

  const allDueCards = useMemo(() => getDueItemsForReview(allItems), [allItems]);
  const subjectDueCards = useMemo(
    () => getDueItemsForReview(allItems, selectedSubjectId),
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

        <div className="flex items-center gap-1.5 shrink-0">
          {subjectDueCards.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setReviewOnlyDueCards(true);
                setShowFlashcardsModal(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1 cursor-pointer animate-pulse"
              title="Cards agendados para hoje"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hoje ({subjectDueCards.length})</span>
            </button>
          )}
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
            className={`p-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition ${
              cloudUser
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title={
              cloudUser
                ? `Nuvem Conectada (${cloudUser.email}) - Clique para sincronizar`
                : 'Sincronizar Celular e PC (NoteOn Cloud)'
            }
          >
            <Cloud className={`w-4 h-4 ${isSyncingCloud ? 'animate-spin text-cyan-300' : ''}`} />
            {cloudUser && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          </button>
        </div>
      </header>

      {/* PWA Install Banner */}
      {showInstallBanner && !isStandalone && (
        <div className="bg-indigo-600 px-4 py-2.5 text-white flex items-center justify-between gap-3 text-xs shadow-md sticky top-12 z-30">
          <div className="flex items-center gap-2 truncate">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span className="truncate font-medium">Instale o NoteOn no celular para usar offline!</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInstallPwa}
              className="px-3 py-1 bg-white text-indigo-700 font-bold rounded-lg cursor-pointer hover:bg-slate-100 transition shadow-xs"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={() => setShowInstallBanner(false)}
              className="p-1 text-white/80 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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

        {/* Primary View Switcher: Minhas Aulas vs Pesquisa Global */}
        <div className="p-2.5 border-b border-slate-800/60 bg-slate-950/20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveMainView('timeline');
              setMobileSidebarOpen(false);
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeMainView === 'timeline'
                ? 'bg-indigo-600 text-white shadow-sm'
                : lightMode
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Aulas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMainView('global_search');
              setMobileSidebarOpen(false);
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeMainView === 'global_search'
                ? 'bg-indigo-600 text-white shadow-sm'
                : lightMode
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Pesquisa Global</span>
          </button>
        </div>

        {/* Tutor IA Fast Access Button */}
        <div className="px-2.5 pb-2 border-b border-slate-800/60 bg-slate-950/20">
          <button
            type="button"
            onClick={() => {
              setShowAiChatModal(true);
              setMobileSidebarOpen(false);
            }}
            className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600/20 via-purple-600/25 to-indigo-600/20 hover:from-indigo-600/35 hover:to-purple-600/35 border border-indigo-500/30 text-indigo-200 text-xs font-semibold flex items-center justify-between transition cursor-pointer shadow-xs"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Tutor IA da Aula</span>
            </span>
            <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded-md font-bold">
              Multi-API
            </span>
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
                          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCourse(crs);
                                setEditCourseName(crs.name);
                                setEditCourseDesc(crs.description || '');
                                setShowCourseDropdown(false);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-400 cursor-pointer"
                              title="Editar Curso"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCourseDropdown(false);
                                requestConfirm(
                                  'Excluir Curso',
                                  `Excluir o curso "${crs.name}" e todas as suas matérias e aulas vinculadas? Esta ação é irreversível.`,
                                  () => deleteCourseAndChildren(crs.id).then(reloadAllData),
                                  'Excluir Curso'
                                );
                              }}
                              className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                              title="Excluir Curso"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSubject(subj);
                            setEditSubjName(subj.name);
                            setEditSubjCourseId(subj.courseId);
                            setEditSubjColor(subj.color || SUBJECT_COLORS[0]);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-400 cursor-pointer"
                          title="Editar Matéria"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestConfirm(
                              'Excluir Matéria',
                              `Excluir a matéria "${subj.name}" e todas as suas aulas vinculadas?`,
                              () => deleteSubjectAndChildren(subj.id).then(reloadAllData),
                              'Excluir Matéria'
                            );
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="Excluir Matéria"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
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
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium truncate flex-1">{tp.title}</span>
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTopic(tp);
                              setEditTopicTitle(tp.title);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-400 shrink-0 cursor-pointer"
                            title="Editar Aula"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestConfirm(
                                'Excluir Aula',
                                `Excluir "${tp.title}" e todos os itens salvos nesta aula?`,
                                () => deleteTopicAndItems(tp.id).then(reloadAllData),
                                'Excluir Aula'
                              );
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 shrink-0 cursor-pointer"
                            title="Excluir Aula"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
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
              cloudUser
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : lightMode
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Cloud className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">
                {cloudUser ? cloudUser.email : 'Sincronizar Celular / PC'}
              </span>
            </span>
            {cloudUser && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {activeMainView === 'global_search' ? (
          <GlobalSearchView
            lightMode={lightMode}
            courses={courses}
            subjects={subjects}
            topics={topics}
            items={allItems}
            questions={allQuestions}
            onNavigateToItem={handleNavigateFromGlobalSearch}
            onNavigateToTopic={(cId, sId, tId) => handleNavigateFromGlobalSearch(cId, sId, tId)}
            onOpenPhotoViewer={(item) => setActivePhotoItem(item)}
            onCloseSearch={() => setActiveMainView('timeline')}
          />
        ) : (
          <>
            {/* Clean Header: Course › Subject › Lesson */}
        {currentTopic && currentSubject && (
          <div
            className={`px-3.5 sm:px-6 md:px-8 py-2.5 sm:py-3.5 border-b shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-4 ${
              lightMode
                ? 'bg-white border-slate-200'
                : 'bg-slate-950/90 border-slate-800/80'
            }`}
          >
            {/* Breadcrumb Hierarchy */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 overflow-x-auto no-scrollbar whitespace-nowrap py-0.5">
                <span className="text-slate-300 font-semibold truncate max-w-[120px] sm:max-w-none">
                  {currentCourse?.name || 'Curso'}
                </span>
                <span>›</span>
                <span
                  style={{ color: currentSubject.color }}
                  className="font-medium truncate max-w-[140px] sm:max-w-none"
                >
                  {currentSubject.name}
                </span>
                <span>›</span>
                <span className="font-mono text-[11px] shrink-0">
                  {currentTopic.date.split('-').reverse().join('/')} às{' '}
                  {currentTopic.startTime.slice(0, 5)}
                </span>
              </div>
              <h2 className="text-base md:text-lg font-bold tracking-tight truncate mt-0.5 flex items-center gap-2">
                <span className="truncate">{currentTopic.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTopic(currentTopic);
                    setEditTopicTitle(currentTopic.title);
                  }}
                  className="text-slate-500 hover:text-indigo-400 cursor-pointer p-1 rounded transition shrink-0"
                  title="Editar Título da Aula"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </h2>
            </div>

            {/* Right: Clean Filter Tabs (touch swipeable on mobile) + Options Menu */}
            <div className="flex items-center gap-2 max-w-full min-w-0">
              <div
                className={`flex items-center p-1 rounded-xl border text-xs overflow-x-auto no-scrollbar shrink min-w-0 ${
                  lightMode
                    ? 'bg-slate-100 border-slate-200'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
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
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
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
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
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
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0 ${
                    filterType === 'exam'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <Star className="w-3 h-3" />
                  <span>Importantes</span> ({stats.exams})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('questions')}
                  className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                    filterType === 'questions'
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : currentTopicQuestions.length > 0
                      ? 'text-purple-300 hover:text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 ring-1 ring-purple-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Questões de fixação geradas da transcrição da aula"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Questões</span>
                  <span
                    className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                      filterType === 'questions'
                        ? 'bg-purple-800 text-white'
                        : currentTopicQuestions.length > 0
                        ? 'bg-purple-500/40 text-purple-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {currentTopicQuestions.length}
                  </span>
                </button>
              </div>

              {/* SM-2 Spaced Repetition Due Today Action */}
              {subjectDueCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setReviewOnlyDueCards(true);
                    setShowFlashcardsModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 animate-pulse shadow-sm"
                  title="Flashcards agendados pelo algoritmo SM-2 para hoje"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Revisões Hoje ({subjectDueCards.length})</span>
                </button>
              )}

              {/* Cloud Sync Status Indicator Pill */}
              <button
                type="button"
                onClick={() => setShowCloudModal(true)}
                title={
                  cloudUser
                    ? `Sincronização ativa: ${cloudUser.email}`
                    : 'Nuvem desconectada. Clique para sincronizar celular e PC.'
                }
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer shrink-0 ${
                  !cloudUser
                    ? 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    : isSyncingCloud
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <Cloud
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isSyncingCloud
                      ? 'animate-spin text-amber-400'
                      : cloudUser
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                  }`}
                />
                <span className="hidden lg:inline">
                  {!cloudUser
                    ? 'Nuvem'
                    : isSyncingCloud
                    ? 'Sincronizando...'
                    : 'Salvo na Nuvem'}
                </span>
              </button>

              {/* Tutor IA Button in Header */}
              <button
                type="button"
                onClick={() => setShowAiChatModal(true)}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/25 cursor-pointer transition shrink-0"
                title="Abrir Tutor IA de Estudos (Multi-Modelos: Gemini, Groq, DeepSeek, OpenAI)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span className="hidden sm:inline">Tutor IA</span>
              </button>

              {/* Options Menu */}
              <div className="relative shrink-0">
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
                        onClick={handleSendLessonToWhatsApp}
                        className="w-full px-3.5 py-2 text-left hover:bg-emerald-600/15 text-emerald-400 flex items-center gap-2.5 cursor-pointer font-medium"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        <span>Mandar Resumo pro WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleEditWhatsAppNumber}
                        className="w-full px-3.5 py-2 text-left hover:bg-slate-800 text-slate-300 hover:text-emerald-300 flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Smartphone className="w-4 h-4 text-emerald-400" />
                          <span>Editar Número do WhatsApp</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {getStoredWhatsAppConfig().phone ? formatPhoneForDisplay(getStoredWhatsAppConfig().phone) : 'Não definido'}
                        </span>
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
                          setShowHeaderMenu(false);
                          handleInstallPwa();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer text-indigo-400 font-medium"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>{isStandalone ? 'App Instalado (PWA)' : 'Instalar NoteOn no Celular'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(false);
                          handleRequestNotifications();
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer text-amber-400 font-medium"
                      >
                        <Bell className="w-4 h-4" />
                        <span>
                          {notificationPermission === 'granted'
                            ? 'Lembretes Ativados 🔔'
                            : 'Ativar Lembretes de Estudo'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowHeaderMenu(false);
                          setShowExtensionModal(true);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-indigo-600/15 flex items-center gap-2.5 cursor-pointer text-purple-400 font-medium"
                      >
                        <Puzzle className="w-4 h-4" />
                        <span>Plugin do Navegador (Alt + S)</span>
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

        {/* Chronological Timeline or Topic Questions View */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6">
          <div className="max-w-3xl mx-auto">
            {/* Prominent Questions Banner when questions exist and user is in another tab */}
            {currentTopicQuestions.length > 0 && filterType !== 'questions' && (
              <div
                onClick={() => setFilterType('questions')}
                className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-purple-950/40 via-purple-900/30 to-indigo-950/40 border border-purple-800/50 hover:border-purple-600/80 transition cursor-pointer flex items-center justify-between gap-3 group shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-300 group-hover:scale-105 transition">
                    <HelpCircle className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-purple-200">
                      Esta aula possui {currentTopicQuestions.length}{' '}
                      {currentTopicQuestions.length === 1
                        ? 'questão gerada'
                        : 'questões geradas'}{' '}
                      da fala do professor!
                    </p>
                    <p className="text-[11px] text-purple-400/80">
                      Clique para testar e fixar o conteúdo agora
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium shrink-0 transition shadow">
                  Ver Questões →
                </span>
              </div>
            )}

            {filterType === 'questions' ? (
              <TopicQuestionsView
                questions={currentTopicQuestions}
                topicTitle={currentTopic?.title || 'Aula'}
                subjectName={currentSubject?.name || 'Disciplina'}
                lightMode={lightMode}
                isGenerating={isGeneratingQuestions}
                hasAudioTranscripts={topicAudiosWithTranscript.length > 0}
                onGenerateFromAudios={handleGenerateQuestionsForCurrentTopic}
                onUpdateQuestion={handleUpdateQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                onJumpToAudio={(audioId) => {
                  setFilterType('all');
                  setTimeout(() => {
                    const el = document.getElementById(`timeline-card-${audioId}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 150);
                }}
              />
            ) : filteredTimelineItems.length === 0 ? (
              <div
                className={`rounded-2xl border border-dashed p-8 sm:p-12 text-center my-6 sm:my-8 ${
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
              <div className="space-y-3 sm:space-y-4">
                {filteredTimelineItems.map((item, idx) => {
                  const isEditing = editingItemId === item.id;
                  const isMenuOpen = openCardMenuId === item.id;

                  return (
                    <div
                      key={item.id}
                      id={`timeline-card-${item.id}`}
                      className="flex md:gap-4 items-start group w-full"
                    >
                      {/* Left Column: Chronological Timestamp (Desktop only) */}
                      <div className="hidden md:block w-16 md:w-20 shrink-0 pt-3 text-right select-none">
                        <div className="font-mono text-xs font-semibold text-indigo-400">
                          {item.timeLabel}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          #{String(idx + 1).padStart(2, '0')}
                        </div>
                      </div>

                      {/* Vertical Timeline Line + Dot (Desktop only) */}
                      <div className="hidden md:flex flex-col items-center self-stretch pt-4">
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

                      {/* Right Column / Full Mobile Card */}
                      <div
                        className={`w-full flex-1 min-w-0 rounded-xl sm:rounded-2xl border p-3.5 sm:p-4 transition ${
                          highlightItemId === item.id
                            ? 'ring-2 ring-indigo-500 shadow-xl shadow-indigo-500/30 animate-pulse'
                            : ''
                        } ${
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
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            {/* Mobile Timestamp Badge */}
                            <div className="md:hidden flex items-center gap-1.5 shrink-0">
                              <span className="font-mono text-[11px] font-bold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                                #{String(idx + 1).padStart(2, '0')} • {item.timeLabel}
                              </span>
                            </div>

                            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 truncate">
                              {item.type === 'photo' ? (
                                <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              ) : item.type === 'audio' ? (
                                <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              )}
                              <span className="truncate">
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
                                className="px-2 py-0.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[11px] font-mono flex items-center gap-1 transition cursor-pointer shrink-0"
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
                              className={`p-1.5 sm:p-1 rounded-lg transition cursor-pointer ${
                                item.importantForExam
                                  ? 'text-amber-400'
                                  : 'text-slate-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-amber-300'
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
                                className="p-1.5 sm:p-1 rounded-lg text-slate-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-slate-200 transition cursor-pointer"
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
                              onGenerateQuestions={
                                item.transcript && item.transcript.trim().length > 15
                                  ? () => handleGenerateQuestionsForSingleAudio(item)
                                  : undefined
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

        {/* Sleek Unified Bottom Capture Bar (Fixed thumb-friendly dock on mobile) */}
        {currentTopic && (
          <div className="px-3 sm:px-6 md:px-8 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shrink-0 bg-slate-950/90 backdrop-blur-md md:bg-transparent border-t border-slate-800/80 md:border-none">
            <div className="max-w-3xl mx-auto">
              {isRecording && (
                <div className="mb-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-rose-950/90 border border-rose-500/40 flex items-center justify-between gap-2 sm:gap-3 shadow-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                    <span className="font-mono text-xs font-bold text-white shrink-0">
                      {formatDuration(recordingSeconds)}
                    </span>
                    <div className="flex items-center gap-0.5 h-5 shrink-0">
                      {liveWaveform.slice(0, 10).map((v, i) => (
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

                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
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

                    {/* Quick Screen Print while Audio is Recording */}
                    {screenStream ? (
                      <button
                        type="button"
                        onClick={handleCaptureScreenSnapshot}
                        disabled={isCapturingScreen}
                        className="px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-sm animate-pulse"
                        title="Tirar print do slide da aula agora (Alt+S)"
                      >
                        <Camera className="w-3.5 h-3.5 text-cyan-300" />
                        <span className="hidden xs:inline">Print Slide (Alt+S)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartScreenShare}
                        className="px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 cursor-pointer border border-slate-700"
                        title="Conectar tela/slide para tirar prints com 1 clique (ou use o Plugin Alt+S)"
                      >
                        <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="hidden xs:inline">Conectar Slide</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={stopAndSaveRecording}
                      className="px-2.5 sm:px-3 py-1.5 sm:py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Salvar</span>
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
                className={`flex items-center gap-1 sm:gap-2 rounded-2xl border p-1.5 sm:p-2 shadow-lg ${
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
                  className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition cursor-pointer shrink-0"
                  title="Câmera"
                >
                  <Camera className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition cursor-pointer shrink-0"
                  title="Adicionar Foto da Galeria"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={screenStream ? handleCaptureScreenSnapshot : handleStartScreenShare}
                  className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${
                    screenStream
                      ? 'text-cyan-300 bg-cyan-950/50 border border-cyan-800/60 hover:bg-cyan-900/60 animate-pulse'
                      : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800/60'
                  }`}
                  title={
                    screenStream
                      ? 'Tirar Print da Tela Conectada (Alt + S)'
                      : 'Conectar Tela/Slide para Prints (ou use o Plugin Alt+S)'
                  }
                >
                  <Monitor className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={isRecording ? stopAndSaveRecording : startAudioRecording}
                  className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${
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
                  placeholder="Escreva uma anotação..."
                  className="flex-1 min-w-0 bg-transparent px-1.5 sm:px-2 py-1.5 text-xs sm:text-sm focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => setMarkImportant((v) => !v)}
                  className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${
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
                  className="p-2 sm:p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition cursor-pointer shrink-0"
                  title="Enviar anotação"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Modal: Edit Course */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Editar Curso</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCourse(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateCourse} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Nome do Curso *
                </label>
                <input
                  type="text"
                  required
                  value={editCourseName}
                  onChange={(e) => setEditCourseName(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={editCourseDesc}
                  onChange={(e) => setEditCourseDesc(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Subject */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Editar Matéria</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateSubject} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Curso *</label>
                <select
                  value={editSubjCourseId}
                  onChange={(e) => setEditSubjCourseId(e.target.value)}
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
                  value={editSubjName}
                  onChange={(e) => setEditSubjName(e.target.value)}
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
                      onClick={() => setEditSubjColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                        editSubjColor === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Topic / Aula */}
      {editingTopic && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Editar Título da Aula</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateTopic} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Título da Aula *
                </label>
                <input
                  type="text"
                  required
                  value={editTopicTitle}
                  onChange={(e) => setEditTopicTitle(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingTopic(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Course */}
      {showNewCourseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
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
        <CloudSyncModal
          isOpen={showCloudModal}
          onClose={() => setShowCloudModal(false)}
          lightMode={lightMode}
          currentUser={cloudUser}
          isSyncing={isSyncingCloud}
          lastSyncedTime={lastSyncedTime}
          onPerformSync={handlePerformCloudSync}
          onUserChanged={(u) => {
            setCloudUser(u);
            if (u) {
              handlePerformCloudSync();
            }
          }}
        />
      )}

      {showFlashcardsModal && currentSubject && (
        <ExamFlashcardsModal
          items={
            reviewOnlyDueCards && subjectDueCards.length > 0
              ? subjectDueCards
              : subjectExamFlashcards
          }
          subjectName={currentSubject.name}
          accentColor={currentSubject.color}
          onClose={() => {
            setShowFlashcardsModal(false);
            setReviewOnlyDueCards(false);
          }}
          onUpdateStatus={handleUpdateFlashcardStatus}
          onSM2Grade={handleSM2Grade}
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

      {/* Tutor IA de Estudos (Multi-Modelos com Failover) */}
      {showAiChatModal && currentTopic && (
        <StudyAiChatModal
          isOpen={showAiChatModal}
          onClose={() => setShowAiChatModal(false)}
          lightMode={lightMode}
          course={currentCourse}
          subject={currentSubject}
          topic={currentTopic}
          items={currentTopicItems}
          questions={currentTopicQuestions}
          onSaveToTimeline={(text, title) => {
            addTimelineEntry({
              type: 'text',
              title: title || 'Síntese do Tutor IA',
              content: text,
            });
          }}
          showToast={showToast}
        />
      )}

      {/* Custom In-App Confirmation Modal (Replaces browser confirm() dialog) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div
            className={`border rounded-t-3xl sm:rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl flex flex-col ${
              lightMode
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-slate-900 border-slate-800 text-slate-100'
            }`}
          >
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold tracking-tight">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition ${
                  lightMode
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await action();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/25 cursor-pointer transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmDialog.confirmText || 'Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Browser Extension & Screen Capture Modal */}
      <ExtensionPluginModal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        lightMode={lightMode}
        isExtensionDetected={isExtensionDetected}
        onStartNativeScreenShare={handleStartScreenShare}
        hasNativeScreenStream={Boolean(screenStream)}
      />

      {/* Hidden Video for Screen Snapshot Capture */}
      <video ref={screenVideoRef} autoPlay playsInline muted className="hidden" />

      {/* Discreet In-App Toast Notification */}
      {toastInfo && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="px-4 py-2.5 rounded-2xl bg-slate-900/95 text-white border border-indigo-500/40 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastInfo.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
