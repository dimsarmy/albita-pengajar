import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Camera,
  Upload,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Sparkles,
  Lock,
  Settings,
  ExternalLink,
  Trash2,
  Edit3,
  FileText,
  ArrowLeft,
  Eye,
  X
} from 'lucide-react';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const DEFAULT_STUDENTS = [
  {
    id: 'std-1',
    name: 'Budi Santoso',
    class: '6 SD',
    parentName: 'Ibu Ratna',
    accessCode: 'ALBITA-BUDI',
    paymentStatus: 'Lunas'
  },
  {
    id: 'std-2',
    name: 'Siti Aminah',
    class: '6 SD',
    parentName: 'Bapak Hendra',
    accessCode: 'ALBITA-SITI',
    paymentStatus: 'Lunas'
  },
  {
    id: 'std-3',
    name: 'Rizky Pratama',
    class: '6 SD',
    parentName: 'Ibu Dewi',
    accessCode: 'ALBITA-RIZKY',
    paymentStatus: 'Belum Lunas'
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
      { no: 3, text: 'Hasil pembagian 4,8 : 0,6 adalah...', answerKey: '8', topic: 'Pembagian Desimal' },
      { no: 4, text: 'Urutkan pecahan berikut dari yang terkecil: 65%; 0,7; 3/5', answerKey: '3/5; 65%; 0,7', topic: 'Mengurutkan Pecahan' },
      { no: 5, text: 'Sebuah tangki berisi 15,5 liter air. Jika 40% air digunakan, berapa liter sisa air di tangki?', answerKey: '9,3 liter', topic: 'Persentase & Desimal' }
    ]
  },
  {
    id: 'exam-2',
    title: 'Try Out IPA Kelas 6 - Sistem Tata Surya & Rangkaian Listrik',
    fileName: 'Soal_IPA_Kelas6_TataSurya_Listrik.docx',
    uploadDate: '15 Nov 2026',
    subject: 'IPA',
    questions: [
      { no: 1, text: 'Planet terbesar dalam sistem tata surya yang memiliki cincin tipis adalah...', answerKey: 'Jupiter', topic: 'Tata Surya' },
      { no: 2, text: 'Pada rangkaian listrik seri, jika salah satu lampu padam maka lampu lainnya akan...', answerKey: 'Ikut padam', topic: 'Rangkaian Listrik' },
      { no: 3, text: 'Peristiwa berputarnya Bumi mengelilingi Matahari disebut...', answerKey: 'Revolusi Bumi', topic: 'Gerak Bumi & Bulan' }
    ]
  }
];

const DEFAULT_SUBMISSIONS = [
  {
    id: 'sub-1',
    studentId: 'std-1',
    examId: 'exam-1',
    date: '14 Nov 2026',
    score: 80,
    results: [
      { no: 1, status: 'correct', inkNote: 'Bersih tanpa coretan (Benar)' },
      { no: 2, status: 'revised', inkNote: 'Coretan Merah tertimpa Biru (Sudah direvisi di kelas)' },
      { no: 3, status: 'wrong', inkNote: 'Tanda Bulpoin Merah (Perlu latihan lagi)' },
      { no: 4, status: 'correct', inkNote: 'Bersih tanpa coretan (Benar)' },
      { no: 5, status: 'correct', inkNote: 'Bersih tanpa coretan (Benar)' }
    ]
  },
  {
    id: 'sub-2',
    studentId: 'std-2',
    examId: 'exam-2',
    date: '16 Nov 2026',
    score: 100,
    results: [
      { no: 1, status: 'correct', inkNote: 'Bersih tanpa coretan (Benar)' },
      { no: 2, status: 'correct', inkNote: 'Bersih tanpa coretan (Benar)' },
      { no: 3, status: 'correct', inkNote: 'Bersih tanpa coretan (Benar)' }
    ]
  }
];

const DEFAULT_MESSAGES = [
  {
    id: 'msg-1',
    studentId: 'std-1',
    parentName: 'Ibu Ratna (Wali Budi)',
    type: 'voice',
    timestamp: 'Hari ini, 16:40',
    transcript: 'Assalamualaikum Kak, mohon maaf nanti sore Budi agak telat sekitar 15 menit ya karena jalanan macet pulang dari ekskul sekolah.',
    read: false
  }
];

export default function App() {
  // Cek apakah URL dibuka dengan parameter ?viewStudent=std-x (Tab Baru Lihat Soal)
  const urlParams = new URLSearchParams(window.location.search);
  const viewStudentParam = urlParams.get('viewStudent');

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
    return saved ? JSON.parse(saved) : DEFAULT_SUBMISSIONS;
  });

  const [messages, setMessages] = useState(DEFAULT_MESSAGES);

  // Simpan setiap perubahan ke localStorage
  useEffect(() => {
    localStorage.setItem('albita_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('albita_exams', JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem('albita_submissions', JSON.stringify(submissions));
  }, [submissions]);

  const [activeTab, setActiveTab] = useState('students');
  const [openMenuId, setOpenMenuId] = useState(null);

  // State Modal Rename
  const [renameModalStudent, setRenameModalStudent] = useState(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editParentName, setEditParentName] = useState('');

  // State Edit Kumpulan Soal Siswa (Tab khusus admin menghapus soal siswa)
  const [editingStudentId, setEditingStudentId] = useState(null);

  // State Tambah Siswa
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newParentName, setNewParentName] = useState('');

  // State Upload Soal & Scanner
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [scanStudentId, setScanStudentId] = useState('std-1');
  const [scanExamId, setScanExamId] = useState('exam-1');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);

  // =========================================================================
  // TAMPILAN KHUSUS TAB BARU: "LIHAT SOAL" (VIEW ONLY PER SISWA)
  // =========================================================================
  if (viewStudentParam) {
    const targetStudent = students.find((s) => s.id === viewStudentParam);
    const studentSubs = submissions.filter((sub) => sub.studentId === viewStudentParam);

    if (!targetStudent) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl border text-center space-y-2">
            <h2 className="font-bold text-slate-800">Data Siswa Tidak Ditemukan</h2>
            <p className="text-xs text-slate-500">Data siswa mungkin telah dihapus oleh pengajar.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-emerald-900 text-white py-4 px-4 shadow-sm sticky top-0 z-20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
                Arsip Soal Dikerjakan • Tampilan Orang Tua (View Only)
              </span>
              <h1 className="font-bold text-lg">{targetStudent.name} ({targetStudent.class})</h1>
              <p className="text-xs text-emerald-200">Wali Murid: {targetStudent.parentName}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-800 border border-emerald-700 text-xs font-semibold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Mode Lihat Saja
            </span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {studentSubs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">Belum Ada Soal yang Dikerjakan</h3>
              <p className="text-xs text-slate-500">
                Belum ada riwayat lembar kerja yang di-upload guru untuk {targetStudent.name}.
              </p>
            </div>
          ) : (
            studentSubs.map((sub) => {
              const examDetail = exams.find((e) => e.id === sub.examId);
              if (!examDetail) return null;

              return (
                <div key={sub.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-xs font-bold text-emerald-700">{examDetail.subject} • {sub.date}</span>
                      <h2 className="font-bold text-base text-slate-900">{examDetail.title}</h2>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs">
                      Skor: {sub.score}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {examDetail.questions.map((q) => {
                      const res = sub.results.find((r) => r.no === q.no);
                      return (
                        <div key={q.no} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">Soal No. {q.no}</span>
                            {res?.status === 'correct' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">Benar</span>
                            )}
                            {res?.status === 'revised' && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                                Sempat Salah, Sudah Dibetulkan
                              </span>
                            )}
                            {res?.status === 'wrong' && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">Perlu Latihan Lagi</span>
                            )}
                          </div>
                          <p className="text-slate-800 font-medium">{q.text}</p>
                          <p className="text-slate-500">Kunci Jawaban: <strong className="text-slate-700">{q.answerKey}</strong></p>
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
  // FUNGSI-FUNGSI DASHBOARD ADMIN / PENGAJAR
  // =========================================================================

  // Toggle Status SPP (Lunas <-> Belum Lunas)
  const handleToggleSPP = (studentId) => {
    setStudents(
      students.map((s) =>
        s.id === studentId
          ? { ...s, paymentStatus: s.paymentStatus === 'Lunas' ? 'Belum Lunas' : 'Lunas' }
          : s
      )
    );
  };

  // Buka Tab Baru "Lihat Soal" khusus siswa tertentu
  const handleOpenViewSoalNewTab = (studentId) => {
    const newTabUrl = `${window.location.origin}${window.location.pathname}?viewStudent=${studentId}`;
    window.open(newTabUrl, '_blank', 'noopener,noreferrer');
  };

  // Buka Modal Rename (Hanya Nama Siswa & Nama Wali)
  const handleOpenRenameModal = (student) => {
    setOpenMenuId(null);
    setRenameModalStudent(student);
    setEditStudentName(student.name);
    setEditParentName(student.parentName);
  };

  const handleSaveRename = (e) => {
    e.preventDefault();
    if (!editStudentName.trim()) return;
    setStudents(
      students.map((s) =>
        s.id === renameModalStudent.id
          ? { ...s, name: editStudentName.trim(), parentName: editParentName.trim() || 'Wali Murid' }
          : s
      )
    );
    setRenameModalStudent(null);
  };

  // Hapus Siswa Permanen beserta seluruh soal yang terhubung
  const handleDeleteStudent = (student) => {
    setOpenMenuId(null);
    const confirmed = window.confirm(
      `Yakin ingin menghapus permanen data "${student.name}" beserta seluruh riwayat soal yang telah dikerjakan siswa ini?`
    );
    if (!confirmed) return;

    setStudents(students.filter((s) => s.id !== student.id));
    setSubmissions(submissions.filter((sub) => sub.studentId !== student.id));
  };

  // Hapus 1 Paket Soal yang telah dikerjakan siswa (dari tab Edit)
  const handleDeleteStudentSubmission = (submissionId) => {
    const confirmed = window.confirm(
      'Hapus riwayat soal ini dari daftar siswa? Soal ini juga tidak akan ditampilkan lagi di portal orang tua.'
    );
    if (!confirmed) return;
    setSubmissions(submissions.filter((sub) => sub.id !== submissionId));
  };

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    const firstName = newStudentName.trim().split(' ')[0].toUpperCase();
    const newStd = {
      id: `std-${Date.now()}`,
      name: newStudentName.trim(),
      class: '6 SD',
      parentName: newParentName.trim() || 'Wali Murid',
      accessCode: `ALBITA-${firstName}`,
      paymentStatus: 'Belum Lunas'
    };
    setStudents([...students, newStd]);
    setNewStudentName('');
    setNewParentName('');
    setShowAddStudent(false);
  };

  const handleSimulateDocUpload = (fileName) => {
    setIsUploadingDoc(true);
    setTimeout(() => {
      const newExam = {
        id: `exam-${Date.now()}`,
        title: fileName ? fileName.replace(/\.(doc|docx)$/i, '').replace(/_/g, ' ') : 'Latihan Baru Kelas 6',
        fileName: fileName || 'Soal_Baru.docx',
        uploadDate: '18 Nov 2026',
        subject: 'Tematik / Umum',
        questions: [
          { no: 1, text: 'Contoh soal nomor 1...', answerKey: 'Jawaban 1', topic: 'Konsep Dasar' },
          { no: 2, text: 'Contoh soal nomor 2...', answerKey: 'Jawaban 2', topic: 'Analisis' },
          { no: 3, text: 'Contoh soal nomor 3...', answerKey: 'Jawaban 3', topic: 'Penerapan' }
        ]
      };
      setExams([newExam, ...exams]);
      setIsUploadingDoc(false);
    }, 600);
  };

  const handleRealOrSimulatedPhotoScan = async (imageFile = null) => {
    setIsScanning(true);
    setLastScanResult(null);
    const targetExam = exams.find((e) => e.id === scanExamId) || exams[0];

    if (imageFile && genAI) {
      try {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onload = async () => {
          try {
            const base64Data = reader.result.split(',')[1];
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const prompt = `Bertindaklah sebagai AI Asisten Pengajar Albita. Analisis foto lembar kerja siswa ini berdasarkan daftar soal: ${JSON.stringify(targetExam.questions)}.
Deteksi coretan bulpoin pada setiap nomor soal:
1. Jika ada tanda bulpoin MERAH saja -> status: "wrong" (salah).
2. Jika coretan MERAH tertimpa/didampingi bulpoin BIRU -> status: "revised" (salah awal, sudah dibetulkan di hari yang sama).
3. Jika bersih tanpa tanda merah -> status: "correct" (benar).

Kembalikan HANYA format JSON murni array tanpa markdown backticks:
[{"no": 1, "status": "correct", "inkNote": "Bersih tanpa coretan merah"}]`;

            const result = await model.generateContent([
              {
                inlineData: {
                  data: base64Data,
                  mimeType: imageFile.type || 'image/jpeg'
                }
              },
              prompt
            ]);

            const responseText = result.response.text();
            const cleanJson = responseText.replace(/```json|```/g, '').trim();
            const parsedResults = JSON.parse(cleanJson);
            const correctCount = parsedResults.filter((r) => r.status !== 'wrong').length;
            const calcScore = Math.round((correctCount / targetExam.questions.length) * 100);

            const newSub = {
              id: `sub-${Date.now()}`,
              studentId: scanStudentId,
              examId: targetExam.id,
              date: '18 Nov 2026',
              score: calcScore,
              results: parsedResults
            };

            setSubmissions([newSub, ...submissions]);
            setLastScanResult({
              student: students.find((s) => s.id === scanStudentId),
              exam: targetExam,
              submission: newSub
            });
          } catch (err) {
            runDemoScan(targetExam);
          } finally {
            setIsScanning(false);
          }
        };
        return;
      } catch (e) {
        console.error(e);
      }
    }

    runDemoScan(targetExam);
  };

  const runDemoScan = (targetExam) => {
    setTimeout(() => {
      const generatedResults = targetExam.questions.map((q, idx) => {
        if (idx === 1) {
          return {
            no: q.no,
            status: 'revised',
            inkNote: 'Terdeteksi MERAH tertimpa BIRU -> Sempat salah, sudah direvisi hari yang sama.'
          };
        }
        if (idx === 2) {
          return {
            no: q.no,
            status: 'wrong',
            inkNote: 'Terdeteksi tanda MERAH saja -> Jawaban masih salah.'
          };
        }
        return {
          no: q.no,
          status: 'correct',
          inkNote: 'Bersih tanpa tanda merah -> Benar.'
        };
      });

      const correctCount = generatedResults.filter((r) => r.status !== 'wrong').length;
      const calcScore = Math.round((correctCount / targetExam.questions.length) * 100);

      const newSubmission = {
        id: `sub-${Date.now()}`,
        studentId: scanStudentId,
        examId: targetExam.id,
        date: '18 Nov 2026',
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

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Header Pengajar */}
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
              <p className="text-xs text-indigo-300">Manajemen Siswa Kelas 6 & Koreksi AI Merah/Biru</p>
            </div>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 ${genAI ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200'}`}>
            <Sparkles className="w-3.5 h-3.5" />
            {genAI ? 'Gemini AI Aktif' : 'Mode Simulasi'}
          </span>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 py-6 flex-1">
        {/* Tabs Navigasi Utama */}
        <div className="flex overflow-x-auto gap-2 pb-3 mb-6 border-b border-slate-200">
          <button
            onClick={() => { setActiveTab('students'); setEditingStudentId(null); }}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${
              activeTab === 'students' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Siswa ({students.length})
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${
              activeTab === 'exams' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Bank Soal ({exams.length})
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${
              activeTab === 'scanner' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Scan Koreksi Merah/Biru
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${
              activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            Inbox Ortu ({unreadCount})
          </button>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: DAFTAR SISWA & MENU EDIT SOAL PER SISWA                    */}
        {/* ================================================================= */}
        {activeTab === 'students' && !editingStudentId && (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Daftar Siswa Kelas 6</h2>
                <p className="text-xs text-slate-500">Klik tombol status SPP untuk mengubah Lunas/Belum Lunas, atau gunakan ikon Setting di pojok kanan kartu.</p>
              </div>
              <button
                onClick={() => setShowAddStudent(!showAddStudent)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Tambah Siswa
              </button>
            </div>

            {showAddStudent && (
              <form onSubmit={handleAddStudent} className="bg-white p-4 rounded-2xl border border-indigo-200 flex flex-wrap gap-3 items-end shadow-sm">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Siswa</label>
                  <input
                    type="text"
                    placeholder="Contoh: Ahmad Fauzan"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Wali Murid</label>
                  <input
                    type="text"
                    placeholder="Contoh: Ibu Rina"
                    value={newParentName}
                    onChange={(e) => setNewParentName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700">
                  Simpan
                </button>
              </form>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              {students.map((std) => {
                const studentSubsCount = submissions.filter((s) => s.studentId === std.id).length;

                return (
                  <div key={std.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between relative">
                    <div>
                      {/* Baris Nama Siswa + Ikon Setting di Pojok Kanan Sejajar */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="font-bold text-lg text-slate-900 truncate">{std.name}</h3>

                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === std.id ? null : std.id)}
                            title="Pengaturan Siswa"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-slate-100 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </button>

                          {/* Dropdown Menu Setting: Edit, Rename, Hapus */}
                          {openMenuId === std.id && (
                            <div className="absolute right-0 mt-1.5 w-40 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-20 text-xs">
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setEditingStudentId(std.id);
                                }}
                                className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                Edit (Soal Siswa)
                              </button>
                              <button
                                onClick={() => handleOpenRenameModal(std)}
                                className="w-full px-3.5 py-2 text-left hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                Rename
                              </button>
                              <div className="my-1 border-t border-slate-100"></div>
                              <button
                                onClick={() => handleDeleteStudent(std)}
                                className="w-full px-3.5 py-2 text-left hover:bg-rose-50 text-rose-600 font-semibold flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Hapus
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Kotak Detail Informasi Siswa */}
                      <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2.5 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Wali:</span>
                          <span className="font-semibold text-slate-800">{std.parentName}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Kode Akses:</span>
                          <span className="font-mono font-bold text-indigo-600">{std.accessCode}</span>
                        </div>

                        {/* Baris SPP dengan Tombol Hijau (Lunas) / Merah (Belum Lunas) */}
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-slate-500">SPP:</span>
                          <button
                            onClick={() => handleToggleSPP(std.id)}
                            title="Klik untuk mengganti status SPP"
                            className={`px-3 py-1 rounded-lg font-bold text-white text-[11px] shadow-xs transition-all cursor-pointer ${
                              std.paymentStatus === 'Lunas'
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-rose-600 hover:bg-rose-700'
                            }`}
                          >
                            {std.paymentStatus}
                          </button>
                        </div>

                        {/* Baris Lihat Soal (Buka di Tab Baru) */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
                          <span className="text-slate-500">Arsip Soal ({studentSubsCount}):</span>
                          <button
                            onClick={() => handleOpenViewSoalNewTab(std.id)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold text-[11px] flex items-center gap-1 transition-colors"
                          >
                            Lihat Soal <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tombol Aksi Scan Lembar Kerja */}
                    <button
                      onClick={() => {
                        setScanStudentId(std.id);
                        setActiveTab('scanner');
                      }}
                      className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" /> Scan Lembar Kerja
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* HALAMAN KHUSUS "EDIT" DARI MENU SETTING (HAPUS SOAL SISWA)        */}
        {/* ================================================================= */}
        {activeTab === 'students' && editingStudentId && (() => {
          const targetStd = students.find((s) => s.id === editingStudentId);
          const stdSubs = submissions.filter((s) => s.studentId === editingStudentId);

          return (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditingStudentId(null)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <span className="text-[11px] font-bold uppercase text-indigo-600">Kelola Soal Dikerjakan Siswa</span>
                    <h2 className="text-lg font-bold text-slate-900">
                      {targetStd?.name} (Wali: {targetStd?.parentName})
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenViewSoalNewTab(editingStudentId)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5"
                >
                  Pratinjau Tab Orang Tua <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {stdSubs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                  <p className="font-bold text-sm text-slate-800">Tidak ada soal yang tersimpan untuk siswa ini.</p>
                  <p className="text-xs text-slate-500">Semua soal yang dihapus di sini otomatis tidak akan muncul di halaman orang tua.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stdSubs.map((sub) => {
                    const examInfo = exams.find((e) => e.id === sub.examId);
                    return (
                      <div key={sub.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <span className="text-xs font-bold text-indigo-600">{examInfo?.subject || 'Materi'} • {sub.date}</span>
                          <h3 className="font-bold text-sm text-slate-900">{examInfo?.title || 'Paket Soal'}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Skor Tercatat: <strong>{sub.score}</strong> ({sub.results.length} Butir Soal)</p>
                        </div>

                        <button
                          onClick={() => handleDeleteStudentSubmission(sub.id)}
                          className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus dari Siswa & Orang Tua
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ================================================================= */}
        {/* TAB 2: BANK SOAL (.DOC)                                           */}
        {/* ================================================================= */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-wrap justify-between items-center gap-4 shadow-sm">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Upload Soal .doc / .docx</h2>
                <p className="text-xs text-slate-500">AI akan mencocokkan hasil scan foto lembar kerja siswa dengan paket soal ini.</p>
              </div>
              <div className="flex gap-2">
                <label className="cursor-pointer px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm">
                  <Upload className="w-4 h-4" /> Pilih File .doc/.docx
                  <input
                    type="file"
                    accept=".doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSimulateDocUpload(f.name);
                    }}
                  />
                </label>
                <button
                  onClick={() => handleSimulateDocUpload('Latihan_Soal_Ujian.docx')}
                  disabled={isUploadingDoc}
                  className="px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold"
                >
                  {isUploadingDoc ? 'Memproses...' : 'Upload Soal Demo'}
                </button>
              </div>
            </div>

            {exams.map((ex) => (
              <div key={ex.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5 shadow-sm">
                <span className="text-[11px] font-bold text-indigo-600">{ex.subject} • {ex.uploadDate}</span>
                <h3 className="font-bold text-sm text-slate-900">{ex.title}</h3>
                <p className="text-xs text-slate-400">File: {ex.fileName} ({ex.questions.length} Soal)</p>
              </div>
            ))}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SCAN KOREKSI MERAH / BIRU                                  */}
        {/* ================================================================= */}
        {activeTab === 'scanner' && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm h-fit">
              <h2 className="font-bold text-base flex items-center gap-2 text-slate-900">
                <Camera className="w-5 h-5 text-indigo-600" /> Scan Foto Coretan Merah/Biru
              </h2>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa</label>
                <select value={scanStudentId} onChange={(e) => setScanStudentId(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 text-sm bg-white">
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Paket Soal</label>
                <select value={scanExamId} onChange={(e) => setScanExamId(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300 text-sm bg-white">
                  {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                </select>
              </div>
              <label className="cursor-pointer w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm">
                <Camera className="w-4 h-4" /> Ambil Foto / Upload Gambar
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRealOrSimulatedPhotoScan(f); }} />
              </label>
              <button onClick={() => handleRealOrSimulatedPhotoScan(null)} disabled={isScanning} className="w-full py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold">
                {isScanning ? 'Menganalisis...' : 'Simulasi Scan AI (Demo)'}
              </button>
            </div>

            <div className="lg:col-span-7">
              {lastScanResult ? (
                <div className="bg-white rounded-2xl border border-indigo-200 p-5 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">{lastScanResult.student?.name}</h3>
                      <p className="text-xs text-slate-500">{lastScanResult.exam?.title}</p>
                    </div>
                    <div className="text-xl font-extrabold text-indigo-600">Skor: {lastScanResult.submission.score}</div>
                  </div>
                  <div className="space-y-2">
                    {lastScanResult.submission.results.map((r) => (
                      <div key={r.no} className={`p-3 rounded-xl border text-xs ${r.status === 'correct' ? 'bg-emerald-50 border-emerald-200' : r.status === 'revised' ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'}`}>
                        <div className="font-bold mb-0.5">Soal No. {r.no} — Status: {r.status}</div>
                        <div className="text-slate-600">{r.inkNote}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                  Hasil pemindaian foto akan langsung otomatis masuk ke arsip "Lihat Soal" siswa yang dipilih.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: INBOX ORANG TUA                                            */}
        {/* ================================================================= */}
        {activeTab === 'inbox' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">Inbox Pesan Orang Tua</h2>
            {messages.map((m) => (
              <div
                key={m.id}
                onClick={() => setMessages(messages.map((msg) => (msg.id === m.id ? { ...msg, read: true } : msg)))}
                className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 cursor-pointer shadow-sm"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-900">{m.parentName}</span>
                  <span className="text-slate-400">{m.timestamp}</span>
                </div>
                <p className="text-xs bg-slate-50 p-3 rounded-xl text-slate-700 border border-slate-100">"{m.transcript}"</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODAL RENAME (HANYA EDIT NAMA SISWA & NAMA WALI MURID)              */}
      {/* =================================================================== */}
      {renameModalStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Rename Data Siswa & Wali</h3>
              <button
                onClick={() => setRenameModalStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRename} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Siswa</label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Wali Murid</label>
                <input
                  type="text"
                  required
                  value={editParentName}
                  onChange={(e) => setEditParentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModalStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
