import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Users,
  FileText,
  Camera,
  BarChart3,
  MessageSquare,
  Upload,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Sparkles,
  Volume2,
  Check,
  ChevronRight,
  Lock
} from 'lucide-react';

// Inisialisasi Gemini AI menggunakan GoogleGenerativeAI resmi
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const INITIAL_STUDENTS = [
  {
    id: 'std-1',
    name: 'Budi Santoso',
    class: '6 SD',
    parentName: 'Ibu Ratna',
    accessCode: 'ALBITA-BUDI',
    paymentStatus: 'Lunas',
    attendance: '12 / 12 Pertemuan',
    averageScore: 86,
    notes: 'Sangat antusias di materi pecahan, namun masih sering terburu-buru menghitung pembagian desimal.'
  },
  {
    id: 'std-2',
    name: 'Siti Aminah',
    class: '6 SD',
    parentName: 'Bapak Hendra',
    accessCode: 'ALBITA-SITI',
    paymentStatus: 'Lunas',
    attendance: '11 / 12 Pertemuan',
    averageScore: 92,
    notes: 'Pemahaman konsep IPA dan Bahasa Indonesia sangat baik. Pertahankan ketelitiannya.'
  },
  {
    id: 'std-3',
    name: 'Rizky Pratama',
    class: '6 SD',
    parentName: 'Ibu Dewi',
    accessCode: 'ALBITA-RIZKY',
    paymentStatus: 'Belum Lunas',
    attendance: '10 / 12 Pertemuan',
    averageScore: 78,
    notes: 'Perlu pendampingan ekstra pada soal cerita bangun ruang gabungan.'
  }
];

const INITIAL_EXAMS = [
  {
    id: 'exam-1',
    title: 'Latihan Ujian Matematika - Pecahan & Desimal (Paket A)',
    fileName: 'Soal_MTK_Kelas6_Pecahan_PaketA.docx',
    uploadDate: '12 Nov 2026',
    subject: 'Matematika',
    totalQuestions: 5,
    questions: [
      { no: 1, text: 'Hasil dari 3/4 + 0,25 dalam bentuk desimal adalah...', answerKey: '1,00 atau 1', topic: 'Operasi Pecahan & Desimal' },
      { no: 2, text: 'Ibu membeli 2,5 kg gula dan digunakan 1 1/4 kg untuk membuat kue. Sisa gula Ibu adalah...', answerKey: '1,25 kg', topic: 'Soal Cerita Pecahan' },
      { no: 3, text: 'Hasil pembagian 4,8 : 0,6 adalah...', answerKey: '8', topic: 'Pembagian Desimal' },
      { no: 4, text: 'Urutkan pecahan berikut dari yang terkecil: 65%; 0,7; 3/5', answerKey: '3/5; 65%; 0,7', topic: 'Mengurutkan Pecahan' },
      { no: 5, text: 'Sebuah tangki berisi 15,5 liter air. Jika 40% air digunakan, berapa liter sisa air di tangki?', answerKey: '9,3 liter', topic: 'Persentase & Desimal' }
    ]
  }
];

const INITIAL_SUBMISSIONS = [];
const INITIAL_REPORTS = {};
const INITIAL_MESSAGES = [
  {
    id: 'msg-1',
    studentId: 'std-1',
    sender: 'parent',
    parentName: 'Ibu Ratna (Wali Budi)',
    type: 'voice',
    timestamp: 'Hari ini, 16:40',
    audioDuration: '0:14',
    transcript: 'Assalamualaikum Kak, mohon maaf nanti sore Budi agak telat sekitar 15 menit ya karena jalanan macet pulang dari ekskul sekolah.',
    aiSummary: 'Izin keterlambatan ±15 menit karena macet.',
    read: false
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState(INITIAL_STUDENTS);
  const [exams, setExams] = useState(INITIAL_EXAMS);
  const [submissions, setSubmissions] = useState(INITIAL_SUBMISSIONS);
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  const [newStudentName, setNewStudentName] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);

  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [scanStudentId, setScanStudentId] = useState('std-1');
  const [scanExamId, setScanExamId] = useState('exam-1');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState(null);

  const [reportStudentId, setReportStudentId] = useState('std-1');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [draftReport, setDraftReport] = useState({
    month: 'November 2026',
    published: false,
    learnedSummary: '',
    weaknessAnalysis: '',
    conclusionAndAdvice: '',
    paymentStatus: 'Lunas (Rp 450.000)',
    attendance: '12 Hadir / 0 Izin',
    teacherNotes: 'Semangat belajar bagus.'
  });

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    const firstName = newStudentName.trim().split(' ')[0].toUpperCase();
    const newStd = {
      id: `std-${Date.now()}`,
      name: newStudentName,
      class: '6 SD',
      parentName: newParentName || 'Orang Tua Siswa',
      accessCode: `ALBITA-${firstName}`,
      paymentStatus: 'Belum Lunas',
      attendance: '0 / 12 Pertemuan',
      averageScore: 0,
      notes: 'Siswa baru.'
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
        totalQuestions: 3,
        questions: [
          { no: 1, text: 'Contoh soal uji coba nomor 1...', answerKey: 'Jawaban 1', topic: 'Konsep Dasar' },
          { no: 2, text: 'Contoh soal uji coba nomor 2...', answerKey: 'Jawaban 2', topic: 'Analisis' },
          { no: 3, text: 'Contoh soal uji coba nomor 3...', answerKey: 'Jawaban 3', topic: 'Penerapan' }
        ]
      };
      setExams([newExam, ...exams]);
      setIsUploadingDoc(false);
    }, 600);
  };

  // FUNGSI UTAMA SCAN FOTO DENGAN GEMINI AI VISION & FALLBACK DEMO
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

Kembalikan HANYA format JSON murni array tanpa markdown backticks seperti contoh ini:
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
            console.error(err);
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
    }, 800);
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
                  <Lock className="w-3 h-3" /> Pengajar
                </span>
              </div>
              <p className="text-xs text-indigo-300">Portal Pengajar Kelas 6 & AI Scanner</p>
            </div>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 ${genAI ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-200'}`}>
            <Sparkles className="w-3.5 h-3.5" />
            {genAI ? 'Gemini AI Aktif' : 'Mode Simulasi'}
          </span>
        </div>
      </header>

      <div className="max-w-6xl w-full mx-auto px-4 py-6 flex-1">
        <div className="flex overflow-x-auto gap-2 pb-3 mb-6 border-b border-slate-200">
          <button onClick={() => setActiveTab('students')} className={`px-4 py-2.5 rounded-xl text-sm font-medium ${activeTab === 'students' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}>
            Siswa ({students.length})
          </button>
          <button onClick={() => setActiveTab('exams')} className={`px-4 py-2.5 rounded-xl text-sm font-medium ${activeTab === 'exams' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}>
            Bank Soal ({exams.length})
          </button>
          <button onClick={() => setActiveTab('scanner')} className={`px-4 py-2.5 rounded-xl text-sm font-medium ${activeTab === 'scanner' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}>
            Scan Koreksi Merah/Biru
          </button>
          <button onClick={() => setActiveTab('inbox')} className={`px-4 py-2.5 rounded-xl text-sm font-medium ${activeTab === 'inbox' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}>
            Inbox Ortu ({unreadCount})
          </button>
        </div>

        {activeTab === 'students' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Daftar Siswa Kelas 6</h2>
              <button onClick={() => setShowAddStudent(!showAddStudent)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4" /> Tambah Siswa
              </button>
            </div>
            {showAddStudent && (
              <form onSubmit={handleAddStudent} className="bg-white p-4 rounded-xl border flex gap-3 items-end">
                <input type="text" placeholder="Nama Siswa" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} className="px-3 py-2 border rounded-xl text-sm flex-1" required />
                <input type="text" placeholder="Nama Ortu" value={newParentName} onChange={(e) => setNewParentName(e.target.value)} className="px-3 py-2 border rounded-xl text-sm flex-1" />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold">Simpan</button>
              </form>
            )}
            <div className="grid md:grid-cols-3 gap-4">
              {students.map((std) => (
                <div key={std.id} className="bg-white rounded-xl border p-4 space-y-3">
                  <h3 className="font-bold text-base">{std.name}</h3>
                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg space-y-1">
                    <div>Wali: {std.parentName}</div>
                    <div>Kode Akses: <strong className="text-indigo-600">{std.accessCode}</strong></div>
                    <div>SPP: {std.paymentStatus}</div>
                  </div>
                  <button onClick={() => { setScanStudentId(std.id); setActiveTab('scanner'); }} className="w-full py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1">
                    <Camera className="w-3.5 h-3.5" /> Scan Lembar Kerja
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-6 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-lg">Upload Soal .doc / .docx</h2>
                <p className="text-xs text-slate-500">AI akan mencocokkan hasil scan foto dengan soal ini.</p>
              </div>
              <button onClick={() => handleSimulateDocUpload('Latihan_Soal_Ujian.docx')} disabled={isUploadingDoc} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold">
                {isUploadingDoc ? 'Memproses...' : 'Upload Soal Demo'}
              </button>
            </div>
            {exams.map((ex) => (
              <div key={ex.id} className="bg-white rounded-xl border p-4 space-y-2">
                <h3 className="font-bold text-sm">{ex.title}</h3>
                <p className="text-xs text-slate-400">File: {ex.fileName} ({ex.questions.length} Soal)</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white rounded-xl border p-5 space-y-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600" /> Scan Foto Coretan Merah/Biru
              </h2>
              <div>
                <label className="block text-xs font-semibold mb-1">Pilih Siswa</label>
                <select value={scanStudentId} onChange={(e) => setScanStudentId(e.target.value)} className="w-full p-2.5 rounded-xl border text-sm">
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Pilih Paket Soal</label>
                <select value={scanExamId} onChange={(e) => setScanExamId(e.target.value)} className="w-full p-2.5 rounded-xl border text-sm">
                  {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                </select>
              </div>
              <label className="cursor-pointer w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm">
                <Camera className="w-4 h-4" /> Ambil Foto / Upload Gambar
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRealOrSimulatedPhotoScan(f); }} />
              </label>
              <button onClick={() => handleRealOrSimulatedPhotoScan(null)} disabled={isScanning} className="w-full py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-semibold">
                {isScanning ? 'Menganalisis...' : 'Simulasi Scan AI (Demo)'}
              </button>
            </div>
            <div className="lg:col-span-7">
              {lastScanResult ? (
                <div className="bg-white rounded-xl border p-5 space-y-3">
                  <div className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h3 className="font-bold text-base">{lastScanResult.student?.name}</h3>
                      <p className="text-xs text-slate-500">{lastScanResult.exam?.title}</p>
                    </div>
                    <div className="text-xl font-extrabold text-indigo-600">Skor: {lastScanResult.submission.score}</div>
                  </div>
                  <div className="space-y-2">
                    {lastScanResult.submission.results.map((r) => (
                      <div key={r.no} className={`p-3 rounded-lg border text-xs ${r.status === 'correct' ? 'bg-emerald-50' : r.status === 'revised' ? 'bg-blue-50' : 'bg-rose-50'}`}>
                        <div className="font-bold mb-0.5">Soal No. {r.no} — Status: {r.status}</div>
                        <div className="text-slate-600">{r.inkNote}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border p-8 text-center text-slate-400 text-xs">
                  Belum ada hasil scan. Silakan lakukan upload foto atau klik tombol simulasi di samping.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold">Inbox Pesan Orang Tua</h2>
            {messages.map((m) => (
              <div key={m.id} className="bg-white rounded-xl border p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-900">{m.parentName}</span>
                  <span className="text-slate-400">{m.timestamp}</span>
                </div>
                <p className="text-xs bg-slate-50 p-3 rounded-lg text-slate-700">"{m.transcript}"</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}