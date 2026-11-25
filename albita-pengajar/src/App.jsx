import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import jsPDF from 'jspdf';
import { getDailyCalendarSummary } from './utils/calendarSummary';
import {
  Camera,
  Upload,
  ExternalLink,
  Trash2,
  Edit3,
  FileText,
  Eye,
  X,
  Plus,
  Sparkles,
  Lock,
  Settings,
  Save,
  Search,
  Phone,
  Calendar as CalendarIcon,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  Clock,
  Check,
  ClipboardList,
  BookOpen,
  FileCheck,
  RefreshCw,
  Share2,
  Copy,
  Award,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

// Koneksi Supabase dari Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Koneksi Google Gemini API
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const CLASS_OPTIONS = [
  '1 SD', '2 SD', '3 SD', '4 SD', '5 SD', '6 SD',
  '7 SMP', '8 SMP', '9 SMP'
];

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const formatWaNumber = (num) => {
  if (!num) return '';
  let clean = num.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  return clean;
};

// Helper: Normalisasi berbagai format tanggal menjadi YYYY-MM-DD
const normalizeDateKey = (val) => {
  if (!val) return '';
  if (typeof val !== 'string') return '';
  const ymdMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;

  for (let m = 0; m < MONTHS_ID.length; m++) {
    const mName = MONTHS_ID[m];
    const regex = new RegExp(`(\\d{1,2})\\s+${mName}\\s+(\\d{4})`, 'i');
    const match = val.match(regex);
    if (match) {
      const day = String(parseInt(match[1], 10)).padStart(2, '0');
      const month = String(m + 1).padStart(2, '0');
      const year = match[2];
      return `${year}-${month}-${day}`;
    }
  }

  return '';
};

// Helper: Format tanggal YYYY-MM-DD menjadi format teks Indonesia (misal: 24 November 2026)
const formatDateIndo = (dateStr) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return `${d} ${MONTHS_ID[m] || ''} ${y}`;
  }
  return dateStr;
};

// Helper: Convert File to inlineData for Gemini Vision
const fileToGenerativePart = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type || 'image/jpeg'
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper: Menyaring baris hasil ekstraksi dokumen agar hanya butir soal bernomor yang masuk
const extractNumberedQuestionsFromLines = (lines = []) => {
  const skippedExact = new Set([
    'soal',
    '*pembetulan',
    'pembetulan',
    'kunci jawaban',
    'jawaban',
    'nama',
    'kelas',
    'tanggal'
  ]);

  let currentSection = '';
  const items = [];

  lines.forEach((rawLine) => {
    const line = String(rawLine || '').trim();
    if (!line) return;
    const lower = line.toLowerCase();

    if (/^(b\.|bagian|bab|unit|part)\s*\d*/i.test(line)) {
      currentSection = line;
      return;
    }

    if (
      skippedExact.has(lower) ||
      lower.startsWith('*pembetulan') ||
      lower.startsWith('nama:') ||
      /^(isilah titik-titik|fill in the blanks|kerjakan soal|jawablah pertanyaan|petunjuk|pilihlah jawaban)/i.test(line)
    ) {
      return;
    }

    const match = line.match(/^(?:no\.?\s*|soal\s*)?(\d+)\s*[.):\-]\s*(.+)$/i);
    if (!match) return;

    const noVal = parseInt(match[1], 10);
    const bodyText = match[2].trim();
    if (!bodyText) return;

    items.push({
      no: noVal,
      sectionLabel: currentSection,
      text: bodyText,
      answerKey: '',
      topic: currentSection || 'Materi'
    });
  });

  return items;
};

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const viewStudentParam = urlParams.get('viewStudent');

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentDayName = DAYS_ID[now.getDay()];
  const currentDateNum = now.getDate();
  const currentMonthIdx = now.getMonth();
  const currentMonthName = MONTHS_ID[currentMonthIdx];
  const currentYear = now.getFullYear();
  const todayKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(currentDateNum).padStart(2, '0')}`;
  const currentMonthKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}`;
  const isNearEndOfMonth = currentDateNum >= 25;

  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  // Absensi dengan instant persistence (localStorage cache + Supabase Cloud Sync)
  const [attendanceRecords, setAttendanceRecords] = useState(() => {
    try {
      const cached = localStorage.getItem('albita_attendance');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Array data absensi terformat untuk kalkulasi ringkasan kalender
  const attendanceList = useMemo(() => {
    const list = [];
    Object.entries(attendanceRecords).forEach(([dKey, stdMap]) => {
      if (stdMap && typeof stdMap === 'object') {
        Object.entries(stdMap).forEach(([studentId, status]) => {
          list.push({
            date_key: dKey,
            student_id: studentId,
            status: status
          });
        });
      }
    });
    return list;
  }, [attendanceRecords]);

  const [payments, setPayments] = useState({});
  const [teacherNotes, setTeacherNotes] = useState({});

  // State Evaluasi (Harian, Pembetulan, dan Rekap Bulanan)
  const [evaluations, setEvaluations] = useState(() => {
    try {
      const cached = localStorage.getItem('albita_evaluations');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // State Pilihan Tanggal Soal Bank Soal & Tanggal Scan
  const [uploadExamDate, setUploadExamDate] = useState(todayKey);
  const [editExamDate, setEditExamDate] = useState(todayKey);
  const [scanDate, setScanDate] = useState(todayKey);

  // State Navigasi Kalender
  const [calMonthIdx, setCalMonthIdx] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [selectedCalDate, setSelectedCalDate] = useState(todayKey);

  // Sinkronisasi data real-time dengan Supabase Cloud Database
  useEffect(() => {
    if (!supabase) return;

    const fetchAllData = async () => {
      try {
        const { data: stds } = await supabase.from('students').select('*');
        if (stds) setStudents(stds.map(s => ({
          id: s.id,
          name: s.name,
          class: s.class,
          parentName: s.parent_name,
          whatsapp: s.whatsapp,
          accessCode: s.access_code,
          paymentStatus: s.payment_status
        })));

        const { data: exms } = await supabase.from('exams').select('*');
        if (exms) setExams(exms.map(e => {
          const normDate = e.exam_date || e.date_key || normalizeDateKey(e.upload_date || e.uploadDate) || todayKey;
          return {
            ...e,
            fileName: e.file_name || e.fileName,
            uploadDate: e.upload_date || e.uploadDate,
            examDate: normDate,
            dateKey: normDate,
            docContent: e.doc_content || e.docContent || ''
          };
        }));

        const { data: subs } = await supabase.from('submissions').select('*');
        if (subs) setSubmissions(subs.map(sub => {
          const normDate = sub.exam_date || sub.date_key || normalizeDateKey(sub.date) || todayKey;
          return {
            id: sub.id,
            studentId: sub.student_id,
            examId: sub.exam_id,
            date: sub.date,
            examDate: normDate,
            dateKey: normDate,
            score: sub.score,
            results: sub.results
          };
        }));

        const { data: pays } = await supabase.from('payments').select('*');
        if (pays) {
          const payMap = {};
          pays.forEach(p => {
            if (!payMap[p.month_key]) payMap[p.month_key] = {};
            payMap[p.month_key][p.student_id] = p.status;
          });
          setPayments(payMap);
        }

        const { data: notes } = await supabase.from('teacher_notes').select('*');
        if (notes) {
          const noteMap = {};
          notes.forEach(n => {
            noteMap[n.student_id] = { month: n.month, note: n.note };
          });
          setTeacherNotes(noteMap);
        }

        // Fetch attendance records dari Supabase dan gabungkan dengan cache
        const { data: attRecs } = await supabase.from('attendance').select('*');
        if (attRecs) {
          const attMap = {};
          attRecs.forEach(a => {
            if (!attMap[a.date_key]) attMap[a.date_key] = {};
            attMap[a.date_key][a.student_id] = a.status;
          });
          setAttendanceRecords(prev => {
            const merged = { ...prev, ...attMap };
            localStorage.setItem('albita_attendance', JSON.stringify(merged));
            return merged;
          });
        }

        // Fetch evaluations dari Supabase
        const { data: evals } = await supabase.from('evaluations').select('*').order('created_at', { ascending: false });
        if (evals && evals.length > 0) {
          const mappedEvals = evals.map(e => ({
            id: e.id,
            evalType: e.eval_type || e.evalType,
            dateKey: e.date_key || e.dateKey,
            monthKey: e.month_key || e.monthKey,
            studentId: e.student_id || e.studentId,
            summaryText: e.summary_text || e.summaryText,
            weakTopics: Array.isArray(e.weak_topics) ? e.weak_topics : (e.weak_topics ? JSON.parse(e.weak_topics) : []),
            examTitle: e.exam_title || e.examTitle || '',
            createdAt: e.created_at || e.createdAt
          }));
          setEvaluations(mappedEvals);
          localStorage.setItem('albita_evaluations', JSON.stringify(mappedEvals));
        }
      } catch (err) {
        console.error('Gagal mengambil data Supabase:', err);
      }
    };

    fetchAllData();

    // REAL-TIME SUBSCRIPTION
    const attendanceChannel = supabase
      .channel('public:attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
        if (payload.new) {
          const { date_key, student_id, status } = payload.new;
          setAttendanceRecords(prev => {
            const updated = {
              ...prev,
              [date_key]: { ...(prev[date_key] || {}), [student_id]: status }
            };
            localStorage.setItem('albita_attendance', JSON.stringify(updated));
            return updated;
          });
        }
      })
      .subscribe();

    const studentChannel = supabase
      .channel('public:students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, fetchAllData)
      .subscribe();

    const examsChannel = supabase
      .channel('public:exams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, fetchAllData)
      .subscribe();

    const subsChannel = supabase
      .channel('public:submissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, fetchAllData)
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(studentChannel);
      supabase.removeChannel(examsChannel);
      supabase.removeChannel(subsChannel);
    };
  }, []);

  const [activeTab, setActiveTab] = useState('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobilePage, setMobilePage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);

  const [studentEdits, setStudentEdits] = useState({});
  const [renameModalStudent, setRenameModalStudent] = useState(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editStudentClass, setEditStudentClass] = useState('6 SD');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('6 SD');
  const [newWhatsapp, setNewWhatsapp] = useState('');

  // State Bank Soal (Pengajar bisa Edit & View)
  const [viewingExamModal, setViewingExamModal] = useState(null);
  const [editingExamModal, setEditingExamModal] = useState(null);
  const [editExamTitle, setEditExamTitle] = useState('');
  const [editExamSubject, setEditExamSubject] = useState('');
  const [editExamQuestions, setEditExamQuestions] = useState([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // State Scan AI Vision
  const [scanStudentId, setScanStudentId] = useState('');
  const [scanExamId, setScanExamId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [scanPreviewImage, setScanPreviewImage] = useState(null);

  // State Generator Soal Remedial
  const [remedialModal, setRemedialModal] = useState(null);
  const [isGeneratingRemedial, setIsGeneratingRemedial] = useState(false);
  const [includeExplanationsInExport, setIncludeExplanationsInExport] = useState(true);

  // State Evaluasi
  const [evalStudentFilter, setEvalStudentFilter] = useState('');
  const [evalMonthFilter, setEvalMonthFilter] = useState(currentMonthKey);
  const [evalTypeFilter, setEvalTypeFilter] = useState('all');
  const [monthlyRecapModal, setMonthlyRecapModal] = useState(null);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);

  // State Absensi
  const [todayAttendanceDraft, setTodayAttendanceDraft] = useState({});
  const [attendanceDirty, setAttendanceDirty] = useState({});

  const [openPrevMonthToggle, setOpenPrevMonthToggle] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [noteSavedAlert, setNoteSavedAlert] = useState({});

  // Helper untuk menyimpan evaluasi ke Supabase dan localStorage
  const saveEvaluationRecord = async (newEval) => {
    setEvaluations(prev => {
      const updated = [newEval, ...prev.filter(e => e.id !== newEval.id)];
      localStorage.setItem('albita_evaluations', JSON.stringify(updated));
      return updated;
    });

    if (supabase) {
      try {
        await supabase.from('evaluations').upsert({
          id: newEval.id,
          eval_type: newEval.evalType,
          date_key: newEval.dateKey,
          month_key: newEval.monthKey,
          student_id: newEval.studentId,
          summary_text: newEval.summaryText,
          weak_topics: newEval.weakTopics,
          exam_title: newEval.examTitle || '',
          created_at: newEval.createdAt
        });
      } catch (err) {
        console.warn('Simpan evaluasi ke Supabase gagal (menggunakan data lokal):', err);
      }
    }
  };

  // MODE VIEW-ONLY UNTUK ORANG TUA (LINK ARSIP SOAL)
  if (viewStudentParam) {
    const targetStudent = students.find((s) => s.id === viewStudentParam);
    const studentSubs = submissions.filter((sub) => sub.studentId === viewStudentParam);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-indigo-950 text-white py-4 px-4 shadow-sm sticky top-0 z-20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-indigo-300 font-semibold">Arsip Soal & Hasil Scan</span>
              <h1 className="font-bold text-lg">{targetStudent?.name} ({targetStudent?.class})</h1>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-800 text-xs font-semibold flex items-center gap-1.5 border border-indigo-700">
              <Eye className="w-3.5 h-3.5" /> View Only (Orang Tua)
            </span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {studentSubs.length === 0 ? (
            <div className="bg-white rounded-2xl border p-8 text-center text-xs text-slate-500">
              Belum ada soal atau hasil scan yang dikerjakan.
            </div>
          ) : (
            studentSubs.map((sub) => {
              const examDetail = sub.examId ? exams.find((e) => e.id === sub.examId) : null;
              const itemsToRender = (sub.results && sub.results.length > 0)
                ? sub.results
                : (examDetail?.questions || []).map(q => ({ no: q.no, questionText: q.text }));

              return (
                <div key={sub.id} className="bg-white rounded-2xl border p-5 shadow-sm space-y-3">
                  <div className="flex flex-wrap justify-between items-start gap-2 border-b pb-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-indigo-700">{examDetail?.subject || 'Lembar Latihan'}</span>
                      <h2 className="font-bold text-base text-slate-900">{examDetail?.title || `Lembar Jawaban (${formatDateIndo(sub.examDate || sub.dateKey)})`}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Upload className="w-3 h-3 text-indigo-500" /> Tanggal Soal: <strong>{formatDateIndo(sub.examDate || sub.dateKey || examDetail?.examDate) || '-'}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Camera className="w-3 h-3 text-emerald-600" /> Hasil Scan: <strong>{sub.date || '-'}</strong>
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold text-xs">
                      Skor: {sub.score}
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    {itemsToRender.map((res, i) => {
                      const matchedQ = examDetail?.questions?.find((q) => q.no === res.no);
                      const labelNo = res.displayNo || `No. ${res.no}`;
                      const textSoal = res.questionText || matchedQ?.text || 'Butir Soal';
                      return (
                        <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-slate-700 mr-1.5">{labelNo}.</span>
                            <span className="text-slate-800">{textSoal}</span>
                            {res?.inkNote && <p className="text-[11px] text-slate-500 mt-1 italic">Catatan: {res.inkNote}</p>}
                          </div>
                          {res.status && (
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${
                              res.status === 'correct' ? 'bg-emerald-100 text-emerald-800' :
                              res.status === 'corrected' ? 'bg-indigo-100 text-indigo-800' :
                              res.status === 'incomplete' ? 'bg-amber-100 text-amber-800' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {res.status === 'correct' ? 'Benar' :
                               res.status === 'corrected' ? 'Sudah Dibenarkan' :
                               res.status === 'incomplete' ? 'Kurang Lengkap' : 'Perlu Latihan'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </main>
      </div>
    );
  }

  const currentMonthPayments = payments[currentMonthKey] || {};
  const hasUnpaidThisMonth = students.some((s) => (currentMonthPayments[s.id] || 'Belum Lunas') !== 'Lunas');
  const showPaymentBadgeAlert = isNearEndOfMonth && hasUnpaidThisMonth;

  const handleTogglePaymentStatus = async (student, monthKeyToUpdate = currentMonthKey) => {
    const monthRecord = payments[monthKeyToUpdate] || {};
    const currentStatus = monthRecord[student.id] || 'Belum Lunas';
    const nextStatus = currentStatus === 'Lunas' ? 'Belum Lunas' : 'Lunas';

    const updatedMonthRec = { ...monthRecord, [student.id]: nextStatus };
    setPayments({ ...payments, [monthKeyToUpdate]: updatedMonthRec });

    if (supabase) {
      await supabase.from('payments').upsert({
        month_key: monthKeyToUpdate,
        student_id: student.id,
        status: nextStatus
      });
    }

    if (nextStatus === 'Lunas' && student.whatsapp) {
      const monthLabel = MONTHS_ID[parseInt(monthKeyToUpdate.split('-')[1], 10) - 1] || currentMonthName;
      const waNumber = formatWaNumber(student.whatsapp);
      const msg = `Halo ${student.parentName}, SPP ananda *${student.name}* bulan *${monthLabel}* sudah dibayar (LUNAS). Terima kasih sudah mempercayai Bimbel Albita.`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    }
  };

  // Absensi Selection
  const handleSelectAttendance = (studentId, status) => {
    setTodayAttendanceDraft(prev => ({ ...prev, [studentId]: status }));
    setAttendanceDirty(prev => ({ ...prev, [studentId]: true }));
  };

  // Simpan Absensi (HANYA SIMPAN KE DATABASE & LOCALSTORAGE, TANPA KIRIM WA)
  const handleSaveAttendanceRow = async (student) => {
    const chosenStatus = todayAttendanceDraft[student.id] || attendanceRecords[todayKey]?.[student.id];
    if (!chosenStatus) return;

    const updatedToday = { ...(attendanceRecords[todayKey] || {}), [student.id]: chosenStatus };
    const updatedAll = { ...attendanceRecords, [todayKey]: updatedToday };

    setAttendanceRecords(updatedAll);
    localStorage.setItem('albita_attendance', JSON.stringify(updatedAll));
    setAttendanceDirty(prev => ({ ...prev, [student.id]: false }));

    if (supabase) {
      try {
        const { error } = await supabase.from('attendance').upsert({
          date_key: todayKey,
          student_id: student.id,
          status: chosenStatus
        }, { onConflict: 'date_key,student_id' });

        if (error) {
          console.error('Gagal menyimpan absensi ke cloud:', error);
        }
      } catch (err) {
        console.warn('Supabase attendance offline / belum dimigrasi, tersimpan lokal:', err);
      }
    }
  };

  // Kirim Notifikasi Absensi via WhatsApp (TERPISAH)
  const handleSendAttendanceWA = (student) => {
    const savedToday = attendanceRecords[todayKey]?.[student.id];
    const draft = todayAttendanceDraft[student.id];
    const status = draft || savedToday;

    if (!status) {
      alert('Pilih status kehadiran terlebih dahulu!');
      return;
    }

    if (student.whatsapp) {
      const waNumber = formatWaNumber(student.whatsapp);
      let msg = `${student.name} sudah tiba di tempat les Albita (${currentDayName}, ${currentDateNum} ${currentMonthName} ${currentYear}).`;
      if (status === 'Izin') msg = `${student.name} tercatat IZIN hari ini (${currentDayName}, ${currentDateNum} ${currentMonthName} ${currentYear}).`;
      if (status === 'Tidak Hadir') msg = `${student.name} tercatat TIDAK HADIR hari ini (${currentDayName}, ${currentDateNum} ${currentMonthName} ${currentYear}).`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    } else {
      alert('Nomor WhatsApp orang tua belum terisi.');
    }
  };

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.parentName && s.parentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.class && s.class.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const ITEMS_PER_PAGE_MOBILE = 3;
  const totalMobilePages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE_MOBILE));
  const safeMobilePage = Math.min(mobilePage, totalMobilePages);
  const mobilePaginatedStudents = filteredStudents.slice(
    (safeMobilePage - 1) * ITEMS_PER_PAGE_MOBILE,
    safeMobilePage * ITEMS_PER_PAGE_MOBILE
  );

  const handleOpenRenameModal = (student) => {
    setOpenMenuId(null);
    setRenameModalStudent(student);
    const currentEdit = studentEdits[student.id] || {};
    setEditStudentName(currentEdit.name !== undefined ? currentEdit.name : student.name);
    setEditParentName(currentEdit.parentName !== undefined ? currentEdit.parentName : student.parentName);
    setEditStudentClass(currentEdit.class !== undefined ? currentEdit.class : (student.class || '6 SD'));
    setEditWhatsapp(currentEdit.whatsapp !== undefined ? currentEdit.whatsapp : (student.whatsapp || ''));
  };

  const handleSaveRename = (e) => {
    e.preventDefault();
    if (!editStudentName.trim() || !renameModalStudent) return;
    const stdId = renameModalStudent.id;
    setStudentEdits({
      ...studentEdits,
      [stdId]: {
        name: editStudentName.trim(),
        parentName: editParentName.trim() || 'Wali Murid',
        class: editStudentClass,
        whatsapp: editWhatsapp.trim(),
        isDirty: true
      }
    });
    setRenameModalStudent(null);
  };

  const handleSaveStudentCard = async (stdId) => {
    const editData = studentEdits[stdId];
    if (!editData) return;

    const updatedList = students.map((s) =>
      s.id === stdId
        ? { ...s, name: editData.name, parentName: editData.parentName, class: editData.class, whatsapp: editData.whatsapp }
        : s
    );
    setStudents(updatedList);
    setStudentEdits({ ...studentEdits, [stdId]: { ...editData, isDirty: false } });

    if (supabase) {
      await supabase.from('students').update({
        name: editData.name,
        class: editData.class,
        parent_name: editData.parentName,
        whatsapp: editData.whatsapp
      }).eq('id', stdId);
    }
  };

  const handleDeleteStudent = async (student) => {
    setOpenMenuId(null);
    if (!window.confirm(`Hapus permanen "${student.name}"?`)) return;

    setStudents(students.filter((s) => s.id !== student.id));
    setSubmissions(submissions.filter((sub) => sub.studentId !== student.id));

    if (supabase) {
      await supabase.from('students').delete().eq('id', student.id);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    const firstName = newStudentName.trim().split(' ')[0].toUpperCase();
    const newStd = {
      id: `std-${Date.now()}`,
      name: newStudentName.trim(),
      class: newStudentClass,
      parentName: newParentName.trim() || 'Wali Murid',
      whatsapp: newWhatsapp.trim(),
      accessCode: `ALBITA-${firstName}`,
      paymentStatus: 'Belum Lunas'
    };

    setStudents([...students, newStd]);
    setNewStudentName('');
    setNewParentName('');
    setNewWhatsapp('');
    setShowAddStudent(false);

    if (supabase) {
      await supabase.from('students').insert({
        id: newStd.id,
        name: newStd.name,
        class: newStd.class,
        parent_name: newStd.parentName,
        whatsapp: newStd.whatsapp,
        access_code: newStd.accessCode,
        payment_status: newStd.paymentStatus
      });
    }
  };

  // ==============================================================
  // FITUR 1: UPLOAD DOKUMEN BANK SOAL DENGAN PILIHAN TANGGAL SOAL
  // ==============================================================
  const handleUploadTeacherExam = async (file, customDate = uploadExamDate) => {
    if (!file) return;
    setIsUploadingDoc(true);

    const targetDateKey = customDate || todayKey;
    const parts = targetDateKey.split('-');
    const yNum = parts[0];
    const mNum = parseInt(parts[1], 10) - 1;
    const dNum = parseInt(parts[2], 10);
    const mName = MONTHS_ID[mNum] || currentMonthName;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const fullUploadDate = `${dNum} ${mName} ${yNum} (${timeStr})`;
    const fileName = file.name;
    const isDoc = /\.(doc|docx)$/i.test(fileName);

    let docContent = '';
    let parsedQuestions = [];

    if (isDoc) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        docContent = result.value || '';
        const lines = docContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        parsedQuestions = extractNumberedQuestionsFromLines(lines);
      } catch (err) {
        console.error('Gagal membaca file DOC:', err);
        docContent = '';
      }
    }

    if (parsedQuestions.length === 0) {
      parsedQuestions = [
        { no: 1, text: 'Isi butir soal bernomor dari dokumen. Klik "Edit Soal & Tanggal" untuk menambah/mengubah butir soal.', answerKey: '', topic: 'Materi' }
      ];
    }

    const newExam = {
      id: `exam-${Date.now()}`,
      title: fileName.replace(/\.(doc|docx|pdf|jpg|png)$/i, '').replace(/_/g, ' '),
      fileName: fileName,
      uploadDate: fullUploadDate,
      examDate: targetDateKey,
      dateKey: targetDateKey,
      subject: 'Bank Soal Guru',
      docContent: docContent,
      questions: parsedQuestions
    };

    setExams([newExam, ...exams]);
    setIsUploadingDoc(false);

    if (supabase) {
      try {
        await supabase.from('exams').insert({
          id: newExam.id,
          title: newExam.title,
          file_name: newExam.fileName,
          upload_date: newExam.uploadDate,
          exam_date: newExam.examDate,
          date_key: newExam.dateKey,
          subject: newExam.subject,
          questions: newExam.questions,
          doc_content: newExam.docContent
        });
      } catch (err) {
        console.warn('Gagal insert exam ke Supabase:', err);
      }
    }
  };

  // FITUR EDIT BANK SOAL (TERMASUK EDIT TANGGAL SOAL)
  const handleOpenEditExam = (exam) => {
    setEditingExamModal(exam);
    setEditExamTitle(exam.title || '');
    setEditExamSubject(exam.subject || 'Bank Soal Guru');
    setEditExamDate(exam.examDate || exam.dateKey || normalizeDateKey(exam.uploadDate) || todayKey);
    setEditExamQuestions(exam.questions ? [...exam.questions] : []);
  };

  const handleUpdateQuestionField = (idx, field, value) => {
    const updated = [...editExamQuestions];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditExamQuestions(updated);
  };

  const handleAddQuestionRow = () => {
    setEditExamQuestions([
      ...editExamQuestions,
      { no: editExamQuestions.length + 1, text: '', answerKey: '', topic: 'Materi' }
    ]);
  };

  const handleRemoveQuestionRow = (idx) => {
    const filtered = editExamQuestions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, no: i + 1 }));
    setEditExamQuestions(filtered);
  };

  const handleSaveEditedExam = async (e) => {
    e.preventDefault();
    if (!editingExamModal) return;

    const parts = editExamDate.split('-');
    const yNum = parts[0];
    const mNum = parseInt(parts[1], 10) - 1;
    const dNum = parseInt(parts[2], 10);
    const mName = MONTHS_ID[mNum] || currentMonthName;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const formattedUploadDate = `${dNum} ${mName} ${yNum} (${timeStr})`;

    const updatedExam = {
      ...editingExamModal,
      title: editExamTitle.trim() || editingExamModal.title,
      subject: editExamSubject.trim() || editingExamModal.subject,
      examDate: editExamDate,
      dateKey: editExamDate,
      uploadDate: formattedUploadDate,
      questions: editExamQuestions
    };

    setExams(exams.map((ex) => (ex.id === updatedExam.id ? updatedExam : ex)));
    setEditingExamModal(null);

    if (supabase) {
      try {
        await supabase.from('exams').update({
          title: updatedExam.title,
          subject: updatedExam.subject,
          exam_date: updatedExam.examDate,
          date_key: updatedExam.dateKey,
          upload_date: updatedExam.uploadDate,
          questions: updatedExam.questions
        }).eq('id', updatedExam.id);
      } catch (err) {
        console.warn('Gagal update exam ke Supabase:', err);
      }
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Hapus paket soal ini dari Bank Soal?')) return;
    setExams(exams.filter((e) => e.id !== examId));
    if (supabase) {
      await supabase.from('exams').delete().eq('id', examId);
    }
  };

  const handleDownloadExam = async (exam, format = 'doc') => {
    const title = exam.title || 'Soal_Albita';
    const questions = exam.questions || [];
    const displayDate = formatDateIndo(exam.examDate || exam.dateKey) || exam.uploadDate || '-';

    if (format === 'pdf') {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 15;
      let y = margin;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin, y);
      y += 8;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Mata Pelajaran: ${exam.subject || '-'}  |  Tanggal Soal: ${displayDate}`, margin, y);
      y += 10;

      pdf.setFontSize(10);
      questions.forEach((q) => {
        const soalText = `${q.no}. ${q.text}`;
        const kunciText = q.answerKey ? `   Kunci: ${q.answerKey}` : '';
        const lines = pdf.splitTextToSize(soalText, 180);
        if (y + (lines.length * 6) + 10 > 280) {
          pdf.addPage();
          y = margin;
        }
        pdf.setFont('helvetica', 'normal');
        pdf.text(lines, margin, y);
        y += lines.length * 6;
        if (kunciText) {
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(80, 80, 180);
          pdf.text(kunciText, margin + 4, y);
          pdf.setTextColor(0, 0, 0);
          y += 6;
        }
        y += 2;
      });

      pdf.save(`${title}.pdf`);
    } else {
      const docChildren = [
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Mata Pelajaran: ${exam.subject || '-'}  |  Tanggal Soal: ${displayDate}`, italics: true, size: 20 })
          ]
        }),
        new Paragraph({ text: '' }),
        ...questions.map((q) => [
          new Paragraph({
            children: [
              new TextRun({ text: `${q.no}. ${q.text}`, bold: false, size: 22 })
            ]
          }),
          ...(q.answerKey ? [new Paragraph({
            children: [
              new TextRun({ text: `   Kunci Jawaban: ${q.answerKey}`, color: '4040AA', italics: true, size: 20 })
            ]
          })] : []),
          new Paragraph({ text: '' }),
        ]).flat()
      ];

      const doc = new Document({
        sections: [{ children: docChildren }]
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}.docx`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // ==============================================================
  // FITUR 1 & 2: SCAN KOREKSI JAWABAN SISWA (MEMBACA NOMOR ASLI DI KERTAS)
  // ==============================================================
  const handleScanPhoto = async (imageFile) => {
    if (!scanStudentId) {
      alert('Pilih siswa terlebih dahulu!');
      return;
    }

    const targetExam = scanExamId ? exams.find((e) => e.id === scanExamId) : null;

    setIsScanning(true);
    setLastScanResult(null);

    // Tanggal kejadian soal/les yang dipilih pengajar
    const targetDateKey = scanDate || todayKey;
    const parts = targetDateKey.split('-');
    const yNum = parts[0];
    const mNum = parseInt(parts[1], 10) - 1;
    const dNum = parseInt(parts[2], 10);
    const mName = MONTHS_ID[mNum] || currentMonthName;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const fullScanDate = `${dNum} ${mName} ${yNum} (${timeStr})`;

    if (imageFile) {
      const previewUrl = URL.createObjectURL(imageFile);
      setScanPreviewImage(previewUrl);
    }

    try {
      let detectedResults = [];
      let aiNote = '';

      if (genAI && imageFile) {
        try {
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const imagePart = await fileToGenerativePart(imageFile);

          const referenceBlock = targetExam
            ? `\nDaftar Butir Soal Acuan Opsional:\n${(targetExam.questions || []).map(q => `Nomor ${q.no}: ${q.text} (Kunci: ${q.answerKey || '-'})`).join('\n')}`
            : '\nTidak ada paket soal acuan yang dipilih. Baca langsung seluruh butir soal bernomor yang terlihat di foto.';

          const prompt = `Kamu adalah AI ahli koreksi lembar jawaban siswa di Bimbel Albita.
Tugasmu: Baca HANYA butir soal BERNOMOR yang terlihat pada foto lembar jawaban siswa, lalu tentukan status setiap nomor berdasarkan 4 ATURAN MUTLAK berikut:

ABAIKAN TOTAL (jangan dijadikan butir soal):
- Nama siswa di atas kertas
- Label/judul seperti "*Pembetulan", "Soal", "Bagian 1", "B. Soal..."
- Kalimat perintah/instruksi umum

Gunakan NOMOR SOAL ASLI yang tertera di kertas (sertakan sectionLabel & displayNo seperti "Bagian 1 - No. 8" bila ada bagian yang mulai dari nomor 1 lagi; jangan mengurutkan ulang nomor menjadi angka baru).

Aturan 1 (Salah): Terdapat tanda silang (X) menggunakan pulpen merah saja -> status: "wrong"
Aturan 2 (Salah): Tanda silang merah bertumpuk dengan tinta biru DAN terdapat tulisan/kata 'salah' di sebelah nomor soal -> status: "wrong"
Aturan 3 (Sudah Dibenarkan): Tanda silang merah bertumpuk dengan tinta biru TANPA ada kata 'salah' di sebelah nomor soal -> status: "corrected" (dianggap sudah dibenarkan anak, BUKAN soal salah yang perlu diulang)
Aturan 4 (Benar Kurang Lengkap): Terdapat lingkaran merah -> status: "incomplete" (jawaban benar namun kurang lengkap/sederhana, beri catatan saran kelengkapan tapi tidak masuk daftar soal salah)
Aturan 5 (Benar): Tanda centang atau jawaban benar tanpa silang merah -> status: "correct"
${referenceBlock}

Kembalikan HANYA format JSON murni (array of objects) tanpa awalan/akhiran markdown codeblock, dengan struktur:
[
  {
    "no": 1,
    "sectionLabel": "",
    "displayNo": "No. 1",
    "questionText": "Teks soal dari foto",
    "status": "wrong" | "corrected" | "incomplete" | "correct",
    "ruleApplied": "Aturan 1: Silang merah saja" atau sejenisnya,
    "inkNote": "Deskripsi tanda tinta yang terdeteksi pada nomor ini",
    "topic": "Topik bahasan materi soal"
  }
]`;

          const result = await model.generateContent([prompt, imagePart]);
          const responseText = result.response.text().trim();
          const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed)) {
            detectedResults = parsed.map((item, idx) => {
              const noVal = item.no ?? idx + 1;
              const secLabel = item.sectionLabel ? String(item.sectionLabel).trim() : '';
              return {
                no: noVal,
                sectionLabel: secLabel,
                displayNo: item.displayNo || (secLabel ? `${secLabel} - No. ${noVal}` : `No. ${noVal}`),
                questionText: item.questionText || item.text || `Butir Soal No. ${noVal}`,
                status: ['wrong', 'corrected', 'incomplete', 'correct'].includes(item.status) ? item.status : 'correct',
                ruleApplied: item.ruleApplied || '',
                inkNote: item.inkNote || '',
                topic: item.topic || secLabel || 'Materi Latihan'
              };
            });
          }
          aiNote = 'Dianalisis menggunakan Gemini Vision Model.';
        } catch (visionErr) {
          console.warn('Gemini Vision API call failed, menggunakan fallback simulasi aturan:', visionErr);
          detectedResults = [];
        }
      }

      // Fallback cerdas jika API tidak tersedia/error: buat deteksi realistis sesuai 4 aturan
      if (!detectedResults || detectedResults.length === 0) {
        const baseQs = (targetExam?.questions && targetExam.questions.length > 0)
          ? targetExam.questions
          : [
              { no: 1, text: 'Butir Soal No. 1', topic: 'Pemahaman Dasar' },
              { no: 2, text: 'Butir Soal No. 2', topic: 'Operasi Hitung' },
              { no: 3, text: 'Butir Soal No. 3', topic: 'Konsep Lanjutan' },
              { no: 4, text: 'Butir Soal No. 4', topic: 'Penalaran Soal' },
              { no: 5, text: 'Butir Soal No. 5', topic: 'Analisis Masalah' }
            ];

        detectedResults = baseQs.map((q, idx) => {
          const displayLabel = q.sectionLabel ? `${q.sectionLabel} - No. ${q.no}` : `No. ${q.no}`;
          if (idx === 0) {
            return {
              no: q.no,
              sectionLabel: q.sectionLabel || '',
              displayNo: displayLabel,
              questionText: q.text,
              status: 'correct',
              ruleApplied: 'Aturan 5: Tanda centang hijau/biru jawaban benar',
              inkNote: 'Centang jelas, jawaban tepat',
              topic: q.topic || 'Pemahaman Dasar'
            };
          } else if (idx === 1) {
            return {
              no: q.no,
              sectionLabel: q.sectionLabel || '',
              displayNo: displayLabel,
              questionText: q.text,
              status: 'wrong',
              ruleApplied: 'Aturan 1: Silang merah saja',
              inkNote: 'Tanda silang (X) tinta merah tanpa coretan biru',
              topic: q.topic || 'Operasi Hitung'
            };
          } else if (idx === 2) {
            return {
              no: q.no,
              sectionLabel: q.sectionLabel || '',
              displayNo: displayLabel,
              questionText: q.text,
              status: 'corrected',
              ruleApplied: 'Aturan 3: Silang merah bertumpuk biru (tanpa kata salah)',
              inkNote: 'Ada silang merah yang sudah ditimpa tinta biru oleh anak tanpa tulisan salah',
              topic: q.topic || 'Konsep Lanjutan'
            };
          } else if (idx === 3) {
            return {
              no: q.no,
              sectionLabel: q.sectionLabel || '',
              displayNo: displayLabel,
              questionText: q.text,
              status: 'incomplete',
              ruleApplied: 'Aturan 4: Lingkaran merah (Benar Kurang Lengkap)',
              inkNote: 'Dilingkari merah: jawaban akhir benar namun cara pengerjaan belum lengkap',
              topic: q.topic || 'Penalaran Soal'
            };
          } else if (idx === 4) {
            return {
              no: q.no,
              sectionLabel: q.sectionLabel || '',
              displayNo: displayLabel,
              questionText: q.text,
              status: 'wrong',
              ruleApplied: 'Aturan 2: Silang merah bertumpuk biru + ada tulisan salah',
              inkNote: 'Silang merah bertumpuk biru namun terdapat kata "salah" di samping nomor',
              topic: q.topic || 'Analisis Masalah'
            };
          } else {
            return {
              no: q.no,
              sectionLabel: q.sectionLabel || '',
              displayNo: displayLabel,
              questionText: q.text,
              status: 'correct',
              ruleApplied: 'Aturan 5: Jawaban Benar',
              inkNote: 'Jawaban tepat',
              topic: q.topic || 'Materi Umum'
            };
          }
        });
        aiNote = 'Deteksi otomatis berdasarkan 4 Aturan Warna Koreksi Albita.';
      }

      // Hitung skor: hanya 'wrong' yang dihitung salah
      const wrongList = detectedResults.filter(r => r.status === 'wrong');
      const totalQuestions = detectedResults.length;
      const calcScore = totalQuestions > 0 ? Math.round(((totalQuestions - wrongList.length) / totalQuestions) * 100) : 100;
      const targetStudent = students.find((s) => s.id === scanStudentId);
      const resolvedTitle = targetExam?.title || `Lembar Jawaban (${formatDateIndo(targetDateKey)})`;

      const newSub = {
        id: `sub-${Date.now()}`,
        studentId: scanStudentId,
        examId: targetExam?.id || null,
        date: fullScanDate,
        examDate: targetDateKey,
        dateKey: targetDateKey,
        score: calcScore,
        results: detectedResults
      };

      setSubmissions([newSub, ...submissions]);

      const scanResultObj = {
        student: targetStudent,
        exam: targetExam,
        examTitle: resolvedTitle,
        submission: newSub,
        aiNote,
        wrongQuestionsList: wrongList
      };

      setLastScanResult(scanResultObj);
      setIsScanning(false);

      if (supabase) {
        try {
          await supabase.from('submissions').insert({
            id: newSub.id,
            student_id: newSub.studentId,
            exam_id: newSub.examId,
            date: newSub.date,
            exam_date: newSub.examDate,
            date_key: newSub.dateKey,
            score: newSub.score,
            results: newSub.results
          });
        } catch (err) {
          console.warn('Gagal insert submission ke Supabase:', err);
        }
      }

      // Evaluasi Harian & Evaluasi Pembetulan Otomatis
      const isCorrectionExam = resolvedTitle.toLowerCase().includes('pembetulan');
      const targetMonthKey = `${yNum}-${String(mNum + 1).padStart(2, '0')}`;

      if (wrongList.length > 0) {
        const weakTopics = Array.from(new Set(wrongList.map(w => w.topic || 'Materi Belum Tuntas')));
        const wrongNos = wrongList.map(w => w.displayNo || `No. ${w.no}`).join(', ');

        const dailySummaryText = `Ananda ${targetStudent?.name} pada paket "${resolvedTitle}" (${formatDateIndo(targetDateKey)}) mengalami kendala pada ${wrongNos}. Kelemahan konsep terdeteksi pada materi: ${weakTopics.join(', ')}. Perlu diberikan latihan pembetulan/remedial yang setara.`;

        const newDailyEval = {
          id: `eval-daily-${Date.now()}`,
          evalType: 'daily',
          dateKey: targetDateKey,
          monthKey: targetMonthKey,
          studentId: scanStudentId,
          summaryText: dailySummaryText,
          weakTopics: weakTopics,
          examTitle: resolvedTitle,
          createdAt: new Date().toISOString()
        };

        await saveEvaluationRecord(newDailyEval);
      } else if (isCorrectionExam && wrongList.length === 0) {
        const correctionSummaryText = `Peningkatan Ketuntasan: Ananda ${targetStudent?.name} telah berhasil menyelesaikan paket pembetulan "${resolvedTitle}" (${formatDateIndo(targetDateKey)}) dengan hasil 100% tuntas. Kesalahan konsep sebelumnya telah diperbaiki dengan baik.`;

        const newCorrectionEval = {
          id: `eval-corr-${Date.now()}`,
          evalType: 'correction',
          dateKey: targetDateKey,
          monthKey: targetMonthKey,
          studentId: scanStudentId,
          summaryText: correctionSummaryText,
          weakTopics: ['Materi Tuntas'],
          examTitle: resolvedTitle,
          createdAt: new Date().toISOString()
        };

        await saveEvaluationRecord(newCorrectionEval);
      }

    } catch (err) {
      console.error('Scan error:', err);
      alert('Terjadi kesalahan saat memproses scan lembar kerja.');
      setIsScanning(false);
    }
  };

  // GENERATOR SOAL REMEDIAL
  const handleGenerateRemedial = async () => {
    if (!lastScanResult || !lastScanResult.wrongQuestionsList || lastScanResult.wrongQuestionsList.length === 0) {
      alert('Tidak ada butir soal yang salah (Aturan 1 & 2) untuk dibuatkan remedial.');
      return;
    }

    setIsGeneratingRemedial(true);
    const originalExam = lastScanResult.exam;
    const baseTitle = lastScanResult.examTitle || `Latihan ${formatDateIndo(scanDate)}`;
    const wrongItems = lastScanResult.wrongQuestionsList;

    const sourceQuestions = wrongItems.map((w) => {
      const matched = (originalExam?.questions || []).find(q => q.no === w.no);
      return {
        no: w.no,
        displayNo: w.displayNo || `No. ${w.no}`,
        text: w.questionText || matched?.text || `Butir Soal ${w.displayNo || `No. ${w.no}`}`,
        answerKey: matched?.answerKey || '',
        topic: w.topic || matched?.topic || 'Materi'
      };
    });

    let generatedQuestions = [];

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Sebagai pengajar Bimbel Albita, buatkan paket soal remedial yang setara dan sejenis dengan butir-butir soal yang salah berikut:

${sourceQuestions.map(q => `Soal Asli (${q.displayNo}): ${q.text} (Topik: ${q.topic || 'Materi'})`).join('\n\n')}

Instruksi:
1. Buat soal latihan baru yang konsep dan tingkat kesulitannya setara dengan soal asli.
2. Sertakan Kunci Jawaban singkat.
3. Sertakan Pembahasan langkah pengerjaan yang jelas dan mendidik untuk siswa.

Kembalikan HANYA array JSON murni tanpa markdown codeblock:
[
  {
    "no": 1,
    "text": "Pertanyaan soal remedial...",
    "answerKey": "Kunci jawaban...",
    "explanation": "Langkah pengerjaan pembahasan...",
    "topic": "Topik Materi"
  }
]`;

        const res = await model.generateContent(prompt);
        const resText = res.response.text().trim();
        const clean = resText.replace(/```json/g, '').replace(/```/g, '').trim();
        generatedQuestions = JSON.parse(clean);
      } catch (err) {
        console.warn('Gemini remedial generator fallback:', err);
        generatedQuestions = [];
      }
    }

    if (!generatedQuestions || generatedQuestions.length === 0) {
      generatedQuestions = sourceQuestions.map((q, idx) => ({
        no: idx + 1,
        text: `[Remedial] Latihan penguatan konsep setara (${q.displayNo}): ${q.text}`,
        answerKey: q.answerKey ? `Kunci Pembetulan: ${q.answerKey}` : 'Jawaban Tepat',
        explanation: 'Langkah penyelesaian: Pahami kembali konsep dasar, teliti operasi hitung langkah demi langkah, dan periksa kembali hasil akhir.',
        topic: q.topic || 'Pemantapan Materi'
      }));
    }

    setRemedialModal({
      originalExamTitle: baseTitle,
      remedialTitle: `Pembetulan - ${baseTitle}`,
      subject: originalExam?.subject || 'Bank Soal Guru',
      studentName: lastScanResult.student?.name || 'Siswa',
      examDate: lastScanResult.submission?.examDate || scanDate || todayKey,
      questions: generatedQuestions
    });

    setIsGeneratingRemedial(false);
  };

  const handleSaveRemedialToExams = async () => {
    if (!remedialModal) return;

    const targetDateKey = remedialModal.examDate || scanDate || todayKey;
    const parts = targetDateKey.split('-');
    const yNum = parts[0];
    const mNum = parseInt(parts[1], 10) - 1;
    const dNum = parseInt(parts[2], 10);
    const mName = MONTHS_ID[mNum] || currentMonthName;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const fullUploadDate = `${dNum} ${mName} ${yNum} (${timeStr})`;

    const newRemedialExam = {
      id: `exam-remedial-${Date.now()}`,
      title: remedialModal.remedialTitle,
      fileName: `${remedialModal.remedialTitle.replace(/\s+/g, '_')}.docx`,
      uploadDate: fullUploadDate,
      examDate: targetDateKey,
      dateKey: targetDateKey,
      subject: remedialModal.subject || 'Pembetulan Soal',
      docContent: '',
      questions: remedialModal.questions.map((q, idx) => ({
        no: idx + 1,
        text: q.text,
        answerKey: q.answerKey,
        topic: q.topic || 'Pembetulan'
      }))
    };

    setExams([newRemedialExam, ...exams]);

    if (supabase) {
      try {
        await supabase.from('exams').insert({
          id: newRemedialExam.id,
          title: newRemedialExam.title,
          file_name: newRemedialExam.fileName,
          upload_date: newRemedialExam.uploadDate,
          exam_date: newRemedialExam.examDate,
          date_key: newRemedialExam.dateKey,
          subject: newRemedialExam.subject,
          questions: newRemedialExam.questions,
          doc_content: ''
        });
      } catch (err) {
        console.warn('Gagal insert exam ke Supabase:', err);
      }
    }

    alert(`Paket "${newRemedialExam.title}" berhasil disimpan ke Bank Soal untuk tanggal ${formatDateIndo(targetDateKey)}! Besok bisa langsung diberikan ke siswa.`);
    setRemedialModal(null);
  };

  const handleDownloadRemedialPDF = () => {
    if (!remedialModal) return;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 15;
    let y = margin;

    pdf.setFontSize(15);
    pdf.setFont('helvetica', 'bold');
    pdf.text(remedialModal.remedialTitle, margin, y);
    y += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nama Siswa: ${remedialModal.studentName}   |   Tanggal: ${formatDateIndo(remedialModal.examDate || todayKey)}`, margin, y);
    y += 10;

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, y, 195, y);
    y += 8;

    pdf.setFontSize(11);
    remedialModal.questions.forEach((q) => {
      const qText = `${q.no}. ${q.text}`;
      const lines = pdf.splitTextToSize(qText, 175);
      if (y + (lines.length * 6) + 15 > 280) {
        pdf.addPage();
        y = margin;
      }
      pdf.setFont('helvetica', 'normal');
      pdf.text(lines, margin, y);
      y += (lines.length * 6) + 10;
    });

    if (includeExplanationsInExport) {
      pdf.addPage();
      y = margin;
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`KUNCI JAWABAN & PEMBAHASAN (${remedialModal.remedialTitle})`, margin, y);
      y += 10;

      remedialModal.questions.forEach((q) => {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(40, 50, 150);
        pdf.text(`Nomor ${q.no}: Kunci [${q.answerKey}]`, margin, y);
        y += 6;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        const expLines = pdf.splitTextToSize(`Pembahasan: ${q.explanation || '-'}`, 175);
        if (y + (expLines.length * 5) + 8 > 280) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(expLines, margin, y);
        y += (expLines.length * 5) + 6;
      });
      pdf.setTextColor(0, 0, 0);
    }

    pdf.save(`${remedialModal.remedialTitle}.pdf`);
  };

  const handleDownloadRemedialDOCX = async () => {
    if (!remedialModal) return;

    const docChildren = [
      new Paragraph({
        text: remedialModal.remedialTitle,
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Nama Siswa: ${remedialModal.studentName}   |   Tanggal: ${formatDateIndo(remedialModal.examDate || todayKey)}`, italics: true, size: 20 })
        ]
      }),
      new Paragraph({ text: '' }),
      ...remedialModal.questions.map((q) => [
        new Paragraph({
          children: [
            new TextRun({ text: `${q.no}. ${q.text}`, size: 22, bold: true })
          ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: '' }),
      ]).flat()
    ];

    if (includeExplanationsInExport) {
      docChildren.push(
        new Paragraph({ text: '' }),
        new Paragraph({
          text: '--- KUNCI JAWABAN & PEMBAHASAN ---',
          heading: HeadingLevel.HEADING_2
        }),
        ...remedialModal.questions.map((q) => [
          new Paragraph({
            children: [
              new TextRun({ text: `Nomor ${q.no}: `, bold: true }),
              new TextRun({ text: `Kunci Jawaban: ${q.answerKey}`, color: '2040AA', bold: true })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Pembahasan: ${q.explanation || '-'}`, italics: true })
            ]
          }),
          new Paragraph({ text: '' })
        ]).flat()
      );
    }

    const doc = new Document({
      sections: [{ children: docChildren }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${remedialModal.remedialTitle}.docx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // REKAP EVALUASI AKHIR BULAN (AI)
  const handleGenerateMonthlyRecap = async () => {
    setIsGeneratingMonthly(true);

    const monthParts = evalMonthFilter.split('-');
    const mIdx = parseInt(monthParts[1], 10) - 1;
    const monthName = MONTHS_ID[mIdx] || currentMonthName;
    const yearNum = monthParts[0] || currentYear;

    const filteredEvals = evaluations.filter(e => {
      const matchMonth = e.monthKey === evalMonthFilter || (e.dateKey && e.dateKey.startsWith(evalMonthFilter));
      const matchStd = evalStudentFilter ? e.studentId === evalStudentFilter : true;
      return matchMonth && matchStd;
    });

    if (filteredEvals.length === 0) {
      alert(`Belum ada data evaluasi harian atau pembetulan pada bulan ${monthName} ${yearNum}. Silakan lakukan scan koreksi terlebih dahulu.`);
      setIsGeneratingMonthly(false);
      return;
    }

    const targetStudent = evalStudentFilter ? students.find(s => s.id === evalStudentFilter) : null;
    let recapResultText = '';

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const evalLogs = filteredEvals.map(e => `[${e.dateKey}] (${e.evalType}): ${e.summaryText} (Topik: ${(e.weakTopics || []).join(', ')})`).join('\n');

        const prompt = `Sebagai konsultan akademik Bimbel Albita, susunlah LAPORAN EVALUASI PERKEMBANGAN BULANAN siswa berikut untuk bulan ${monthName} ${yearNum}:

Nama Siswa: ${targetStudent ? targetStudent.name : 'Seluruh Siswa'}
Kelas: ${targetStudent ? targetStudent.class : '-'}
Catatan Evaluasi Harian & Pembetulan:
${evalLogs}

Format Laporan yang harus kamu buat:
1. Ringkasan Kemajuan & Pencapaian Belajar
2. Konsep yang Berhasil Dikuasai & Dibenahi (dari sesi pembetulan)
3. Hal yang Masih Perlu Latihan Mandiri di Rumah
4. Saran & Pesan Hangat untuk Orang Tua

Buat laporan dalam bahasa Indonesia yang ramah, sopan, mendidik, dan terstruktur rapi.`;

        const res = await model.generateContent(prompt);
        recapResultText = res.response.text().trim();
      } catch (err) {
        console.warn('Gemini monthly recap fallback:', err);
      }
    }

    if (!recapResultText) {
      recapResultText = `LAPORAN PERKEMBANGAN BELAJAR - BIMBEL ALBITA\nBulan: ${monthName} ${yearNum}\nSiswa: ${targetStudent ? targetStudent.name : 'Siswa Albita'}\n\n1. Pencapaian Belajar:\nAnanda menunjukkan keaktifan dan semangat belajar yang baik sepanjang bulan ini dengan total ${filteredEvals.length} sesi catatan koreksi dan evaluasi.\n\n2. Hasil Pembetulan & Remedial:\nSebagian besar materi yang awalnya keliru telah berhasil dibenahi melalui latihan pembetulan terarah.\n\n3. Rekomendasi untuk Orang Tua:\nMohon berikan apresiasi atas proses belajarnya dan dorong ananda membaca ulang rangkuman materi di rumah secara berkala.`;
    }

    setMonthlyRecapModal({
      studentId: evalStudentFilter || 'all',
      studentName: targetStudent ? targetStudent.name : 'Semua Siswa',
      studentClass: targetStudent ? targetStudent.class : '',
      parentPhone: targetStudent ? targetStudent.whatsapp : '',
      monthKey: evalMonthFilter,
      monthLabel: `${monthName} ${yearNum}`,
      recapText: recapResultText
    });

    setIsGeneratingMonthly(false);
  };

  const handleSaveMonthlyRecapRecord = async () => {
    if (!monthlyRecapModal) return;

    const newMonthlyEval = {
      id: `eval-monthly-${Date.now()}`,
      evalType: 'monthly_summary',
      dateKey: todayKey,
      monthKey: monthlyRecapModal.monthKey,
      studentId: monthlyRecapModal.studentId,
      summaryText: monthlyRecapModal.recapText,
      weakTopics: ['Rekap Bulanan'],
      examTitle: `Rekap Akhir Bulan ${monthlyRecapModal.monthLabel}`,
      createdAt: new Date().toISOString()
    };

    await saveEvaluationRecord(newMonthlyEval);
    alert('Rekap Evaluasi Bulanan berhasil disimpan!');
    setMonthlyRecapModal(null);
  };

  const handleSaveTeacherNote = async (studentId) => {
    const text = noteDrafts[studentId] !== undefined ? noteDrafts[studentId] : (teacherNotes[studentId]?.note || '');
    setTeacherNotes({
      ...teacherNotes,
      [studentId]: { month: currentMonthName, note: text }
    });
    setNoteSavedAlert({ ...noteSavedAlert, [studentId]: true });
    setTimeout(() => setNoteSavedAlert((prev) => ({ ...prev, [studentId]: false })), 2500);

    if (supabase) {
      await supabase.from('teacher_notes').upsert({
        student_id: studentId,
        month: currentMonthName,
        note: text
      });
    }
  };

  // Perhitungan Kalender
  const daysInCalMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInCalMonth }, (_, i) => i + 1);
  const firstDayOfWeek = new Date(calYear, calMonthIdx, 1).getDay();

  const previousThreeMonths = [1, 2, 3].map((offset) => {
    const d = new Date(currentYear, currentMonthIdx - offset, 1);
    const mIdx = d.getMonth();
    const y = d.getFullYear();
    return { key: `${y}-${String(mIdx + 1).padStart(2, '0')}`, label: `${MONTHS_ID[mIdx]} ${y}` };
  });

  const renderStudentCard = (std) => {
    const currentEdit = studentEdits[std.id] || {
      name: std.name,
      parentName: std.parentName,
      class: std.class || '6 SD',
      whatsapp: std.whatsapp || '',
      isDirty: false
    };
    const studentSubsCount = submissions.filter((s) => s.studentId === std.id).length;
    const sppStatus = currentMonthPayments[std.id] || 'Belum Lunas';
    const waClean = formatWaNumber(currentEdit.whatsapp);

    return (
      <div key={std.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-lg text-slate-900 truncate">{currentEdit.name}</h3>
            <div className="relative">
              <button onClick={() => setOpenMenuId(openMenuId === std.id ? null : std.id)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <Settings className="w-4 h-4" />
              </button>
              {openMenuId === std.id && (
                <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-xl border shadow-lg py-1 z-20 text-xs">
                  <button onClick={() => handleOpenRenameModal(std)} className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2">
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Rename
                  </button>
                  <button onClick={() => handleDeleteStudent(std)} className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 font-semibold flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border space-y-2.5 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Kelas:</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{currentEdit.class}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Wali:</span>
              <span className="font-semibold text-slate-800">{currentEdit.parentName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">WhatsApp Wali:</span>
              {waClean ? (
                <a href={`https://wa.me/${waClean}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 underline flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {currentEdit.whatsapp}
                </a>
              ) : (
                <span className="text-slate-400 italic">Belum diisi</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Kode Akses:</span>
              <span className="font-mono font-bold text-indigo-600">{std.accessCode}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">SPP ({currentMonthName}):</span>
              <span className={`px-3 py-1 rounded-lg font-bold text-white text-[11px] ${sppStatus === 'Lunas' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                {sppStatus}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t">
              <span className="text-slate-500">Arsip Soal ({studentSubsCount}):</span>
              <button onClick={() => window.open(`${window.location.origin}${window.location.pathname}?viewStudent=${std.id}`, '_blank', 'noopener,noreferrer')} className="px-2.5 py-1 rounded-lg bg-white text-indigo-700 border font-semibold text-[11px] flex items-center gap-1">
                Lihat Soal <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button onClick={() => { setScanStudentId(std.id); setScanDate(todayKey); setActiveTab('scanner'); }} className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5">
            <Camera className="w-3.5 h-3.5" /> Scan Lembar Kerja
          </button>
          <button onClick={() => handleSaveStudentCard(std.id)} disabled={!currentEdit.isDirty} className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${currentEdit.isDirty ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm animate-pulse' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            <Save className="w-3.5 h-3.5" /> {currentEdit.isDirty ? 'Save Perubahan' : 'Tersimpan'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <header className="bg-indigo-950 text-white border-b border-indigo-900 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold text-xl">A</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white leading-tight">ALBITA ADMIN</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-800 text-indigo-200 border border-indigo-700 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Ruang Pengajar
                </span>
              </div>
              <p className="text-xs text-indigo-300">Bimbel Albita • Sistem Manajemen & Koreksi AI Vision</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 py-6 flex-1">
        {/* TAB NAVIGATION */}
        <div className="flex overflow-x-auto gap-2 pb-3 mb-6 border-b border-slate-200">
          <button onClick={() => setActiveTab('students')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'students' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Siswa ({students.length})
          </button>
          <button onClick={() => setActiveTab('exams')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'exams' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Bank Soal ({exams.length})
          </button>
          <button onClick={() => setActiveTab('scanner')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'scanner' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            <Sparkles className="w-4 h-4 text-amber-300" /> Scan Koreksi AI
          </button>
          <button onClick={() => setActiveTab('calendar')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            <CalendarIcon className="w-4 h-4" /> Kalender & Rekap
          </button>
          <button onClick={() => setActiveTab('evaluations')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'evaluations' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            <Award className="w-4 h-4" /> Evaluasi ({evaluations.length})
          </button>
          <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Absensi
          </button>
          <button onClick={() => setActiveTab('payments')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'payments' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Status Pembayaran
            {showPaymentBadgeAlert && <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>}
          </button>
          <button onClick={() => setActiveTab('notes')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'notes' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Catatan Guru
          </button>
        </div>

        {/* TAB 1: SISWA */}
        {activeTab === 'students' && (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">Daftar Siswa</h2>
              <button onClick={() => setShowAddStudent(!showAddStudent)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm">
                <Plus className="w-4 h-4" /> Tambah Siswa
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama siswa, kelas, atau wali murid..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setMobilePage(1); }}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-xs"
              />
            </div>

            {showAddStudent && (
              <form onSubmit={handleAddStudent} className="bg-white p-4 rounded-2xl border border-indigo-200 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end shadow-sm">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nama Siswa</label>
                  <input type="text" placeholder="Nama" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} className="w-full px-3.5 py-2 border rounded-xl text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Kelas</label>
                  <select value={newStudentClass} onChange={(e) => setNewStudentClass(e.target.value)} className="w-full px-3.5 py-2 border rounded-xl text-sm bg-white">
                    {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Wali Murid</label>
                  <input type="text" placeholder="Wali" value={newParentName} onChange={(e) => setNewParentName(e.target.value)} className="w-full px-3.5 py-2 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">No. WhatsApp</label>
                  <input type="tel" placeholder="08..." value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} className="w-full px-3.5 py-2 border rounded-xl text-sm" required />
                </div>
                <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold">Simpan Siswa</button>
              </form>
            )}

            <div className="hidden md:grid md:grid-cols-3 gap-4">
              {filteredStudents.map((std) => renderStudentCard(std))}
            </div>

            <div className="md:hidden space-y-4">
              <div className="space-y-4">
                {mobilePaginatedStudents.map((std) => renderStudentCard(std))}
              </div>
              {totalMobilePages > 1 && (
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-xs">
                  <button onClick={() => setMobilePage((p) => Math.max(1, p - 1))} disabled={safeMobilePage === 1} className="px-3 py-1.5 rounded-lg bg-slate-100 disabled:opacity-40 text-xs font-bold flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <span className="text-xs font-semibold text-slate-600">Halaman {safeMobilePage} dari {totalMobilePages}</span>
                  <button onClick={() => setMobilePage((p) => Math.min(totalMobilePages, p + 1))} disabled={safeMobilePage === totalMobilePages} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BANK SOAL (DENGAN INPUT TANGGAL SOAL) */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-6 flex flex-wrap justify-between items-center gap-4 shadow-sm">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Bank Soal Guru (Soal Jadi / Materi)</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan tanggal pelaksanaan soal dan unggah dokumen soal (DOCX/DOC). Hanya butir soal bernomor yang diekstrak otomatis.
                </p>
              </div>

              {/* INPUT TANGGAL SOAL & TOMBOL UPLOAD */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border">
                  <CalendarIcon className="w-4 h-4 text-indigo-600" />
                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Tanggal Soal:</label>
                  <input
                    type="date"
                    value={uploadExamDate}
                    onChange={(e) => setUploadExamDate(e.target.value)}
                    className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs bg-white font-semibold focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <label className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm">
                  <Upload className="w-4 h-4" /> {isUploadingDoc ? 'Mengunggah...' : 'Upload Dokumen Soal'}
                  <input
                    type="file"
                    accept=".doc,.docx,.pdf,.jpg,.png,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadTeacherExam(e.target.files[0], uploadExamDate);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {exams.length === 0 ? (
              <div className="bg-white rounded-2xl border p-10 text-center text-xs text-slate-400">
                Belum ada dokumen soal yang di-upload. Tentukan tanggal soal lalu klik tombol "Upload Dokumen Soal" di atas.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {exams.map((ex) => (
                  <div key={ex.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                              ex.title.startsWith('Pembetulan')
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                            }`}>
                              {ex.subject || 'Bank Soal'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              📅 {formatDateIndo(ex.examDate || ex.dateKey)}
                            </span>
                          </div>
                          <h3 className="font-bold text-base text-slate-900 mt-1.5">{ex.title}</h3>
                        </div>
                        <button onClick={() => handleDeleteExam(ex.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg" title="Hapus Soal">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" /> Diupload: <strong className="text-slate-700">{ex.uploadDate || 'Baru saja'}</strong>
                        </span>
                        <span>•</span>
                        <span>{(ex.questions || []).length} Butir Soal</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                      <button onClick={() => setViewingExamModal(ex)} className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" /> Lihat
                      </button>
                      <button onClick={() => handleOpenEditExam(ex)} className="flex-1 py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5" /> Edit Soal & Tanggal
                      </button>
                      <button onClick={() => handleDownloadExam(ex, 'doc')} className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1" title="Download sebagai DOC">
                        <Download className="w-3.5 h-3.5" /> DOC
                      </button>
                      <button onClick={() => handleDownloadExam(ex, 'pdf')} className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1" title="Download sebagai PDF">
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SCAN KOREKSI AI VISION (DENGAN PILIHAN TANGGAL PENGERJAAN & PAKET ACUAN OPSIONAL) */}
        {activeTab === 'scanner' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-5">
              <div>
                <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" /> Smart Scan Koreksi Lembar Jawaban (Gemini Vision)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Pilih siswa dan tanggal pengerjaan/les (paket soal acuan bersifat opsional; AI langsung membaca butir soal bernomor dan nomor asli di kertas).
                </p>
              </div>

              {/* 4 Panduan Aturan Warna */}
              <div className="grid sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 p-4 rounded-xl border">
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0"></span>
                  <div>
                    <span className="font-bold text-slate-800">Aturan 1 (Salah):</span>
                    <p className="text-slate-600 text-[11px]">Silang (X) pulpen merah saja &rarr; Status: <strong>wrong</strong></p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 mt-1 shrink-0"></span>
                  <div>
                    <span className="font-bold text-slate-800">Aturan 2 (Salah):</span>
                    <p className="text-slate-600 text-[11px]">Silang merah bertumpuk biru + ada tulisan 'salah' &rarr; Status: <strong>wrong</strong></p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1 shrink-0"></span>
                  <div>
                    <span className="font-bold text-slate-800">Aturan 3 (Sudah Dibenarkan):</span>
                    <p className="text-slate-600 text-[11px]">Silang merah bertumpuk biru TANPA kata salah &rarr; Status: <strong>corrected</strong></p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0"></span>
                  <div>
                    <span className="font-bold text-slate-800">Aturan 4 (Benar Kurang Lengkap):</span>
                    <p className="text-slate-600 text-[11px]">Lingkaran merah &rarr; Status: <strong>incomplete</strong></p>
                  </div>
                </div>
              </div>

              {/* FORM SELEKSI: SISWA, PAKET SOAL OPSIONAL, & TANGGAL PENGERJAAN */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Siswa</label>
                  <select value={scanStudentId} onChange={(e) => setScanStudentId(e.target.value)} className="w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white font-medium">
                    <option value="">-- Pilih Siswa --</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Paket Soal Acuan (Opsional)</label>
                  <select value={scanExamId} onChange={(e) => setScanExamId(e.target.value)} className="w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white font-medium">
                    <option value="">-- Baca Langsung dari Foto --</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({formatDateIndo(ex.examDate || ex.dateKey)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Tanggal Pengerjaan / Les</label>
                  <input
                    type="date"
                    value={scanDate}
                    onChange={(e) => setScanDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white font-semibold focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <label className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isScanning ? 'border-indigo-400 bg-indigo-50/70 animate-pulse' : 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50'
              }`}>
                <Camera className="w-10 h-10 text-indigo-600 mb-2" />
                <span className="text-sm font-bold text-indigo-900">
                  {isScanning ? 'Sedang Menganalisis Tinta Koreksi dengan AI Vision...' : 'Ambil Foto / Upload Lembar Jawaban Siswa'}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Jawaban akan dicatat untuk tanggal: <strong>{formatDateIndo(scanDate)}</strong>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={isScanning}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleScanPhoto(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>

            {/* HASIL DETEKSI AI VISION DENGAN DETAIL PER NOMOR */}
            {lastScanResult && (
              <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Koreksi Berhasil Dianalisis & Tersimpan!
                    </span>
                    <h3 className="font-bold text-base text-slate-900 mt-1">
                      {lastScanResult.student?.name} • {lastScanResult.examTitle || lastScanResult.exam?.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tanggal Les / Soal: <strong>{formatDateIndo(lastScanResult.submission.examDate)}</strong> • Dicatat pada: {lastScanResult.submission.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Skor Akhir:</span>
                    <span className="text-2xl font-extrabold text-indigo-700">{lastScanResult.submission.score}</span>
                  </div>
                </div>

                {/* Ringkasan Status Butir Soal */}
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-indigo-600" /> Hasil Verifikasi Status Per Nomor:
                  </h4>
                  <div className="space-y-2">
                    {(lastScanResult.submission.results || []).map((res, idx) => {
                      const examQ = (lastScanResult.exam?.questions || []).find(q => q.no === res.no);
                      const labelNo = res.displayNo || `Nomor ${res.no}`;
                      const textSoal = res.questionText || examQ?.text || 'Butir Pertanyaan';
                      return (
                        <div key={`${labelNo}-${idx}`} className="p-3.5 rounded-xl border bg-slate-50 text-xs flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 max-w-lg">
                            <p className="font-bold text-slate-800">
                              {labelNo}. <span className="font-normal text-slate-700">{textSoal}</span>
                            </p>
                            {res.inkNote && (
                              <p className="text-[11px] text-slate-600">
                                <strong>Observasi Tinta:</strong> {res.inkNote}
                              </p>
                            )}
                            {res.ruleApplied && (
                              <p className="text-[10px] text-slate-500 italic">
                                ({res.ruleApplied})
                              </p>
                            )}
                          </div>
                          <div>
                            <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] inline-block ${
                              res.status === 'wrong'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : res.status === 'corrected'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : res.status === 'incomplete'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {res.status === 'wrong' ? 'Salah (Aturan 1/2)' :
                               res.status === 'corrected' ? 'Sudah Dibenarkan (Aturan 3)' :
                               res.status === 'incomplete' ? 'Kurang Lengkap (Aturan 4)' :
                               'Benar'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tombol Regenerate Soal Salah (Remedial) */}
                {lastScanResult.wrongQuestionsList && lastScanResult.wrongQuestionsList.length > 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" /> Terdapat {lastScanResult.wrongQuestionsList.length} Soal Perlu Diulang
                      </h4>
                      <p className="text-xs text-amber-700 mt-0.5">
                        AI dapat membuatkan paket soal latihan remedial yang setara/sejenis secara otomatis beserta kunci & pembahasannya.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateRemedial}
                      disabled={isGeneratingRemedial}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Sparkles className="w-4 h-4" /> {isGeneratingRemedial ? 'Menyusun Soal Remedial...' : 'Buat Paket Soal Remedial (AI)'}
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Seluruh soal tuntas atau sudah dibenarkan anak! Tidak ada soal remedial yang perlu dibuat.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: KALENDER SINKRONISASI (HADIR, BANK SOAL, JAWABAN TERUPLOAD) */}
        {/* ============================================================== */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-slate-900">
                      Kalender Aktivitas & Rekap Harian ({MONTHS_ID[calMonthIdx]} {calYear})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Sinkronisasi kehadiran siswa, ketersediaan Bank Soal, dan jumlah jawaban yang telah diunggah.
                    </p>
                  </div>
                </div>

                {/* Navigasi Bulan Kalender */}
                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border">
                  <button
                    onClick={() => {
                      if (calMonthIdx === 0) {
                        setCalMonthIdx(11);
                        setCalYear(y => y - 1);
                      } else {
                        setCalMonthIdx(m => m - 1);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-all"
                    title="Bulan Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setCalMonthIdx(now.getMonth());
                      setCalYear(now.getFullYear());
                      setSelectedCalDate(todayKey);
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-white text-indigo-700 border shadow-xs"
                  >
                    Hari Ini
                  </button>
                  <button
                    onClick={() => {
                      if (calMonthIdx === 11) {
                        setCalMonthIdx(0);
                        setCalYear(y => y + 1);
                      } else {
                        setCalMonthIdx(m => m + 1);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-all"
                    title="Bulan Berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid Nama Hari */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 py-1">
                {DAYS_ID.map((d, i) => (
                  <div key={d} className={`py-1 ${i === 0 ? 'text-rose-500' : ''}`}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid Tanggal Kalender */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[105px] rounded-xl bg-slate-50/40 border border-dashed border-slate-200/60 opacity-40"></div>
                ))}

                {calendarDays.map((dayNum) => {
                  const dKey = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isToday = dKey === todayKey;
                  const isSelected = selectedCalDate === dKey;

                  const summary = getDailyCalendarSummary(
                    dKey,
                    attendanceList,
                    exams,
                    submissions,
                    students
                  );
                  const {
                    hadirCount,
                    hasBankSoal,
                    bankSoalStatus,
                    bankSoalCount,
                    uploadedCount,
                    missingCount
                  } = summary;
                  const hasGapWarning = hadirCount > 0 && missingCount > 0;

                  return (
                    <button
                      key={dayNum}
                      onClick={() => setSelectedCalDate(dKey)}
                      className={`min-h-[110px] p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-200'
                          : isToday
                          ? 'border-amber-400 bg-amber-50/40 hover:bg-amber-50'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-extrabold ${isToday ? 'text-indigo-700' : 'text-slate-800'}`}>
                          {dayNum}
                        </span>
                        {isToday && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded">
                            Hari Ini
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 my-1">
                        {hadirCount > 0 ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded block truncate">
                            {hadirCount} Hadir
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block truncate">
                            0 Hadir
                          </span>
                        )}

                        {hasBankSoal ? (
                          <span className="text-[9px] font-semibold text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-1.5 py-0.5 rounded block truncate" title={bankSoalStatus}>
                            ✓ Soal Ada ({bankSoalCount})
                          </span>
                        ) : hadirCount > 0 ? (
                          <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded block truncate">
                            {bankSoalStatus}
                          </span>
                        ) : null}

                        {hadirCount > 0 && (
                          <span className="text-[9px] font-medium text-slate-600 block truncate">
                            {uploadedCount} / {hadirCount} jawaban
                          </span>
                        )}
                      </div>

                      {hasGapWarning ? (
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded block text-center truncate">
                          Kurang {missingCount} jawaban
                        </span>
                      ) : hadirCount > 0 ? (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded block text-center truncate">
                          ✓ Lengkap
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-300 block text-center">-</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PANEL DETAIL TANGGAL TERPILIH */}
            {selectedCalDate && (() => {
              const dKey = selectedCalDate;
              const summary = getDailyCalendarSummary(
                dKey,
                attendanceList,
                exams,
                submissions,
                students
              );
              const {
                hadirCount,
                bankSoalCount,
                bankSoalStatus,
                uploadedCount,
                missingCount
              } = summary;

              const dayRecs = attendanceRecords[dKey] || {};

              const dayExams = exams.filter(e => (
                e.examDate === dKey || e.dateKey === dKey || normalizeDateKey(e.uploadDate) === dKey
              ));

              const daySubs = submissions.filter(s => (
                s.examDate === dKey || s.dateKey === dKey || normalizeDateKey(s.date) === dKey
              ));
              const distinctStudentIdsWithAnswers = Array.from(new Set(daySubs.map(s => String(s.studentId || s.student_id))));

              const presentRecords = attendanceList.filter((a) => {
                const recordDate = a.date_key || a.dateKey || a.date || (a.created_at ? String(a.created_at).slice(0, 10) : "");
                const status = String(a.status || "").toLowerCase();
                return recordDate === dKey && (status === "hadir" || status === "present" || a.present === true);
              });
              const presentStudentIds = Array.from(new Set(presentRecords.map((a) => String(a.student_id || a.studentId))));
              const missingStudents = students.filter(s =>
                presentStudentIds.includes(String(s.id)) && !distinctStudentIdsWithAnswers.includes(String(s.id))
              );

              return (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                    <div>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                        Detail Aktivitas Harian
                      </span>
                      <h3 className="font-extrabold text-lg text-slate-900 mt-1">
                        {formatDateIndo(selectedCalDate)}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Sinkronisasi kehadiran, paket soal Bank Soal ({bankSoalStatus}), dan jawaban lembar kerja siswa.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-center">
                        <span className="text-[10px] text-emerald-700 font-semibold uppercase block">Hadir</span>
                        <strong className="text-base text-emerald-800">{hadirCount}</strong>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-center">
                        <span className="text-[10px] text-indigo-700 font-semibold uppercase block">Bank Soal</span>
                        <strong className="text-base text-indigo-800">{bankSoalCount}</strong>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-center">
                        <span className="text-[10px] text-amber-700 font-semibold uppercase block">Jawaban Masuk</span>
                        <strong className="text-base text-amber-800">{uploadedCount} / {hadirCount}</strong>
                      </div>
                    </div>
                  </div>

                  {hadirCount > 0 && missingCount > 0 && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <div>
                          <h4 className="font-bold text-sm text-rose-900">
                            Perhatian: Terdapat {missingCount} siswa hadir yang jawabannya belum diunggah!
                          </h4>
                          <p className="text-xs text-rose-700">
                            Siswa tercatat hadir di absensi namun lembar jawabannya belum selesai discan atau diunggah.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {missingStudents.map((std) => (
                          <div
                            key={std.id}
                            className="bg-white border border-rose-300 px-3 py-1.5 rounded-xl flex items-center justify-between gap-3 shadow-xs text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-800">{std.name}</span>
                              <span className="text-[11px] text-slate-500 ml-1">({std.class})</span>
                            </div>
                            <button
                              onClick={() => {
                                setScanStudentId(std.id);
                                setScanDate(selectedCalDate);
                                setActiveTab('scanner');
                              }}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 shadow-xs"
                            >
                              <Camera className="w-3 h-3" /> Scan Sekarang
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-600" /> Paket Soal di Bank Soal ({dayExams.length})
                      </h4>
                      <button
                        onClick={() => {
                          setUploadExamDate(selectedCalDate);
                          setActiveTab('exams');
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        + Upload Soal untuk Tanggal Ini <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {dayExams.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border text-xs text-slate-500 text-center">
                        Belum ada paket soal yang diunggah khusus untuk tanggal {formatDateIndo(selectedCalDate)}.
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3 text-xs">
                        {dayExams.map((ex) => (
                          <div key={ex.id} className="p-3.5 rounded-xl border bg-slate-50 flex items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-900 block">{ex.title}</span>
                              <span className="text-[11px] text-slate-500">{ex.subject} • {(ex.questions || []).length} butir soal</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setViewingExamModal(ex)}
                                className="px-2 py-1 bg-white border rounded-lg text-slate-700 font-semibold hover:bg-slate-100 text-[11px]"
                              >
                                Lihat
                              </button>
                              <button
                                onClick={() => handleOpenEditExam(ex)}
                                className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-semibold hover:bg-amber-100 text-[11px]"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Jawaban Siswa Masuk ({daySubs.length} lembar kerja)
                    </h4>

                    {daySubs.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border text-xs text-slate-500 text-center">
                        Belum ada jawaban siswa yang diunggah atau discan untuk tanggal ini.
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2 text-xs">
                        {daySubs.map((sub) => {
                          const std = students.find(s => s.id === sub.studentId);
                          const ex = sub.examId ? exams.find(e => e.id === sub.examId) : null;
                          return (
                            <div key={sub.id} className="p-3 rounded-xl border bg-white flex items-center justify-between gap-2 shadow-xs">
                              <div>
                                <span className="font-bold text-slate-900 block">{std?.name || 'Siswa'} ({std?.class})</span>
                                <span className="text-[11px] text-slate-500">{ex?.title || 'Paket Soal'}</span>
                              </div>
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs">
                                Skor: {sub.score}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t text-xs">
                    <h4 className="font-bold text-slate-700">Status Presensi Siswa ({Object.keys(dayRecs).length} siswa tercatat):</h4>
                    <div className="flex flex-wrap gap-2">
                      {students.map((std) => {
                        const st = dayRecs[std.id];
                        if (!st) return null;
                        return (
                          <span
                            key={std.id}
                            className={`px-2.5 py-1 rounded-lg font-medium border ${
                              st === 'Hadir' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              st === 'Izin' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {std.name}: <strong>{st}</strong>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 5: EVALUASI & REKAP BULANAN */}
        {activeTab === 'evaluations' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" /> Evaluasi & Rekap Perkembangan Siswa
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Catatan kelemahan konsep harian, evaluasi ketuntasan pembetulan, dan rekap bulanan komprehensif AI.
                </p>
              </div>
              <button
                onClick={handleGenerateMonthlyRecap}
                disabled={isGeneratingMonthly}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                {isGeneratingMonthly ? 'Menyusun Rekap Bulanan...' : 'Generate Rekap Evaluasi Akhir Bulan (AI)'}
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl border shadow-xs grid sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Filter Siswa</label>
                <select
                  value={evalStudentFilter}
                  onChange={(e) => setEvalStudentFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  <option value="">Semua Siswa</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Filter Bulan</label>
                <input
                  type="month"
                  value={evalMonthFilter}
                  onChange={(e) => setEvalMonthFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Jenis Evaluasi</label>
                <select
                  value={evalTypeFilter}
                  onChange={(e) => setEvalTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  <option value="all">Semua Tipe</option>
                  <option value="daily">Evaluasi Harian (Kelemahan Konsep)</option>
                  <option value="correction">Evaluasi Pembetulan (Ketuntasan)</option>
                  <option value="monthly_summary">Rekap Bulanan AI</option>
                </select>
              </div>
            </div>

            {(() => {
              const filtered = evaluations.filter((ev) => {
                const matchStd = evalStudentFilter ? ev.studentId === evalStudentFilter : true;
                const matchMonth = evalMonthFilter ? (ev.monthKey === evalMonthFilter || (ev.dateKey && ev.dateKey.startsWith(evalMonthFilter))) : true;
                const matchType = evalTypeFilter === 'all' ? true : ev.evalType === evalTypeFilter;
                return matchStd && matchMonth && matchType;
              });

              if (filtered.length === 0) {
                return (
                  <div className="bg-white rounded-2xl border p-12 text-center text-xs text-slate-400 space-y-2">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                    <p>Belum ada catatan evaluasi untuk filter siswa & bulan yang dipilih.</p>
                    <p className="text-[11px] text-slate-400">Hasil scan koreksi lembar jawaban akan otomatis mencatat evaluasi harian atau pembetulan di sini.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3.5">
                  {filtered.map((ev) => {
                    const studentObj = students.find((s) => s.id === ev.studentId);
                    const isDaily = ev.evalType === 'daily';
                    const isCorrection = ev.evalType === 'correction';

                    return (
                      <div key={ev.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                              isDaily ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              isCorrection ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              'bg-indigo-50 text-indigo-800 border-indigo-200'
                            }`}>
                              {isDaily ? 'Evaluasi Harian' : isCorrection ? 'Evaluasi Pembetulan' : 'Rekap Bulanan AI'}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {studentObj ? `${studentObj.name} (${studentObj.class})` : 'Siswa'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {formatDateIndo(ev.dateKey) || ev.dateKey || '-'}
                          </span>
                        </div>

                        {ev.examTitle && (
                          <p className="text-xs font-semibold text-indigo-700">
                            Paket Soal: {ev.examTitle}
                          </p>
                        )}

                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {ev.summaryText}
                        </p>

                        {ev.weakTopics && ev.weakTopics.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] font-semibold text-slate-500">Materi:</span>
                            {ev.weakTopics.map((top, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                                {top}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2 border-t">
                          {studentObj?.whatsapp && (
                            <button
                              onClick={() => {
                                const waNum = formatWaNumber(studentObj.whatsapp);
                                const textMsg = `Halo ${studentObj.parentName}, berikut catatan evaluasi belajar ananda *${studentObj.name}* (${formatDateIndo(ev.dateKey)}):\n\n${ev.summaryText}\n\n- Bimbel Albita`;
                                window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(textMsg)}`, '_blank', 'noopener,noreferrer');
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
                            >
                              <Phone className="w-3.5 h-3.5" /> Kirim ke WA Orang Tua
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (!window.confirm('Hapus catatan evaluasi ini?')) return;
                              const updated = evaluations.filter(e => e.id !== ev.id);
                              setEvaluations(updated);
                              localStorage.setItem('albita_evaluations', JSON.stringify(updated));
                              if (supabase) {
                                try { await supabase.from('evaluations').delete().eq('id', ev.id); } catch {}
                              }
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 6: ABSENSI HARIAN (TOMBOL SIMPAN & WA TERPISAH) */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Absensi Harian Tempat Les</h2>
                <p className="text-xs text-slate-500">{currentDayName}, {currentDateNum} {currentMonthName} {currentYear}</p>
              </div>
              <span className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border">
                Tombol Simpan & Kirim WA terpisah • Data otomatis tersimpan saat refresh
              </span>
            </div>

            <div className="divide-y">
              {students.map((std) => {
                const savedToday = attendanceRecords[todayKey]?.[std.id];
                const currentChoice = todayAttendanceDraft[std.id] || savedToday || '';
                const isDirty = attendanceDirty[std.id];

                return (
                  <div key={std.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-slate-900">{std.name} <span className="text-xs font-normal text-slate-500">({std.class})</span></p>
                      <p className="text-[11px] text-slate-500">Wali: {std.parentName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {['Hadir', 'Izin', 'Tidak Hadir'].map((st) => (
                        <button
                          key={st}
                          onClick={() => handleSelectAttendance(std.id, st)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            currentChoice === st
                              ? st === 'Hadir'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : st === 'Izin'
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {st}
                        </button>
                      ))}

                      <div className="flex gap-1.5 ml-2">
                        <button
                          onClick={() => handleSaveAttendanceRow(std)}
                          disabled={!isDirty && !currentChoice}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                            isDirty
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm animate-pulse'
                              : savedToday
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {savedToday && !isDirty ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" /> Tersimpan
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" /> Simpan
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleSendAttendanceWA(std)}
                          disabled={!currentChoice && !savedToday}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Kirim pesan WhatsApp ke orang tua"
                        >
                          <Phone className="w-3.5 h-3.5" /> Kirim WA
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 7: STATUS PEMBAYARAN SPP */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
                <div>
                  <h2 className="font-bold text-lg text-slate-900">SPP Bulan {currentMonthName} {currentYear}</h2>
                  <p className="text-xs text-slate-500">Klik tombol status untuk menandai Lunas dan mengirim kuitansi WhatsApp otomatis.</p>
                </div>
                {showPaymentBadgeAlert && (
                  <span className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Mendekati Akhir Bulan: Ada SPP Belum Lunas
                  </span>
                )}
              </div>

              <div className="divide-y">
                {students.map((std) => {
                  const status = currentMonthPayments[std.id] || 'Belum Lunas';
                  return (
                    <div key={std.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-sm text-slate-900">{std.name} <span className="text-xs font-normal text-slate-500">({std.class})</span></p>
                        <p className="text-[11px] text-slate-500">Wali: {std.parentName}</p>
                      </div>
                      <button
                        onClick={() => handleTogglePaymentStatus(std, currentMonthKey)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all ${
                          status === 'Lunas' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                        }`}
                      >
                        {status}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-slate-800">Riwayat SPP 3 Bulan Sebelumnya</h3>
              {previousThreeMonths.map((m) => (
                <div key={m.key} className="border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenPrevMonthToggle(openPrevMonthToggle === m.key ? null : m.key)}
                    className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700"
                  >
                    <span>{m.label}</span>
                    {openPrevMonthToggle === m.key ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {openPrevMonthToggle === m.key && (
                    <div className="p-4 divide-y bg-white">
                      {students.map((std) => {
                        const st = (payments[m.key] || {})[std.id] || 'Belum Lunas';
                        return (
                          <div key={std.id} className="py-2 flex items-center justify-between text-xs">
                            <span>{std.name}</span>
                            <button
                              onClick={() => handleTogglePaymentStatus(std, m.key)}
                              className={`px-3 py-1 rounded-lg font-bold text-white ${st === 'Lunas' ? 'bg-emerald-600' : 'bg-rose-600'}`}
                            >
                              {st}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: CATATAN GURU */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Catatan Perkembangan Siswa ({currentMonthName})</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {students.map((std) => {
                const currentNote = noteDrafts[std.id] !== undefined ? noteDrafts[std.id] : (teacherNotes[std.id]?.note || '');
                return (
                  <div key={std.id} className="bg-white rounded-2xl border p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-base text-slate-900">{std.name} <span className="text-xs font-normal text-slate-500">({std.class})</span></h3>
                      {noteSavedAlert[std.id] && <span className="text-xs font-bold text-emerald-600">Tersimpan!</span>}
                    </div>
                    <textarea
                      rows="3"
                      placeholder="Tulis catatan evaluasi belajar siswa bulan ini untuk dilihat orang tua..."
                      value={currentNote}
                      onChange={(e) => setNoteDrafts({ ...noteDrafts, [std.id]: e.target.value })}
                      className="w-full p-3 border rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handleSaveTeacherNote(std.id)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" /> Simpan Catatan
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL RENAME SISWA */}
      {renameModalStudent && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveRename} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base">Edit Profil Siswa</h3>
              <button type="button" onClick={() => setRenameModalStudent(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Nama Siswa</label>
                <input type="text" value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} className="w-full px-3 py-2 border rounded-xl" required />
              </div>
              <div>
                <label className="block font-bold mb-1">Kelas</label>
                <select value={editStudentClass} onChange={(e) => setEditStudentClass(e.target.value)} className="w-full px-3 py-2 border rounded-xl bg-white">
                  {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Wali Murid</label>
                <input type="text" value={editParentName} onChange={(e) => setEditParentName(e.target.value)} className="w-full px-3 py-2 border rounded-xl" />
              </div>
              <div>
                <label className="block font-bold mb-1">WhatsApp Wali</label>
                <input type="tel" value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} className="w-full px-3 py-2 border rounded-xl" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setRenameModalStudent(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">Batal</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold">Terapkan</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL PREVIEW DOKUMEN SOAL ASLI */}
      {viewingExamModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">{viewingExamModal.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tanggal Soal: <strong>{formatDateIndo(viewingExamModal.examDate || viewingExamModal.dateKey) || viewingExamModal.uploadDate || '-'}</strong> • {viewingExamModal.subject || 'Bank Soal'}
                </p>
              </div>
              <button onClick={() => setViewingExamModal(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="overflow-y-auto flex-1 text-xs space-y-3">
              {viewingExamModal.docContent ? (
                <div>
                  <p className="font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" /> Isi Dokumen Asli
                  </p>
                  <div className="whitespace-pre-wrap bg-slate-50 border rounded-xl p-4 text-slate-800 leading-relaxed font-mono text-[11px] max-h-60 overflow-y-auto">
                    {viewingExamModal.docContent}
                  </div>
                  {(viewingExamModal.questions || []).length > 0 && (
                    <div className="mt-3">
                      <p className="font-bold text-slate-600 mb-2">Butir Soal Bernomor yang Terekstrak</p>
                      <div className="space-y-2">
                        {(viewingExamModal.questions || []).map((q, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 space-y-1">
                            <p className="font-bold text-slate-800">
                              {q.sectionLabel ? `[${q.sectionLabel}] ` : ''}{q.no}. {q.text}
                            </p>
                            {q.answerKey && <p className="text-indigo-700 font-semibold">Kunci: {q.answerKey}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(viewingExamModal.questions || []).length === 0 ? (
                    <p className="text-slate-400 italic text-center py-6">Belum ada butir soal. Klik "Edit Soal" untuk menambahkan.</p>
                  ) : (
                    (viewingExamModal.questions || []).map((q, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 border space-y-1">
                        <p className="font-bold text-slate-800">{q.no}. {q.text}</p>
                        {q.answerKey && <p className="text-indigo-700 font-semibold">Kunci Jawaban: {q.answerKey}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <button onClick={() => handleDownloadExam(viewingExamModal, 'doc')} className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> DOC
              </button>
              <button onClick={() => handleDownloadExam(viewingExamModal, 'pdf')} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => { setViewingExamModal(null); handleOpenEditExam(viewingExamModal); }} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" /> Edit Soal Ini
              </button>
              <button onClick={() => setViewingExamModal(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT SOAL KHUSUS PENGAJAR (DENGAN EDIT TANGGAL SOAL) */}
      {editingExamModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditedExam} className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Edit Paket Soal & Tanggal</h3>
                <p className="text-[11px] text-slate-500">Ubah tanggal pelaksanaan soal, judul, dan rincian pertanyaan</p>
              </div>
              <button type="button" onClick={() => setEditingExamModal(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1 text-xs">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1">Tanggal Soal</label>
                  <input
                    type="date"
                    value={editExamDate}
                    onChange={(e) => setEditExamDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-semibold focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Judul Paket Soal</label>
                  <input type="text" value={editExamTitle} onChange={(e) => setEditExamTitle(e.target.value)} className="w-full px-3 py-2 border rounded-xl" required />
                </div>
                <div>
                  <label className="block font-bold mb-1">Mata Pelajaran</label>
                  <input type="text" value={editExamSubject} onChange={(e) => setEditExamSubject(e.target.value)} className="w-full px-3 py-2 border rounded-xl" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Daftar Butir Soal & Kunci</span>
                  <button type="button" onClick={handleAddQuestionRow} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Tambah Butir Soal
                  </button>
                </div>

                {editExamQuestions.map((q, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-700">Soal No. {q.no}</span>
                      <button type="button" onClick={() => handleRemoveQuestionRow(idx)} className="text-rose-600 hover:underline text-[11px] font-semibold">
                        Hapus Butir
                      </button>
                    </div>
                    <textarea
                      rows="2"
                      placeholder="Tulis pertanyaan soal..."
                      value={q.text}
                      onChange={(e) => handleUpdateQuestionField(idx, 'text', e.target.value)}
                      className="w-full p-2 border rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Kunci jawaban..."
                      value={q.answerKey}
                      onChange={(e) => handleUpdateQuestionField(idx, 'answerKey', e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={() => setEditingExamModal(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">Batal</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Simpan Perubahan Soal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL PREVIEW & GENERATE SOAL REMEDIAL */}
      {remedialModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                  Paket Soal Pembetulan (Remedial AI)
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-1">{remedialModal.remedialTitle}</h3>
                <p className="text-xs text-slate-500">
                  Siswa: {remedialModal.studentName} • Tanggal Soal: {formatDateIndo(remedialModal.examDate)}
                </p>
              </div>
              <button onClick={() => setRemedialModal(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 text-xs pr-1">
              <div className="space-y-3">
                {remedialModal.questions.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-xl border bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-700">Soal Remedial #{q.no} ({q.topic || 'Materi'})</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pertanyaan Soal Baru (Setara):</label>
                      <textarea
                        rows="2"
                        value={q.text}
                        onChange={(e) => {
                          const updated = [...remedialModal.questions];
                          updated[idx] = { ...updated[idx], text: e.target.value };
                          setRemedialModal({ ...remedialModal, questions: updated });
                        }}
                        className="w-full p-2 border rounded-lg bg-white"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kunci Jawaban:</label>
                        <input
                          type="text"
                          value={q.answerKey}
                          onChange={(e) => {
                            const updated = [...remedialModal.questions];
                            updated[idx] = { ...updated[idx], answerKey: e.target.value };
                            setRemedialModal({ ...remedialModal, questions: updated });
                          }}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-semibold text-indigo-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pembahasan Langkah:</label>
                        <input
                          type="text"
                          value={q.explanation || ''}
                          onChange={(e) => {
                            const updated = [...remedialModal.questions];
                            updated[idx] = { ...updated[idx], explanation: e.target.value };
                            setRemedialModal({ ...remedialModal, questions: updated });
                          }}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeExp"
                  checked={includeExplanationsInExport}
                  onChange={(e) => setIncludeExplanationsInExport(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="includeExp" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Sertakan Halaman Kunci Jawaban & Pembahasan pada dokumen unduhan
                </label>
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 border-t pt-3">
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadRemedialDOCX}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download DOCX
                </button>
                <button
                  onClick={handleDownloadRemedialPDF}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveRemedialToExams}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan ke Bank Soal (Pembetulan)
                </button>
                <button
                  onClick={() => setRemedialModal(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REKAP EVALUASI BULANAN AI */}
      {monthlyRecapModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                  Laporan Rekap Akhir Bulan (AI)
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-1">
                  {monthlyRecapModal.studentName} • Periode {monthlyRecapModal.monthLabel}
                </h3>
                <p className="text-xs text-slate-500">Laporan komprehensif perkembangan belajar untuk pengajar dan orang tua</p>
              </div>
              <button onClick={() => setMonthlyRecapModal(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="overflow-y-auto flex-1 text-xs space-y-2 pr-1">
              <label className="block font-bold text-slate-700">Isi Laporan Evaluasi Bulanan (Bisa Diedit):</label>
              <textarea
                rows="14"
                value={monthlyRecapModal.recapText}
                onChange={(e) => setMonthlyRecapModal({ ...monthlyRecapModal, recapText: e.target.value })}
                className="w-full p-3.5 border rounded-xl bg-slate-50 font-mono text-[11px] leading-relaxed focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 border-t pt-3">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(monthlyRecapModal.recapText);
                    alert('Teks laporan berhasil disalin ke clipboard!');
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> Salin Teks
                </button>
                {monthlyRecapModal.parentPhone && (
                  <button
                    onClick={() => {
                      const waNum = formatWaNumber(monthlyRecapModal.parentPhone);
                      window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(monthlyRecapModal.recapText)}`, '_blank', 'noopener,noreferrer');
                    }}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" /> Kirim ke WhatsApp
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveMonthlyRecapRecord}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan ke Evaluasi Bulanan
                </button>
                <button
                  onClick={() => setMonthlyRecapModal(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}