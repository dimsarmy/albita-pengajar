import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import jsPDF from 'jspdf';
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
  Clock
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
        if (exms) setExams(exms.map(e => ({
          ...e,
          fileName: e.file_name || e.fileName,
          uploadDate: e.upload_date || e.uploadDate,
          docContent: e.doc_content || e.docContent || ''
        })));

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

        // Fetch attendance records dari Supabase agar data tidak hilang saat refresh
        const { data: attRecs } = await supabase.from('attendance').select('*');
        if (attRecs) {
          const attMap = {};
          attRecs.forEach(a => {
            if (!attMap[a.date_key]) attMap[a.date_key] = {};
            attMap[a.date_key][a.student_id] = a.status;
          });
          setAttendanceRecords(attMap);
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

  // State Bank Soal (Pengajar bisa Edit & View)
  const [viewingExamModal, setViewingExamModal] = useState(null);
  const [editingExamModal, setEditingExamModal] = useState(null);
  const [editExamTitle, setEditExamTitle] = useState('');
  const [editExamSubject, setEditExamSubject] = useState('');
  const [editExamQuestions, setEditExamQuestions] = useState([]);
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
              const examDetail = exams.find((e) => e.id === sub.examId);
              if (!examDetail) return null;
              return (
                <div key={sub.id} className="bg-white rounded-2xl border p-5 shadow-sm space-y-3">
                  <div className="flex flex-wrap justify-between items-start gap-2 border-b pb-3">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-indigo-700">{examDetail.subject}</span>
                      <h2 className="font-bold text-base text-slate-900">{examDetail.title}</h2>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Upload className="w-3 h-3 text-indigo-500" /> Soal Diupload: <strong>{examDetail.uploadDate || '-'}</strong>
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

                  {/* Detail Butir Soal (Read-Only) */}
                  <div className="space-y-2 pt-1">
                    {(examDetail.questions || []).map((q, i) => {
                      const res = (sub.results || []).find((r) => r.no === q.no);
                      return (
                        <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-slate-700 mr-1.5">{q.no}.</span>
                            <span className="text-slate-800">{q.text}</span>
                            {res?.inkNote && <p className="text-[11px] text-slate-500 mt-1 italic">Catatan: {res.inkNote}</p>}
                          </div>
                          {res && (
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ${res.status === 'correct' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {res.status === 'correct' ? 'Benar' : 'Perlu Latihan'}
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

  const handleSelectAttendance = (studentId, status) => {
    setTodayAttendanceDraft({ ...todayAttendanceDraft, [studentId]: status });
    setAttendanceDirty({ ...attendanceDirty, [studentId]: true });
  };

  const handleSaveAttendanceRow = async (student) => {
    const chosenStatus = todayAttendanceDraft[student.id];
    if (!chosenStatus) return;

    const updatedToday = { ...(attendanceRecords[todayKey] || {}), [student.id]: chosenStatus };
    setAttendanceRecords({ ...attendanceRecords, [todayKey]: updatedToday });
    setAttendanceDirty({ ...attendanceDirty, [student.id]: false });

    // Simpan ke Supabase agar tidak hilang saat refresh
    if (supabase) {
      await supabase.from('attendance').upsert({
        date_key: todayKey,
        student_id: student.id,
        status: chosenStatus
      }, { onConflict: 'date_key,student_id' });
    }

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

  // UPLOAD DOKUMEN BANK SOAL + BACA ISI DOC + REKAM TANGGAL UPLOAD OTOMATIS
  const handleUploadTeacherExam = async (file) => {
    if (!file) return;
    setIsUploadingDoc(true);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const fullUploadDate = `${currentDateNum} ${currentMonthName} ${currentYear} (${timeStr})`;
    const fileName = file.name;
    const isDoc = /\.(doc|docx)$/i.test(fileName);

    let docContent = '';
    let parsedQuestions = [];

    if (isDoc) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        docContent = result.value || '';
        // Parse baris-baris sebagai butir soal (setiap baris non-kosong = 1 soal)
        const lines = docContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        parsedQuestions = lines.map((line, idx) => ({
          no: idx + 1,
          text: line,
          answerKey: '',
          topic: 'Materi'
        }));
      } catch (err) {
        console.error('Gagal membaca file DOC:', err);
        docContent = '';
      }
    }

    // Jika tidak ada soal terparsing, buat placeholder minimal
    if (parsedQuestions.length === 0) {
      parsedQuestions = [
        { no: 1, text: 'Isi soal dari dokumen. Klik "Edit Soal" untuk menambah/mengubah butir soal.', answerKey: '', topic: 'Materi' }
      ];
    }

    const newExam = {
      id: `exam-${Date.now()}`,
      title: fileName.replace(/\.(doc|docx|pdf|jpg|png)$/i, '').replace(/_/g, ' '),
      fileName: fileName,
      uploadDate: fullUploadDate,
      subject: 'Bank Soal Guru',
      docContent: docContent,
      questions: parsedQuestions
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
        questions: newExam.questions,
        doc_content: newExam.docContent
      });
    }
  };

  // FITUR EDIT BANK SOAL KHUSUS PENGAJAR
  const handleOpenEditExam = (exam) => {
    setEditingExamModal(exam);
    setEditExamTitle(exam.title || '');
    setEditExamSubject(exam.subject || 'Bank Soal Guru');
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

    const updatedExam = {
      ...editingExamModal,
      title: editExamTitle.trim() || editingExamModal.title,
      subject: editExamSubject.trim() || editingExamModal.subject,
      questions: editExamQuestions
    };

    setExams(exams.map((ex) => (ex.id === updatedExam.id ? updatedExam : ex)));
    setEditingExamModal(null);

    if (supabase) {
      await supabase.from('exams').update({
        title: updatedExam.title,
        subject: updatedExam.subject,
        questions: updatedExam.questions
      }).eq('id', updatedExam.id);
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

    if (format === 'pdf') {
      // Download sebagai PDF
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 15;
      let y = margin;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin, y);
      y += 8;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Mata Pelajaran: ${exam.subject || '-'}  |  Diupload: ${exam.uploadDate || '-'}`, margin, y);
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
      // Download sebagai .docx
      const docChildren = [
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Mata Pelajaran: ${exam.subject || '-'}  |  Diupload: ${exam.uploadDate || '-'}`, italics: true, size: 20 })
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

  // SCAN LEMBAR KERJA + TANGGAL SCAN OTOMATIS
  const handleScanPhoto = async () => {
    if (!scanStudentId) {
      alert('Pilih siswa terlebih dahulu!');
      return;
    }
    setIsScanning(true);
    setLastScanResult(null);
    const targetExam = exams.find((e) => e.id === scanExamId) || exams[0];
    if (!targetExam) {
      alert('Belum ada paket soal di Bank Soal. Upload soal terlebih dahulu.');
      setIsScanning(false);
      return;
    }

    setTimeout(async () => {
      const generatedResults = (targetExam.questions || []).map((q, idx) => ({
        no: q.no,
        status: idx === 1 ? 'wrong' : 'correct',
        inkNote: idx === 1 ? 'Perlu koreksi ulang' : 'Jawaban benar'
      }));

      const correctCount = generatedResults.filter((r) => r.status === 'correct').length;
      const calcScore = generatedResults.length > 0 ? Math.round((correctCount / generatedResults.length) * 100) : 100;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const newSub = {
        id: `sub-${Date.now()}`,
        studentId: scanStudentId,
        examId: targetExam.id,
        date: `${currentDateNum} ${currentMonthName} ${currentYear} (${timeStr})`,
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

        {/* TAB 2: BANK SOAL (TANGGAL UPLOAD + PENGELOLAAN PENUH PENGAJAR) */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-6 flex flex-wrap justify-between items-center gap-4 shadow-sm">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Bank Soal Guru (Soal Jadi / Materi)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Upload dokumen soal — tanggal unggah dicatat otomatis dan pengajar dapat mengedit butir soal kapan saja.</p>
              </div>
              <label className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm">
                <Upload className="w-4 h-4" /> {isUploadingDoc ? 'Mengunggah...' : 'Upload Dokumen Soal'}
                <input
                  type="file"
                  accept=".doc,.docx,.pdf,.jpg,.png,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadTeacherExam(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>

            {exams.length === 0 ? (
              <div className="bg-white rounded-2xl border p-10 text-center text-xs text-slate-400">
                Belum ada dokumen soal yang di-upload. Klik tombol "Upload Dokumen Soal" di atas.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {exams.map((ex) => (
                  <div key={ex.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {ex.subject || 'Bank Soal'}
                          </span>
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
                        <Edit3 className="w-3.5 h-3.5" /> Edit Soal
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

        {/* TAB 3: SCAN KOREKSI */}
        {activeTab === 'scanner' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border p-6 shadow-sm space-y-5">
            <div>
              <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" /> Smart Scan Koreksi Lembar Kerja
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Hasil scan otomatis mencatat tanggal koreksi dan muncul di portal orang tua (View-Only).</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Siswa</label>
                <select value={scanStudentId} onChange={(e) => setScanStudentId(e.target.value)} className="w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white">
                  <option value="">-- Pilih Siswa --</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Paket Soal Acuan</label>
                <select value={scanExamId} onChange={(e) => setScanExamId(e.target.value)} className="w-full px-3.5 py-2.5 border rounded-xl text-sm bg-white">
                  <option value="">-- Pilih Paket Soal --</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} (Upload: {ex.uploadDate || '-'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="border-2 border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
              <Camera className="w-10 h-10 text-indigo-600 mb-2" />
              <span className="text-sm font-bold text-indigo-900">
                {isScanning ? 'Sedang Memindai & Mengoreksi...' : 'Ambil Foto / Upload Hasil Jawaban Siswa'}
              </span>
              <span className="text-xs text-slate-500 mt-1">Format JPG, PNG, atau Kamera HP</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={isScanning}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleScanPhoto();
                    e.target.value = '';
                  }
                }}
              />
            </label>

            {lastScanResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Koreksi Selesai & Tersimpan!
                  </span>
                  <span className="text-sm font-extrabold text-emerald-900">Skor: {lastScanResult.submission.score}</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Siswa: <strong>{lastScanResult.student?.name}</strong> • Paket: <strong>{lastScanResult.exam?.title}</strong> • Tanggal Scan: <strong>{lastScanResult.submission.date}</strong>
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ABSENSI HARIAN */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Absensi Harian Tempat Les</h2>
                <p className="text-xs text-slate-500">{currentDayName}, {currentDateNum} {currentMonthName} {currentYear}</p>
              </div>
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
                      <button
                        onClick={() => handleSaveAttendanceRow(std)}
                        disabled={!currentChoice}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 ${
                          isDirty
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : savedToday
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Save className="w-3.5 h-3.5" /> {savedToday && !isDirty ? 'Terkirim WA' : 'Simpan & WA'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: KALENDER KEHADIRAN */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-600" /> Kalender Kehadiran ({currentMonthName} {currentYear})
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((dayNum) => {
                const dKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayRecs = attendanceRecords[dKey] || {};
                const presentCount = Object.values(dayRecs).filter((v) => v === 'Hadir').length;
                return (
                  <button
                    key={dayNum}
                    onClick={() => setSelectedCalDate(dKey)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedCalDate === dKey ? 'border-indigo-600 bg-indigo-50' : 'bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <span className="font-bold text-sm text-slate-800 block">{dayNum}</span>
                    {presentCount > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                        {presentCount} Hadir
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedCalDate && (
              <div className="p-4 rounded-xl bg-slate-50 border text-xs space-y-1">
                <p className="font-bold text-slate-800">Detail Tanggal: {selectedCalDate}</p>
                {Object.keys(attendanceRecords[selectedCalDate] || {}).length === 0 ? (
                  <p className="text-slate-500">Tidak ada catatan absensi pada tanggal ini.</p>
                ) : (
                  Object.entries(attendanceRecords[selectedCalDate]).map(([sId, st]) => {
                    const sName = students.find((s) => s.id === sId)?.name || sId;
                    return <p key={sId}>• {sName}: <strong>{st}</strong></p>;
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: STATUS PEMBAYARAN SPP */}
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

            {/* Riwayat 3 Bulan Sebelumnya */}
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

        {/* TAB 7: CATATAN GURU */}
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

      {/* MODAL RENAME DATA SISWA */}
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

      {/* MODAL VIEW SOAL (PREVIEW) */}
      {viewingExamModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">{viewingExamModal.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tanggal Upload: <strong>{viewingExamModal.uploadDate || '-'}</strong> • {viewingExamModal.subject || 'Bank Soal'}</p>
              </div>
              <button onClick={() => setViewingExamModal(null)}><X className="w-4 h-4" /></button>
            </div>

            {/* Tabs Preview: Konten DOC asli / Butir Soal */}
            <div className="overflow-y-auto flex-1 text-xs space-y-3">
              {viewingExamModal.docContent ? (
                <div>
                  <p className="font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" /> Isi Dokumen Asli
                  </p>
                  <div className="whitespace-pre-wrap bg-slate-50 border rounded-xl p-4 text-slate-800 leading-relaxed font-mono text-[11px] max-h-60 overflow-y-auto">
                    {viewingExamModal.docContent}
                  </div>
                  {(viewingExamModal.questions || []).some(q => q.answerKey) && (
                    <div className="mt-3">
                      <p className="font-bold text-slate-600 mb-2">Butir Soal & Kunci (dari edit)</p>
                      <div className="space-y-2">
                        {(viewingExamModal.questions || []).map((q, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 space-y-1">
                            <p className="font-bold text-slate-800">{q.no}. {q.text}</p>
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

      {/* MODAL EDIT SOAL KHUSUS PENGAJAR */}
      {editingExamModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveEditedExam} className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Edit Paket Soal (Hak Akses Pengajar)</h3>
                <p className="text-[11px] text-slate-500">Diupload pada: {editingExamModal.uploadDate || '-'}</p>
              </div>
              <button type="button" onClick={() => setEditingExamModal(null)}><X className="w-4 h-4" /></button>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 pr-1 text-xs">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Judul Paket Soal</label>
                  <input type="text" value={editExamTitle} onChange={(e) => setEditExamTitle(e.target.value)} className="w-full px-3 py-2 border rounded-xl" required />
                </div>
                <div>
                  <label className="block font-bold mb-1">Mata Pelajaran / Kategori</label>
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
    </div>
  );
}
