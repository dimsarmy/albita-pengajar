import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  Download
} from 'lucide-react';

// Koneksi Supabase dari Vercel Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

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
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [payments, setPayments] = useState({});
  const [teacherNotes, setTeacherNotes] = useState({});

  // Sinkronisasi data real-time dengan Supabase Cloud Database
  useEffect(() => {
    if (!supabase) return;

    async function fetchAllData() {
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
        if (exms) setExams(exms);

        const { data: subs } = await supabase.from('submissions').select('*');
        if (subs) setSubmissions(subs.map(sub => ({
          id: sub.id,
          studentId: sub.student_id,
          examId: sub.exam_id,
          date: sub.date,
          score: sub.score,
          results: sub.results
        })));

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
      } catch (err) {
        console.error('Gagal mengambil data Supabase:', err);
      }
    }

    fetchAllData();
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

  const [viewingExamModal, setViewingExamModal] = useState(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [scanStudentId, setScanStudentId] = useState('');
  const [scanExamId, setScanExamId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);

  const [todayAttendanceDraft, setTodayAttendanceDraft] = useState({});
  const [attendanceDirty, setAttendanceDirty] = useState({});
  const [selectedCalDate, setSelectedCalDate] = useState(null);

  const [openPrevMonthToggle, setOpenPrevMonthToggle] = useState(null);
  const [openYearlyRecap, setOpenYearlyRecap] = useState(false);
  const [selectedRecapMonth, setSelectedRecapMonth] = useState(null);

  const [noteDrafts, setNoteDrafts] = useState({});
  const [noteSavedAlert, setNoteSavedAlert] = useState({});

  if (viewStudentParam) {
    const targetStudent = students.find((s) => s.id === viewStudentParam);
    const studentSubs = submissions.filter((sub) => sub.studentId === viewStudentParam);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-indigo-950 text-white py-4 px-4 shadow-sm sticky top-0 z-20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-indigo-300 font-semibold">Arsip Soal Dikerjakan</span>
              <h1 className="font-bold text-lg">{targetStudent?.name} ({targetStudent?.class})</h1>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-800 text-xs font-semibold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Lihat Saja
            </span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {studentSubs.length === 0 ? (
            <div className="bg-white rounded-2xl border p-8 text-center text-xs text-slate-500">
              Belum ada soal yang dikerjakan.
            </div>
          ) : (
            studentSubs.map((sub) => {
              const examDetail = exams.find((e) => e.id === sub.examId);
              if (!examDetail) return null;
              return (
                <div key={sub.id} className="bg-white rounded-2xl border p-5 shadow-sm space-y-3">
                  <div className="flex justify-between items-start border-b pb-3">
                    <div>
                      <span className="text-xs font-bold text-indigo-700">{examDetail.subject} • {sub.date}</span>
                      <h2 className="font-bold text-base text-slate-900">{examDetail.title}</h2>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-indigo-50 border text-indigo-800 font-bold text-xs">
                      Skor: {sub.score}
                    </span>
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

  const handleSelectAttendance = (studentId, status) => {
    setTodayAttendanceDraft({ ...todayAttendanceDraft, [studentId]: status });
    setAttendanceDirty({ ...attendanceDirty, [studentId]: true });
  };

  const handleSaveAttendanceRow = (student) => {
    const chosenStatus = todayAttendanceDraft[student.id];
    if (!chosenStatus) return;

    const updatedToday = { ...(attendanceRecords[todayKey] || {}), [student.id]: chosenStatus };
    setAttendanceRecords({ ...attendanceRecords, [todayKey]: updatedToday });
    setAttendanceDirty({ ...attendanceDirty, [student.id]: false });

    if (student.whatsapp) {
      const waNumber = formatWaNumber(student.whatsapp);
      let msg = `${student.name} sudah tiba di tempat les Albita (${currentDayName}, ${currentDateNum} ${currentMonthName} ${currentYear}).`;
      if (chosenStatus === 'Izin') msg = `${student.name} tercatat IZIN hari ini (${currentDayName}, ${currentDateNum} ${currentMonthName} ${currentYear}).`;
      if (chosenStatus === 'Tidak Hadir') msg = `${student.name} tercatat TIDAK HADIR hari ini (${currentDayName}, ${currentDateNum} ${currentMonthName} ${currentYear}).`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
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

  const handleUploadTeacherExam = async (fileName) => {
    setIsUploadingDoc(true);
    const newExam = {
      id: `exam-${Date.now()}`,
      title: fileName ? fileName.replace(/\.(doc|docx|pdf|jpg|png)$/i, '').replace(/_/g, ' ') : 'Soal Jadi Pengajar',
      fileName: fileName || 'Soal_Baru.docx',
      uploadDate: `${currentDateNum} ${currentMonthName.slice(0, 3)} ${currentYear}`,
      subject: 'Bank Soal Guru',
      questions: [
        { no: 1, text: 'Contoh butir pertanyaan soal jadi pengajar...', answerKey: 'Kunci Jawaban', topic: 'Materi' }
      ]
    };

    setExams([newExam, ...exams]);
    setIsUploadingDoc(false);

    if (supabase) {
      await supabase.from('exams').insert({
        id: newExam.id,
        title: newExam.title,
        file_name: newExam.fileName,
        upload_date: newExam.uploadDate,
        subject: newExam.subject,
        questions: newExam.questions
      });
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Hapus paket soal ini dari Bank Soal?')) return;
    setExams(exams.filter((e) => e.id !== examId));
    if (supabase) {
      await supabase.from('exams').delete().eq('id', examId);
    }
  };

  const handleDownloadExam = (exam) => {
    const content = `=== SOAL ALBITA ===\nJudul: ${exam.title}\nTanggal: ${exam.uploadDate}\n\nButir Soal:\n` +
      exam.questions.map((q) => `${q.no}. ${q.text} (Kunci: ${q.answerKey})`).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exam.fileName || 'Soal_Albita'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleScanPhoto = async () => {
    setIsScanning(true);
    setLastScanResult(null);
    const targetExam = exams.find((e) => e.id === scanExamId) || exams[0];

    setTimeout(async () => {
      const generatedResults = targetExam.questions.map((q, idx) => ({
        no: q.no,
        status: idx === 1 ? 'wrong' : 'correct',
        inkNote: idx === 1 ? 'Perlu koreksi ulang' : 'Jawaban benar'
      }));

      const correctCount = generatedResults.filter((r) => r.status === 'correct').length;
      const calcScore = Math.round((correctCount / targetExam.questions.length) * 100);

      const newSub = {
        id: `sub-${Date.now()}`,
        studentId: scanStudentId,
        examId: targetExam.id,
        date: `${currentDateNum} ${currentMonthName.slice(0, 3)} ${currentYear}`,
        score: calcScore,
        results: generatedResults
      };

      setSubmissions([newSub, ...submissions]);
      setLastScanResult({
        student: students.find((s) => s.id === scanStudentId),
        exam: targetExam,
        submission: newSub
      });
      setIsScanning(false);

      if (supabase) {
        await supabase.from('submissions').insert({
          id: newSub.id,
          student_id: newSub.studentId,
          exam_id: newSub.examId,
          date: newSub.date,
          score: newSub.score,
          results: newSub.results
        });
      }
    }, 700);
  };

  const daysInCurrentMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

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
          <button onClick={() => { setScanStudentId(std.id); setActiveTab('scanner'); }} className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5">
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
              <p className="text-xs text-indigo-300">Manajemen Siswa (Supabase Cloud Sync)</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 py-6 flex-1">
        <div className="flex overflow-x-auto gap-2 pb-3 mb-6 border-b border-slate-200">
          <button onClick={() => setActiveTab('students')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'students' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Siswa ({students.length})
          </button>
          <button onClick={() => setActiveTab('exams')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'exams' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Bank Soal ({exams.length})
          </button>
          <button onClick={() => setActiveTab('scanner')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'scanner' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Scan Koreksi
          </button>
          <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Absensi
          </button>
          <button onClick={() => setActiveTab('calendar')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Kalender
          </button>
          <button onClick={() => setActiveTab('payments')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'payments' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Status Pembayaran
            {showPaymentBadgeAlert && <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>}
          </button>
          <button onClick={() => setActiveTab('notes')} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'notes' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}>
            Catatan Guru
          </button>
        </div>

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

        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-6 flex flex-wrap justify-between items-center gap-4 shadow-sm">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Bank Soal Guru (Soal Jadi / Materi)</h2>
                <p className="text-xs text-slate-500">Upload dokumen soal atau foto soal jadi buatanmu sendiri.</p>
              </div>
              <label className="cursor-pointer px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm">
                <Upload className="w-4 h-4" /> {isUploadingDoc ? 'Mengupload...' : 'Upload Document / Foto Soal'}
                <input type="file" accept=".doc,.docx,.pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadTeacherExam(f.name); }} />
              </label>
            </div>

            <div className="space-y-3">
              {exams.map((ex) => (
                <div key={ex.id} className="bg-white rounded-2xl border p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-600">{ex.subject} • {ex.upload_date || ex.uploadDate}</span>
                    <h3 className="font-bold text-sm text-slate-900">{ex.title}</h3>
                    <p className="text-xs text-slate-400">File: {ex.file_name || ex.fileName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewingExamModal(ex)} className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button onClick={() => handleDownloadExam(ex)} className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                    <button onClick={() => handleDeleteExam(ex.id)} className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white rounded-2xl border p-5 space-y-4 shadow-sm h-fit">
              <h2 className="font-bold text-base flex items-center gap-2 text-slate-900">
                <Camera className="w-5 h-5 text-indigo-600" /> Scan Koreksi Lembar Kerja
              </h2>
              <div>
                <label className="block text-xs font-semibold mb-1">Pilih Siswa</label>
                <select value={scanStudentId} onChange={(e) => setScanStudentId(e.target.value)} className="w-full p-2.5 rounded-xl border text-sm bg-white">
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Pilih Paket Soal</label>
                <select value={scanExamId} onChange={(e) => setScanExamId(e.target.value)} className="w-full p-2.5 rounded-xl border text-sm bg-white">
                  {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                </select>
              </div>
              <label className="cursor-pointer w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm">
                <Camera className="w-4 h-4" /> Ambil Foto / Upload Gambar
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScanPhoto(); }} />
              </label>
              <button onClick={() => handleScanPhoto()} disabled={isScanning} className="w-full py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold">
                {isScanning ? 'Menganalisis...' : 'Simulasi Scan Koreksi'}
              </button>
            </div>

            <div className="lg:col-span-7">
              {lastScanResult ? (
                <div className="bg-white rounded-2xl border border-indigo-200 p-5 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h3 className="font-bold text-base">{lastScanResult.student?.name}</h3>
                      <p className="text-xs text-slate-500">{lastScanResult.exam?.title}</p>
                    </div>
                    <div className="text-xl font-extrabold text-indigo-600">Skor: {lastScanResult.submission.score}</div>
                  </div>
                  <div className="space-y-2">
                    {lastScanResult.submission.results.map((r) => (
                      <div key={r.no} className={`p-3 rounded-xl border text-xs ${r.status === 'correct' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                        <div className="font-bold">Soal No. {r.no} — {r.inkNote}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border p-8 text-center text-slate-400 text-xs">
                  Hasil scan koreksi akan muncul di sini dan tersimpan ke arsip siswa.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-5">
            <div className="bg-indigo-900 text-white p-5 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">Formulir Kehadiran Harian</span>
                <h2 className="text-xl font-bold mt-0.5">
                  Absensi Hari Ini: {currentDayName}, {currentDateNum} {currentMonthName} {currentYear}
                </h2>
              </div>
              <span className="px-3 py-1 rounded-xl bg-indigo-800 text-xs font-semibold border border-indigo-700">
                Otomatis Notifikasi WA Wali
              </span>
            </div>

            <div className="bg-white rounded-2xl border divide-y divide-slate-100 shadow-sm">
              {students.map((std) => {
                const selectedStatus = todayAttendanceDraft[std.id] || '';
                const isRowDirty = !!attendanceDirty[std.id];
                const isSavedToday = !isRowDirty && !!(attendanceRecords[todayKey] && attendanceRecords[todayKey][std.id]);

                return (
                  <div key={std.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{std.name} <span className="text-xs font-normal text-slate-500">({std.class})</span></div>
                      <div className="text-xs text-slate-500">WA Wali: {std.whatsapp || '-'}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {['Hadir', 'Tidak Hadir', 'Izin'].map((statusOpt) => {
                        const active = selectedStatus === statusOpt;
                        let activeColor = 'bg-indigo-600 text-white border-indigo-600';
                        if (statusOpt === 'Hadir') activeColor = 'bg-emerald-600 text-white border-emerald-600';
                        if (statusOpt === 'Tidak Hadir') activeColor = 'bg-rose-600 text-white border-rose-600';
                        if (statusOpt === 'Izin') activeColor = 'bg-amber-500 text-white border-amber-500';

                        return (
                          <button
                            key={statusOpt}
                            onClick={() => handleSelectAttendance(std.id, statusOpt)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${active ? activeColor : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                          >
                            {statusOpt}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => handleSaveAttendanceRow(std)}
                        disabled={!isRowDirty}
                        className={`ml-1 px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${isRowDirty ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm animate-pulse cursor-pointer' : isSavedToday ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isRowDirty ? 'Save & Kirim WA' : isSavedToday ? 'Terkirim' : 'Save'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl border shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                <CalendarIcon className="w-5 h-5 text-indigo-600" /> Kalender Kehadiran — {currentMonthName} {currentYear}
              </h2>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((dayNum) => {
                  const dateKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const hasData = !!attendanceRecords[dateKey];
                  const isToday = dayNum === currentDateNum;
                  const isSelected = selectedCalDate === dateKey;

                  return (
                    <button
                      key={dayNum}
                      onClick={() => setSelectedCalDate(isSelected ? null : dateKey)}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : isToday ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold' : hasData ? 'bg-emerald-50 border-emerald-200 text-slate-800' : 'bg-white text-slate-600'}`}
                    >
                      <span className="text-sm font-bold">{dayNum}</span>
                      {hasData && <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}></span>}
                    </button>
                  );
                })}
              </div>

              {selectedCalDate && (
                <div className="mt-5 p-4 rounded-2xl bg-slate-50 border space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-bold text-sm text-slate-900">Rekap Kehadiran Tanggal: {selectedCalDate}</h3>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">View Only</span>
                  </div>
                  <div className="divide-y divide-slate-200/70">
                    {students.map((std) => {
                      const rec = attendanceRecords[selectedCalDate]?.[std.id] || 'Belum ada data';
                      return (
                        <div key={std.id} className="py-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{std.name} ({std.class})</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-bold ${rec === 'Hadir' ? 'bg-emerald-100 text-emerald-800' : rec === 'Tidak Hadir' ? 'bg-rose-100 text-rose-800' : rec === 'Izin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-500'}`}>
                            {rec}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div>
                  <span className="text-xs font-bold uppercase text-indigo-600">Tagihan Bulan Berjalan</span>
                  <h2 className="text-lg font-bold text-slate-900">Status Pembayaran Bulan {currentMonthName} {currentYear}</h2>
                </div>
                {showPaymentBadgeAlert && (
                  <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" /> Mendekati Akhir Bulan: Ada SPP Belum Lunas
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {students.map((std) => {
                  const status = currentMonthPayments[std.id] || 'Belum Lunas';
                  const isUnpaid = status !== 'Lunas';

                  return (
                    <div key={std.id} className="py-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{std.name}</span>
                        <span className="text-xs text-slate-500">({std.class})</span>
                        {isNearEndOfMonth && isUnpaid && <AlertCircle className="w-4 h-4 text-rose-600" title="Belum Lunas jelang akhir bulan" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleTogglePaymentStatus(std, currentMonthKey)} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${isUnpaid ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          Belum Lunas
                        </button>
                        <button onClick={() => handleTogglePaymentStatus(std, currentMonthKey)} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${!isUnpaid ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          Lunas
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-slate-700">Riwayat 3 Bulan Sebelumnya</h3>
              {previousThreeMonths.map((prevM) => {
                const isOpen = openPrevMonthToggle === prevM.key;
                const prevRecords = payments[prevM.key] || {};

                return (
                  <div key={prevM.key} className="bg-white rounded-2xl border overflow-hidden shadow-xs">
                    <button onClick={() => setOpenPrevMonthToggle(isOpen ? null : prevM.key)} className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50">
                      <span className="font-bold text-sm text-slate-800">Status Pembayaran Bulan {prevM.label}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-2 border-t divide-y divide-slate-100">
                        {students.map((std) => {
                          const st = prevRecords[std.id] || 'Belum Lunas';
                          const unpaid = st !== 'Lunas';
                          return (
                            <div key={std.id} className="py-2.5 flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">{std.name}</span>
                              <div className="flex gap-2">
                                <button onClick={() => handleTogglePaymentStatus(std, prevM.key)} className={`px-3 py-1 rounded-lg font-bold ${unpaid ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Belum Lunas</button>
                                <button onClick={() => handleTogglePaymentStatus(std, prevM.key)} className={`px-3 py-1 rounded-lg font-bold ${!unpaid ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Lunas</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
              <button onClick={() => setOpenYearlyRecap(!openYearlyRecap)} className="w-full px-5 py-4 bg-slate-900 text-white flex items-center justify-between font-bold text-sm">
                <span>Rekap Pembayaran SPP Tahun {currentYear} (View Only)</span>
                {openYearlyRecap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {openYearlyRecap && (
                <div className="p-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {MONTHS_ID.map((mName, idx) => {
                      const mKey = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
                      const active = selectedRecapMonth === mKey;
                      return (
                        <button key={mKey} onClick={() => setSelectedRecapMonth(active ? null : mKey)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700'}`}>
                          {mName}
                        </button>
                      );
                    })}
                  </div>
                  {selectedRecapMonth && (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold">
                          <tr>
                            <th className="p-3">Nama Siswa</th>
                            <th className="p-3">Kelas</th>
                            <th className="p-3 text-right">Status Pembayaran</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.map((std) => {
                            const recStatus = (payments[selectedRecapMonth] && payments[selectedRecapMonth][std.id]) || 'Belum Lunas';
                            return (
                              <tr key={std.id}>
                                <td className="p-3 font-semibold">{std.name}</td>
                                <td className="p-3 text-slate-500">{std.class}</td>
                                <td className="p-3 text-right">
                                  <span className={`px-2.5 py-1 rounded-lg font-bold text-white ${recStatus === 'Lunas' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{recStatus}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Catatan Guru untuk Orang Tua</h2>
              <p className="text-xs text-slate-500">Catatan yang disimpan di sini otomatis tampil di dashboard orang tua masing-masing.</p>
            </div>
            <div className="space-y-3">
              {students.map((std) => {
                const savedNoteObj = teacherNotes[std.id] || { month: currentMonthName, note: '' };
                const draft = noteDrafts[std.id] || savedNoteObj;

                return (
                  <div key={std.id} className="bg-white rounded-2xl border p-4 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="lg:w-48 shrink-0">
                      <div className="font-bold text-sm text-slate-900">{std.name}</div>
                      <div className="text-xs text-slate-500">{std.class}</div>
                    </div>
                    <select
                      value={draft.month}
                      onChange={(e) => setNoteDrafts({ ...noteDrafts, [std.id]: { ...draft, month: e.target.value } })}
                      className="px-3 py-2 rounded-xl border text-xs font-semibold bg-white lg:w-36"
                    >
                      {MONTHS_ID.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder={`Tulis catatan perkembangan ${std.name}...`}
                      value={draft.note}
                      onChange={(e) => setNoteDrafts({ ...noteDrafts, [std.id]: { ...draft, note: e.target.value } })}
                      className="flex-1 px-3.5 py-2 rounded-xl border text-xs"
                    />
                    <button
                      onClick={async () => {
                        setTeacherNotes({ ...teacherNotes, [std.id]: draft });
                        setNoteSavedAlert({ ...noteSavedAlert, [std.id]: true });
                        setTimeout(() => setNoteSavedAlert((prev) => ({ ...prev, [std.id]: false })), 2000);

                        if (supabase) {
                          await supabase.from('teacher_notes').upsert({
                            student_id: std.id,
                            month: draft.month,
                            note: draft.note
                          });
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {noteSavedAlert[std.id] ? <><CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan</> : <><Save className="w-3.5 h-3.5" /> Save</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {viewingExamModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <span className="text-xs font-bold text-indigo-700">{viewingExamModal.subject} • {viewingExamModal.upload_date || viewingExamModal.uploadDate}</span>
                <h3 className="font-bold text-lg text-slate-900">{viewingExamModal.title}</h3>
                <p className="text-xs text-slate-400">File: {viewingExamModal.file_name || viewingExamModal.fileName}</p>
              </div>
              <button onClick={() => setViewingExamModal(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              {viewingExamModal.questions.map((q) => (
                <div key={q.no} className="p-3.5 rounded-xl border bg-slate-50 text-xs space-y-1">
                  <div className="font-bold text-slate-900">Soal No. {q.no} (Topik: {q.topic})</div>
                  <p className="text-slate-800 font-medium">{q.text}</p>
                  <p className="text-slate-500">Kunci Jawaban: <strong className="text-indigo-600">{q.answerKey}</strong></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {renameModalStudent && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base">Rename Data Siswa</h3>
              <button onClick={() => setRenameModalStudent(null)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveRename} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">Nama Siswa</label>
                <input type="text" value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Kelas</label>
                <select value={editStudentClass} onChange={(e) => setEditStudentClass(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm bg-white">
                  {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Nama Wali Murid</label>
                <input type="text" value={editParentName} onChange={(e) => setEditParentName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Nomor WhatsApp Wali</label>
                <input type="tel" value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setRenameModalStudent(null)} className="px-3 py-1.5 bg-slate-100 text-xs font-bold rounded-xl">Batal</button>
                <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl">Terapkan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
