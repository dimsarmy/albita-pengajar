import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Camera,
  Upload,
  ExternalLink,
  Trash2,
  Edit3,
  FileText,
  ArrowLeft,
  Eye,
  X,
  Plus,
  Sparkles,
  Lock,
  Settings,
  Save
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
      { no: 3, text: 'Hasil pembagian 4,8 : 0,6 adalah...', answerKey: '8', topic: 'Pembagian Desimal' }
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
      { no: 2, status: 'revised', inkNote: 'Coretan Merah tertimpa Biru (Sudah direvisi)' },
      { no: 3, status: 'wrong', inkNote: 'Tanda Bulpoin Merah (Salah)' }
    ]
  }
];

export default function App() {
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

  const [messages, setMessages] = useState([
    {
      id: 'msg-1',
      parentName: 'Ibu Ratna (Wali Budi)',
      timestamp: 'Hari ini, 16:40',
      transcript: 'Assalamualaikum Kak, mohon maaf nanti sore Budi agak telat.',
      read: false
    }
  ]);

  // Menyimpan status perubahan per siswa (untuk tombol Save)
  // Bentuk: { [studentId]: { paymentStatus: '...', name: '...', parentName: '...', isDirty: boolean } }
  const [studentEdits, setStudentEdits] = useState({});

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

  const [renameModalStudent, setRenameModalStudent] = useState(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editParentName, setEditParentName] = useState('');

  const [editingStudentId, setEditingStudentId] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newParentName, setNewParentName] = useState('');

  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [scanStudentId, setScanStudentId] = useState(students[0]?.id || 'std-1');
  const [scanExamId, setScanExamId] = useState(exams[0]?.id || 'exam-1');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);

  // Jika membuka tab baru "Lihat Soal"
  if (viewStudentParam) {
    const targetStudent = students.find((s) => s.id === viewStudentParam);
    const studentSubs = submissions.filter((sub) => sub.studentId === viewStudentParam);

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <header className="bg-emerald-900 text-white py-4 px-4 shadow-sm sticky top-0 z-20">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
                Arsip Soal Dikerjakan • View Only
              </span>
              <h1 className="font-bold text-lg">{targetStudent?.name || 'Siswa'} ({targetStudent?.class || '6 SD'})</h1>
              <p className="text-xs text-emerald-200">Wali Murid: {targetStudent?.parentName}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-800 border border-emerald-700 text-xs font-semibold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Lihat Saja
            </span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {studentSubs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-sm">Belum Ada Soal yang Dikerjakan</h3>
            </div>
          ) : (
            studentSubs.map((sub) => {
              const examDetail = exams.find((e) => e.id === sub.examId);
              if (!examDetail) return null;
              return (
                <div key={sub.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
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
                          <div className="flex justify-between font-bold">
                            <span>Soal No. {q.no}</span>
                            <span className={`px-2 py-0.5 rounded-full ${res?.status === 'correct' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {res?.status === 'correct' ? 'Benar' : 'Salah'}
                            </span>
                          </div>
                          <p className="text-slate-800 font-medium">{q.text}</p>
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

  // Handle lokal saat status SPP diklik di kartu (menandai ada perubahan / isDirty)
  const handleToggleSPPLocal = (std) => {
    const currentEdit = studentEdits[std.id] || {
      paymentStatus: std.paymentStatus,
      name: std.name,
      parentName: std.parentName
    };
    const nextStatus = currentEdit.paymentStatus === 'Lunas' ? 'Belum Lunas' : 'Lunas';

    setStudentEdits({
      ...studentEdits,
      [std.id]: {
        ...currentEdit,
        paymentStatus: nextStatus,
        isDirty: true
      }
    });
  };

  // Simpan perubahan per siswa (Tombol Save)
  const handleSaveStudentChanges = (stdId) => {
    const editData = studentEdits[stdId];
    if (!editData) return;

    setStudents(
      students.map((s) =>
        s.id === stdId
          ? {
              ...s,
              paymentStatus: editData.paymentStatus,
              name: editData.name,
              parentName: editData.parentName
            }
          : s
      )
    );

    // Matikan status isDirty setelah disimpan
    setStudentEdits({
      ...studentEdits,
      [stdId]: {
        ...editData,
        isDirty: false
      }
    });
  };

  const handleOpenViewSoalNewTab = (studentId) => {
    const newTabUrl = `${window.location.origin}${window.location.pathname}?viewStudent=${studentId}`;
    window.open(newTabUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenRenameModal = (student) => {
    setOpenMenuId(null);
    setRenameModalStudent(student);
    const currentEdit = studentEdits[student.id] || {};
    setEditStudentName(currentEdit.name !== undefined ? currentEdit.name : student.name);
    setEditParentName(currentEdit.parentName !== undefined ? currentEdit.parentName : student.parentName);
  };

  const handleSaveRename = (e) => {
    e.preventDefault();
    if (!editStudentName.trim() || !renameModalStudent) return;

    const stdId = renameModalStudent.id;
    const currentEdit = studentEdits[stdId] || {
      paymentStatus: renameModalStudent.paymentStatus,
      name: renameModalStudent.name,
      parentName: renameModalStudent.parentName
    };

    setStudentEdits({
      ...studentEdits,
      [stdId]: {
        ...currentEdit,
        name: editStudentName.trim(),
        parentName: editParentName.trim() || 'Wali Murid',
        isDirty: true
      }
    });

    setRenameModalStudent(null);
  };

  const handleDeleteStudent = (student) => {
    setOpenMenuId(null);
    if (!window.confirm(`Yakin ingin menghapus permanen "${student.name}"?`)) return;
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

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
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
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 py-6 flex-1">
        <div className="flex overflow-x-auto gap-2 pb-3 mb-6 border-b border-slate-200">
          <button
            onClick={() => { setActiveTab('students'); setEditingStudentId(null); }}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium ${activeTab === 'students' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Siswa ({students.length})
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium ${activeTab === 'exams' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Bank Soal ({exams.length})
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium ${activeTab === 'scanner' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Scan Koreksi Merah/Biru
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
          >
            Inbox Ortu ({unreadCount})
          </button>
        </div>

        {activeTab === 'students' && !editingStudentId && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Daftar Siswa</h2>
              <button
                onClick={() => setShowAddStudent(!showAddStudent)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Tambah Siswa
              </button>
            </div>

            {showAddStudent && (
              <form onSubmit={handleAddStudent} className="bg-white p-4 rounded-2xl border flex gap-3 items-end shadow-sm">
                <input
                  type="text"
                  placeholder="Nama Siswa"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="px-3.5 py-2 border rounded-xl text-sm flex-1"
                  required
                />
                <input
                  type="text"
                  placeholder="Nama Wali Murid"
                  value={newParentName}
                  onChange={(e) => setNewParentName(e.target.value)}
                  className="px-3.5 py-2 border rounded-xl text-sm flex-1"
                />
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold">Simpan</button>
              </form>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              {students.map((std) => {
                const currentEdit = studentEdits[std.id] || {
                  paymentStatus: std.paymentStatus,
                  name: std.name,
                  parentName: std.parentName,
                  isDirty: false
                };
                const studentSubsCount = submissions.filter((s) => s.studentId === std.id).length;

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
                          <span className="text-slate-500">Wali:</span>
                          <span className="font-semibold text-slate-800">{currentEdit.parentName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Kode Akses:</span>
                          <span className="font-mono font-bold text-indigo-600">{std.accessCode}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">SPP:</span>
                          <button
                            onClick={() => handleToggleSPPLocal(std)}
                            className={`px-3 py-1 rounded-lg font-bold text-white text-[11px] shadow-xs cursor-pointer ${
                              currentEdit.paymentStatus === 'Lunas' ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          >
                            {currentEdit.paymentStatus}
                          </button>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t">
                          <span className="text-slate-500">Arsip Soal ({studentSubsCount}):</span>
                          <button
                            onClick={() => handleOpenViewSoalNewTab(std.id)}
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

                      {/* Tombol Save otomatis menyala jika ada perubahan (isDirty), mati jika sudah disimpan */}
                      <button
                        onClick={() => handleSaveStudentChanges(std.id)}
                        disabled={!currentEdit.isDirty}
                        className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          currentEdit.isDirty
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm animate-pulse'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {currentEdit.isDirty ? 'Simpan Perubahan (Belum Disimpan)' : 'Tersimpan'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="bg-white rounded-2xl border p-6 text-center text-sm text-slate-500">
            Menu Bank Soal aktif.
          </div>
        )}
        {activeTab === 'scanner' && (
          <div className="bg-white rounded-2xl border p-6 text-center text-sm text-slate-500">
            Menu Scanner aktif.
          </div>
        )}
        {activeTab === 'inbox' && (
          <div className="bg-white rounded-2xl border p-6 text-center text-sm text-slate-500">
            Menu Inbox aktif.
          </div>
        )}
      </div>

      {/* Modal Rename */}
      {renameModalStudent && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-base">Rename Siswa & Wali</h3>
            <form onSubmit={handleSaveRename} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Nama Siswa</label>
                <input
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Nama Wali Murid</label>
                <input
                  type="text"
                  value={editParentName}
                  onChange={(e) => setEditParentName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRenameModalStudent(null)} className="px-3 py-1.5 bg-slate-100 text-xs font-bold rounded-xl">Batal</button>
                <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
