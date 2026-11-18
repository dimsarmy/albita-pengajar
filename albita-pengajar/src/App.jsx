import React, { useState, useEffect } from 'react';
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
  CreditCard,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  CheckCircle2
} from 'lucide-react';

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

const DAYS_ID = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

// Format nomor WA ke 62...
const formatWaNumber = (num) => {
  if (!num) return '';
  let clean = num.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean;
};

const DEFAULT_STUDENTS = [
  {
    id: 'std-1',
    name: 'Azka',
    class: '6 SD',
    parentName: 'Ayah Azka',
    whatsapp: '081234567890',
    accessCode: 'ALBITA-AZKA'
  },
  {
    id: 'std-2',
    name: 'Aisa',
    class: '5 SD',
    parentName: 'Ibu Aisa',
    whatsapp: '081298765432',
    accessCode: 'ALBITA-AISA'
  },
  {
    id: 'std-3',
    name: 'Budi Santoso',
    class: '6 SD',
    parentName: 'Ibu Ratna',
    whatsapp: '081355556666',
    accessCode: 'ALBITA-BUDI'
  },
  {
    id: 'std-4',
    name: 'Siti Aminah',
    class: '7 SMP',
    parentName: 'Bapak Hendra',
    whatsapp: '081977778888',
    accessCode: 'ALBITA-SITI'
  }
];

const DEFAULT_EXAMS = [
  {
    id: 'exam-1',
    title: 'Latihan Ujian Matematika - Pecahan & Desimal (Paket A)',
    fileName: 'Soal_MTK_Kelas6_Pecahan_PaketA.docx',
    uploadDate: '12 Nov 2026',
    subject: 'Matematika',
    questions: [
      { no: 1, text: 'Hasil dari 3/4 + 0,25 dalam bentuk desimal adalah...', answerKey: '1,00 atau 1', topic: 'Operasi Pecahan & Desimal' },
      { no: 2, text: 'Ibu membeli 2,5 kg gula dan digunakan 1 1/4 kg untuk membuat kue. Sisa gula Ibu adalah...', answerKey: '1,25 kg', topic: 'Soal Cerita Pecahan' },
      { no: 3, text: 'Hasil pembagian 4,8 : 0,6 adalah...', answerKey: '8', topic: 'Pembagian Desimal' }
    ]
  }
];

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const viewStudentParam = urlParams.get('viewStudent');

  // Waktu Real-Time Otomatis
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

  // Deteksi akhir bulan (tanggal >= 25)
  const isNearEndOfMonth = currentDateNum >= 25;

  // State Utama (Tersimpan di localStorage)
  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem('albita_students');
    return saved ? JSON.parse(saved) : DEFAULT_STUDENTS;
  });

  const [exams, setExams] = useState(() => {
    const saved = localStorage.getItem('albita_exams');
    return saved ? JSON.parse(saved) : DEFAULT_EXAMS;
  });

  const [submissions, setSubmissions] = useState(() => {
    const saved = localStorage.getItem('albita_submissions');
    return saved ? JSON.parse(saved) : [];
  });

  // Absensi: { 'YYYY-MM-DD': { [studentId]: 'Hadir' | 'Tidak Hadir' | 'Izin' } }
  const [attendanceRecords, setAttendanceRecords] = useState(() => {
    const saved = localStorage.getItem('albita_attendance');
    if (saved) return JSON.parse(saved);
    // Contoh riwayat kemarin agar kalender bisa langsung dicoba
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    return {
      [yKey]: {
        'std-1': 'Hadir',
        'std-2': 'Hadir',
        'std-3': 'Izin',
        'std-4': 'Hadir'
      }
    };
  });

  // Status Pembayaran SPP: { 'YYYY-MM': { [studentId]: 'Lunas' | 'Belum Lunas' } }
  const [payments, setPayments] = useState(() => {
    const saved = localStorage.getItem('albita_payments');
    if (saved) return JSON.parse(saved);
    return {
      [currentMonthKey]: {
        'std-1': 'Belum Lunas',
        'std-2': 'Lunas',
        'std-3': 'Belum Lunas',
        'std-4': 'Lunas'
      }
    };
  });

  // Catatan Guru: { [studentId]: { month: 'November', note: '...' } }
  const [teacherNotes, setTeacherNotes] = useState(() => {
    const saved = localStorage.getItem('albita_teacher_notes');
    return saved ? JSON.parse(saved) : {
      'std-1': { month: currentMonthName, note: 'Azka sangat fokus saat latihan soal pecahan hari ini.' }
    };
  });

  useEffect(() => { localStorage.setItem('albita_students', JSON.stringify(students)); }, [students]);
  useEffect(() => { localStorage.setItem('albita_exams', JSON.stringify(exams)); }, [exams]);
  useEffect(() => { localStorage.setItem('albita_submissions', JSON.stringify(submissions)); }, [submissions]);
  useEffect(() => { localStorage.setItem('albita_attendance', JSON.stringify(attendanceRecords)); }, [attendanceRecords]);
  useEffect(() => { localStorage.setItem('albita_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('albita_teacher_notes', JSON.stringify(teacherNotes)); }, [teacherNotes]);

  const [activeTab, setActiveTab] = useState('students');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobilePage, setMobilePage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Edit per kartu siswa
  const [studentEdits, setStudentEdits] = useState({});
  const [renameModalStudent, setRenameModalStudent] = useState(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editStudentClass, setEditStudentClass] = useState('6 SD');
  const [editWhatsapp, setEditWhatsapp] = useState('');

  // Tambah Siswa
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('6 SD');
  const [newWhatsapp, setNewWhatsapp] = useState('');

  // Bank Soal & Scanner
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [scanStudentId, setScanStudentId] = useState(students[0]?.id || 'std-1');
  const [scanExamId, setScanExamId] = useState(exams[0]?.id || 'exam-1');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);

  // Draft Absensi Hari Ini (untuk kontrol tombol Save)
  const [todayAttendanceDraft, setTodayAttendanceDraft] = useState(() => attendanceRecords[todayKey] || {});
  const [attendanceDirty, setAttendanceDirty] = useState({});

  // Kalender
  const [selectedCalDate, setSelectedCalDate] = useState(null);

  // Toggle 3 Bulan Sebelumnya & Rekap Tahunan di Status Pembayaran
  const [openPrevMonthToggle, setOpenPrevMonthToggle] = useState(null);
  const [openYearlyRecap, setOpenYearlyRecap] = useState(false);
  const [selectedRecapMonth, setSelectedRecapMonth] = useState(null);

  // Draft Catatan Guru
  const [noteDrafts, setNoteDrafts] = useState({});
  const [noteSavedAlert, setNoteSavedAlert] = useState({});

  // =========================================================================
  // TAMPILAN KHUSUS TAB BARU: "LIHAT SOAL" (VIEW ONLY)
  // =========================================================================
  if (viewStudentParam) {
    const targetStudent = students.find((s) => s.id === viewStudentParam);
    const studentSubs = submissions.filter((sub) => sub.studentId === viewStudentParam);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-indigo-950 text-white py-4 px-4 shadow-sm sticky top-0 z-20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-indigo-300 font-semibold">
                Arsip Soal Dikerjakan • View Only
              </span>
              <h1 className="font-bold text-lg">{targetStudent?.name || 'Siswa'} ({targetStudent?.class || '6 SD'})</h1>
              <p className="text-xs text-indigo-200">Wali: {targetStudent?.parentName}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-800 text-xs font-semibold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Lihat Saja
            </span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {studentSubs.length === 0 ? (
            <div className="bg-white rounded-2xl border p-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">Belum Ada Soal yang Dikerjakan</h3>
            </div>
          ) : (
            studentSubs.map((sub) => {
              const examDetail = exams.find((e) => e.id === sub.examId);
              if (!examDetail) return null;
              return (
                <div key={sub.id} className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-start border-b pb-3">
                    <div>
                      <span className="text-xs font-bold text-indigo-700">{examDetail.subject} • {sub.date}</span>
                      <h2 className="font-bold text-base text-slate-900">{examDetail.title}</h2>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-indigo-50 border text-indigo-800 font-bold text-xs">
                      Skor: {sub.score}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {examDetail.questions.map((q) => {
                      const res = sub.results.find((r) => r.no === q.no);
                      return (
                        <div key={q.no} className="p-3 rounded-xl border bg-slate-50 text-xs space-y-1">
                          <div className="flex justify-between font-bold">
                            <span>Soal No. {q.no}</span>
                            <span className={res?.status === 'correct' ? 'text-emerald-700' : 'text-rose-700'}>
                              {res?.status === 'correct' ? 'Benar' : 'Salah'}
                            </span>
                          </div>
                          <p>{q.text}</p>
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

  // =========================================================================
  // LOGIKA STATUS PEMBAYARAN & NOTIFIKASI AKHIR BULAN
  // =========================================================================
  const currentMonthPayments = payments[currentMonthKey] || {};
  const hasUnpaidThisMonth = students.some((s) => (currentMonthPayments[s.id] || 'Belum Lunas') !== 'Lunas');
  const showPaymentBadgeAlert = isNearEndOfMonth && hasUnpaidThisMonth;

  const handleTogglePaymentStatus = (student, monthKeyToUpdate = currentMonthKey) => {
    const monthRecord = payments[monthKeyToUpdate] || {};
    const currentStatus = monthRecord[student.id] || 'Belum Lunas';
    const nextStatus = currentStatus === 'Lunas' ? 'Belum Lunas' : 'Lunas';

    setPayments({
      ...payments,
      [monthKeyToUpdate]: {
        ...monthRecord,
        [student.id]: nextStatus
      }
    });

    // Jika diubah menjadi Lunas, otomatis buka WhatsApp notifikasi ke wali murid
    if (nextStatus === 'Lunas' && student.whatsapp) {
      const monthLabel = MONTHS_ID[parseInt(monthKeyToUpdate.split('-')[1], 10) - 1] || currentMonthName;
      const waNumber = formatWaNumber(student.whatsapp);
      const messageText = `Halo ${student.parentName}, SPP ananda *${student.name}* bulan *${monthLabel}* sudah dibayar (LUNAS). Terima kasih banyak sudah mempercayai Bimbingan Belajar Albita.`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`, '_blank', 'noopener,noreferrer');
    }
  };

  // =========================================================================
  // LOGIKA ABSENSI HARI INI + NOTIFIKASI WHATSAPP
  // =========================================================================
  const handleSelectAttendance = (studentId, status) => {
    setTodayAttendanceDraft({
      ...todayAttendanceDraft,
      [studentId]: status
    });
    setAttendanceDirty({
      ...attendanceDirty,
      [studentId]: true
    });
  };

  const handleSaveAttendanceRow = (student) => {
    const chosenStatus = todayAttendanceDraft[student.id];
    if (!chosenStatus) return;

    const updatedToday = {
      ...(attendanceRecords[todayKey] || {}),
      [student.id]: chosenStatus
    };

    setAttendanceRecords({
      ...attendanceRecords,
      [todayKey]: updatedToday
    });

    setAttendanceDirty({
      ...attendanceDirty,
      [student.id]: false
    });

    // Kirim notifikasi WhatsApp jika status Hadir (atau sesuai konfirmasi)
    if (student.whatsapp) {
      const waNumber = formatWaNumber(student.whatsapp);
      let msg = `${student.name} sudah tiba di tempat les Albita (${currentDayName}, ${currentDateNum} ${currentMonthName} ${currentYear}).`;
      if (chosenStatus === 'Izin') {
        msg = `Konfirmasi absensi Albita: ${student.name} tercatat IZIN pada hari ini (${currentDayName}, ${currentDateNum} ${currentMonthName} ${currentYear}).`;
      } else if (chosenStatus === 'Tidak Hadir') {
        msg = `Informasi absensi Albita: ${student.name} tercatat TIDAK HADIR pada hari ini (${currentDayName}, ${currentDateNum} ${currentMonthName} ${currentYear}).`;
      }
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    }
  };

  // =========================================================================
  // LOGIKA SISWA (SEARCH, PAGINATION MOBILE, RENAME, HAPUS, TAMBAH)
  // =========================================================================
  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.parentName && s.parentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.class && s.class.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pagination khusus Mobile: 3 siswa per halaman
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

  const handleSaveStudentCard = (stdId) => {
    const editData = studentEdits[stdId];
    if (!editData) return;
    setStudents(
      students.map((s) =>
        s.id === stdId
          ? {
              ...s,
              name: editData.name,
              parentName: editData.parentName,
              class: editData.class,
              whatsapp: editData.whatsapp
            }
          : s
      )
    );
    setStudentEdits({
      ...studentEdits,
      [stdId]: { ...editData, isDirty: false }
    });
  };

  const handleDeleteStudent = (student) => {
    setOpenMenuId(null);
    if (!window.confirm(`Hapus permanen "${student.name}" beserta semua riwayat soalnya?`)) return;
    setStudents(students.filter((s) => s.id !== student.id));
    setSubmissions(submissions.filter((sub) => sub.studentId !== student.id));
  };

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    const firstName = newStudentName.trim().split(' ')[0].toUpperCase();
    const newStd = {
      id: `std-${Date.now()}`,
      name: newStudentName.trim(),
      class: newStudentClass,
      parentName: newParentName.trim() || 'Wali Murid',
      whatsapp: newWhatsapp.trim(),
      accessCode: `ALBITA-${firstName}`
    };
    setStudents([...students, newStd]);
    setNewStudentName('');
    setNewParentName('');
    setNewWhatsapp('');
    setShowAddStudent(false);
  };

  // =========================================================================
  // LOGIKA BANK SOAL & SCAN KOREKSI
  // =========================================================================
  const handleUploadTeacherExam = (fileName) => {
    setIsUploadingDoc(true);
    setTimeout(() => {
      const newExam = {
        id: `exam-${Date.now()}`,
        title: fileName ? fileName.replace(/\.(doc|docx|pdf|jpg|png)$/i, '').replace(/_/g, ' ') : 'Soal Jadi Pengajar',
        fileName: fileName || 'Soal_Baru.docx',
        uploadDate: `${currentDateNum} ${currentMonthName.slice(0, 3)} ${currentYear}`,
        subject: 'Bank Soal Guru',
        questions: [
          { no: 1, text: 'Soal referensi dari pengajar...', answerKey: 'Kunci jawaban', topic: 'Materi' }
        ]
      };
      setExams([newExam, ...exams]);
      setIsUploadingDoc(false);
    }, 600);
  };

  const handleScanPhoto = (imageFile = null) => {
    setIsScanning(true);
    setLastScanResult(null);
    const targetExam = exams.find((e) => e.id === scanExamId) || exams[0];

    setTimeout(() => {
      const generatedResults = targetExam.questions.map((q, idx) => ({
        no: q.no,
        status: idx === 1 ? 'wrong' : 'correct',
        inkNote: idx === 1 ? 'Perlu latihan ulang' : 'Jawaban benar'
      }));

      const correctCount = generatedResults.filter((r) => r.status === 'correct').length;
      const calcScore = Math.round((correctCount / targetExam.questions.length) * 100);

      const newSubmission = {
        id: `sub-${Date.now()}`,
        studentId: scanStudentId,
        examId: targetExam.id,
        date: `${currentDateNum} ${currentMonthName.slice(0, 3)} ${currentYear}`,
        score: calcScore,
        results: generatedResults
      };

      setSubmissions([newSubmission, ...submissions]);
      setLastScanResult({
        student: students.find((s) => s.id === scanStudentId),
        exam: targetExam,
        submission: newSubmission
      });
      setIsScanning(false);
    }, 700);
  };

  // =========================================================================
  // LOGIKA KALENDER BULAN INI
  // =========================================================================
  const daysInCurrentMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  // =========================================================================
  // 3 BULAN SEBELUMNYA UNTUK STATUS PEMBAYARAN
  // =========================================================================
  const previousThreeMonths = [1, 2, 3].map((offset) => {
    const d = new Date(currentYear, currentMonthIdx - offset, 1);
    const mIdx = d.getMonth();
    const y = d.getFullYear();
    return {
      key: `${y}-${String(mIdx + 1).padStart(2, '0')}`,
      label: `${MONTHS_ID[mIdx]} ${y}`
    };
  });

  // Render Kartu Siswa (Dipakai oleh Desktop Grid & Mobile Pagination)
  const renderStudentCard = (std) => {
    const currentEdit = studentEdits[std.id] || {
      name: std.name,
      parentName: std.parentName,
      class: std.class || '6 SD',
      whatsapp: std.whatsapp || '',
      isDirty: false
    };
    const studentSubsCount = submissions.filter((s) => s.studentId === std.id).length;
    // Status SPP otomatis mengikuti menu Status Pembayaran bulan ini (tidak bisa diedit langsung di sini)
    const sppStatus = currentMonthPayments[std.id] || 'Belum Lunas';
    const waClean = formatWaNumber(currentEdit.whatsapp);

    return (
      <div key={std.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-lg text-slate-900 truncate">{currentEdit.name}</h3>
            <div className="relative">
              <button
                onClick={() => setOpenMenuId(openMenuId === std.id ? null : std.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <Settings className="w-4 h-4" />
              </button>
              {openMenuId === std.id && (
                <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-xl border shadow-lg py-1 z-20 text-xs">
                  <button
                    onClick={() => handleOpenRenameModal(std)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" /> Rename
                  </button>
                  <button
                    onClick={() => handleDeleteStudent(std)}
                    className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 font-semibold flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border space-y-2.5 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Kelas:</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                {currentEdit.class}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Wali:</span>
              <span className="font-semibold text-slate-800">{currentEdit.parentName}</span>
            </div>

            {/* Nomor WhatsApp Wali (Klik langsung menuju WhatsApp) */}
            <div className="flex justify-between items-center">
              <span className="text-slate-500">WhatsApp Wali:</span>
              {waClean ? (
                <a
                  href={`https://wa.me/${waClean}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-emerald-700 hover:text-emerald-800 underline flex items-center gap-1"
                >
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

            {/* SPP Otomatis Mengikuti Menu Status Pembayaran (View Only di kartu siswa) */}
            <div className="flex justify-between items-center">
              <span className="text-slate-500">SPP ({currentMonthName}):</span>
              <span
                className={`px-3 py-1 rounded-lg font-bold text-white text-[11px] select-none ${
                  sppStatus === 'Lunas' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {sppStatus}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1 border-t">
              <span className="text-slate-500">Arsip Soal ({studentSubsCount}):</span>
              <button
                onClick={() => window.open(`${window.location.origin}${window.location.pathname}?viewStudent=${std.id}`, '_blank', 'noopener,noreferrer')}
                className="px-2.5 py-1 rounded-lg bg-white text-indigo-700 border font-semibold text-[11px] flex items-center gap-1"
              >
                Lihat Soal <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => { setScanStudentId(std.id); setActiveTab('scanner'); }}
            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" /> Scan Lembar Kerja
          </button>

          <button
            onClick={() => handleSaveStudentCard(std.id)}
            disabled={!currentEdit.isDirty}
            className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              currentEdit.isDirty
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm animate-pulse'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {currentEdit.isDirty ? 'Save Perubahan' : 'Tersimpan'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* HEADER */}
      <header className="bg-indigo-950 text-white border-b border-indigo-900 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold text-xl">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white leading-tight">ALBITA ADMIN</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-800 text-indigo-200 border border-indigo-700 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Ruang Pengajar
                </span>
              </div>
              <p className="text-xs text-indigo-300">Manajemen Siswa</p>
            </div>
          </div>
          <div className="hidden sm:block text-right text-xs text-indigo-200">
            <div className="font-bold text-white">{currentDayName}, {currentDateNum} {currentMonthName} {currentYear}</div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 py-6 flex-1">
        {/* MENU NAVIGASI */}
        <div className="flex overflow-x-auto gap-2 pb-3 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'students' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Siswa ({students.length})
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'exams' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Bank Soal ({exams.length})
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'scanner' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Scan Koreksi
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Absensi
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Kalender
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'payments' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Status Pembayaran
            {showPaymentBadgeAlert && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" title="Ada siswa belum bayar mendekati akhir bulan"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${activeTab === 'notes' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Catatan Guru
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: DAFTAR SISWA (DENGAN PENCARIAN & PAGINATION MOBILE 3 SISWA) */}
        {/* ================================================================= */}
        {activeTab === 'students' && (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">Daftar Siswa</h2>
              <button
                onClick={() => setShowAddStudent(!showAddStudent)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Tambah Siswa
              </button>
            </div>

            {/* Kolom Pencarian Siswa (Berlaku untuk Desktop & Mobile) */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama siswa, kelas, atau wali murid..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setMobilePage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-500 shadow-xs"
              />
            </div>

            {/* Form Tambah Siswa (Nama, Kelas, Wali, No WhatsApp) */}
            {showAddStudent && (
              <form onSubmit={handleAddStudent} className="bg-white p-4 rounded-2xl border border-indigo-200 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end shadow-sm">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nama Siswa</label>
                  <input
                    type="text"
                    placeholder="Contoh: Azka"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Kelas</label>
                  <select
                    value={newStudentClass}
                    onChange={(e) => setNewStudentClass(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl text-sm bg-white"
                  >
                    {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nama Wali Murid</label>
                  <input
                    type="text"
                    placeholder="Contoh: Ayah Azka"
                    value={newParentName}
                    onChange={(e) => setNewParentName(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nomor WhatsApp Wali</label>
                  <input
                    type="tel"
                    placeholder="Contoh: 08123456789"
                    value={newWhatsapp}
                    onChange={(e) => setNewWhatsapp(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl text-sm"
                    required
                  />
                </div>
                <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold">
                  Simpan Siswa
                </button>
              </form>
            )}

            {/* TAMPILAN DESKTOP (SEMUA HASIL PENCARIAN DALAM GRID) */}
            <div className="hidden md:grid md:grid-cols-3 gap-4">
              {filteredStudents.map((std) => renderStudentCard(std))}
            </div>

            {/* TAMPILAN MOBILE PHONE (MAKSIMAL 3 SISWA PER HALAMAN + TOMBOL NEXT) */}
            <div className="md:hidden space-y-4">
              <div className="space-y-4">
                {mobilePaginatedStudents.map((std) => renderStudentCard(std))}
              </div>

              {totalMobilePages > 1 && (
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    onClick={() => setMobilePage((p) => Math.max(1, p - 1))}
                    disabled={safeMobilePage === 1}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 disabled:opacity-40 text-xs font-bold flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <span className="text-xs font-semibold text-slate-600">
                    Halaman {safeMobilePage} dari {totalMobilePages}
                  </span>
                  <button
                    onClick={() => setMobilePage((p) => Math.min(totalMobilePages, p + 1))}
                    disabled={safeMobilePage === totalMobilePages}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: BANK SOAL                                                  */}
        {/* ================================================================= */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-6 flex flex-wrap justify-between items-center gap-4 shadow-sm">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Bank Soal Guru (Soal Jadi / Materi)</h2>
                <p className="text-xs text-slate-500">Upload dokumen soal atau foto soal jadi buatanmu sendiri.</p>
              </div>
              <label className="cursor-pointer px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm">
                <Upload className="w-4 h-4" /> {isUploadingDoc ? 'Mengupload...' : 'Upload Document / Foto Soal'}
                <input
                  type="file"
                  accept=".doc,.docx,.pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadTeacherExam(f.name);
                  }}
                />
              </label>
            </div>

            <div className="space-y-3">
              {exams.map((ex) => (
                <div key={ex.id} className="bg-white rounded-2xl border p-4 shadow-sm flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-600">{ex.subject} • {ex.uploadDate}</span>
                    <h3 className="font-bold text-sm text-slate-900">{ex.title}</h3>
                    <p className="text-xs text-slate-400">File: {ex.fileName}</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
                    Soal Jadi
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SCAN KOREKSI (NAMA DIUBAH MENJADI "SCAN KOREKSI")          */}
        {/* ================================================================= */}
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
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScanPhoto(f); }} />
              </label>
              <button onClick={() => handleScanPhoto(null)} disabled={isScanning} className="w-full py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold">
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

        {/* ================================================================= */}
        {/* TAB 4: ABSENSI HARI INI + NOTIFIKASI WHATSAPP OTOMATIS            */}
        {/* ================================================================= */}
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

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
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
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              active ? activeColor : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {statusOpt}
                          </button>
                        );
                      })}

                      {/* Tombol Save: Menyala jika pilihan diubah, mengirim notifikasi WA saat diklik */}
                      <button
                        onClick={() => handleSaveAttendanceRow(std)}
                        disabled={!isRowDirty}
                        className={`ml-1 px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                          isRowDirty
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm animate-pulse cursor-pointer'
                            : isSavedToday
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
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

        {/* ================================================================= */}
        {/* TAB 5: KALENDER ABSENSI (VIEW ONLY DROPDOWN PER TANGGAL)          */}
        {/* ================================================================= */}
        {activeTab === 'calendar' && (
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-indigo-600" /> Kalender Kehadiran — {currentMonthName} {currentYear}
                  </h2>
                  <p className="text-xs text-slate-500">Klik tanggal pada kalender untuk melihat rekap kehadiran siswa (Hanya Lihat).</p>
                </div>
              </div>

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
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : isToday
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold'
                          : hasData
                          ? 'bg-emerald-50/70 border-emerald-200 text-slate-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm font-bold">{dayNum}</span>
                      {hasData && (
                        <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}></span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Dropdown Detail Absensi Tanggal Terpilih (Tidak Bisa Diedit) */}
              {selectedCalDate && (
                <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-bold text-sm text-slate-900">
                      Rekap Kehadiran Tanggal: {selectedCalDate}
                    </h3>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      View Only (Tidak Dapat Diedit)
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200/70">
                    {students.map((std) => {
                      const rec = attendanceRecords[selectedCalDate]?.[std.id] || 'Belum ada data';
                      return (
                        <div key={std.id} className="py-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{std.name} ({std.class})</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold ${
                              rec === 'Hadir'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec === 'Tidak Hadir'
                                ? 'bg-rose-100 text-rose-800'
                                : rec === 'Izin'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
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

        {/* ================================================================= */}
        {/* TAB 6: STATUS PEMBAYARAN SPP (BULAN INI, 3 BULAN LALU, & TAHUNAN) */}
        {/* ================================================================= */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* 1. Status Pembayaran Bulan Ini */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
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
                        {/* Tanda seru merah jika mendekati akhir bulan dan belum lunas */}
                        {isNearEndOfMonth && isUnpaid && (
                          <span title="Belum bayar menjelang akhir bulan!" className="text-rose-600 flex items-center">
                            <AlertCircle className="w-4 h-4 fill-rose-100" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTogglePaymentStatus(std, currentMonthKey)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            isUnpaid
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          Belum Lunas
                        </button>
                        <button
                          onClick={() => handleTogglePaymentStatus(std, currentMonthKey)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            !isUnpaid
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          Lunas
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. 3 Toggle Bulan Sebelumnya (Track Record 4 Bulan Total) */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-bold text-slate-700">Riwayat 3 Bulan Sebelumnya</h3>
              {previousThreeMonths.map((prevM) => {
                const isOpen = openPrevMonthToggle === prevM.key;
                const prevRecords = payments[prevM.key] || {};

                return (
                  <div key={prevM.key} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <button
                      onClick={() => setOpenPrevMonthToggle(isOpen ? null : prevM.key)}
                      className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50"
                    >
                      <span className="font-bold text-sm text-slate-800">Status Pembayaran Bulan {prevM.label}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4 pt-2 border-t border-slate-100 divide-y divide-slate-100">
                        {students.map((std) => {
                          const st = prevRecords[std.id] || 'Belum Lunas';
                          const unpaid = st !== 'Lunas';
                          return (
                            <div key={std.id} className="py-2.5 flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-800">{std.name}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleTogglePaymentStatus(std, prevM.key)}
                                  className={`px-3 py-1 rounded-lg font-bold ${unpaid ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                                >
                                  Belum Lunas
                                </button>
                                <button
                                  onClick={() => handleTogglePaymentStatus(std, prevM.key)}
                                  className={`px-3 py-1 rounded-lg font-bold ${!unpaid ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                                >
                                  Lunas
                                </button>
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

            {/* 3. Tabel Rekap Pembayaran SPP Pertahun (Dropdown Bulan - View Only) */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setOpenYearlyRecap(!openYearlyRecap)}
                className="w-full px-5 py-4 bg-slate-900 text-white flex items-center justify-between font-bold text-sm"
              >
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
                        <button
                          key={mKey}
                          onClick={() => setSelectedRecapMonth(active ? null : mKey)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                            active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
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
                            <th className="p-3 text-right">Status Pembayaran (Tidak Dapat Diedit)</th>
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
                                  <span className={`px-2.5 py-1 rounded-lg font-bold text-white ${recStatus === 'Lunas' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                                    {recStatus}
                                  </span>
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

        {/* ================================================================= */}
        {/* TAB 7: CATATAN GURU (OTOMATIS MASUK KE DASHBOARD ORANG TUA)       */}
        {/* ================================================================= */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Catatan Guru untuk Orang Tua</h2>
              <p className="text-xs text-slate-500">Catatan yang disimpan di sini otomatis tampil di dashboard orang tua masing-masing siswa.</p>
            </div>

            <div className="space-y-3">
              {students.map((std) => {
                const savedNoteObj = teacherNotes[std.id] || { month: currentMonthName, note: '' };
                const draft = noteDrafts[std.id] || savedNoteObj;

                return (
                  <div key={std.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="lg:w-48 shrink-0">
                      <div className="font-bold text-sm text-slate-900">{std.name}</div>
                      <div className="text-xs text-slate-500">{std.class}</div>
                    </div>

                    <select
                      value={draft.month}
                      onChange={(e) => setNoteDrafts({ ...noteDrafts, [std.id]: { ...draft, month: e.target.value } })}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white lg:w-36"
                    >
                      {MONTHS_ID.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>

                    <input
                      type="text"
                      placeholder={`Tulis catatan perkembangan ${std.name}...`}
                      value={draft.note}
                      onChange={(e) => setNoteDrafts({ ...noteDrafts, [std.id]: { ...draft, note: e.target.value } })}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-indigo-500"
                    />

                    <button
                      onClick={() => {
                        setTeacherNotes({ ...teacherNotes, [std.id]: draft });
                        setNoteSavedAlert({ ...noteSavedAlert, [std.id]: true });
                        setTimeout(() => setNoteSavedAlert((prev) => ({ ...prev, [std.id]: false })), 2000);
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

      {/* MODAL RENAME */}
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
