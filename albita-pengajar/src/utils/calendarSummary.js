/**
 * Menghitung ringkasan status harian untuk kalender pengajar.
 * @param {string} dateKey - Format 'YYYY-MM-DD'
 * @param {Array} attendanceList - Data absensi dari tabel attendance
 * @param {Array} examsList - Data bank soal dari tabel exams
 * @param {Array} submissionsList - Data jawaban siswa dari tabel submissions
 * @param {Array} studentsList - Data master siswa (opsional untuk nama siswa kurang upload)
 */
export function getDailyCalendarSummary(
  dateKey,
  attendanceList = [],
  examsList = [],
  submissionsList = [],
  studentsList = []
) {
  const getRecordDate = (item) =>
    item?.exam_date ||
    item?.date_key ||
    item?.examDate ||
    item?.dateKey ||
    (item?.created_at ? String(item.created_at).slice(0, 10) : "");

  // 1. Siswa hadir pada tanggal tersebut
  const presentRecords = attendanceList.filter((a) => {
    const recordDate =
      a.date_key ||
      a.dateKey ||
      a.date ||
      (a.created_at ? String(a.created_at).slice(0, 10) : "");
    const status = String(a.status || "").toLowerCase();
    return recordDate === dateKey && (status === "hadir" || status === "present" || a.present === true);
  });

  const presentStudentIds = Array.from(
    new Set(presentRecords.map((a) => String(a.student_id || a.studentId)))
  );
  const hadirCount = presentStudentIds.length;

  // 2. Status Bank Soal pada tanggal tersebut
  const dayExams = examsList.filter((ex) => getRecordDate(ex) === dateKey);
  const hasBankSoal = dayExams.length > 0;
  const bankSoalStatus = hasBankSoal ? "Sudah diupload" : "Belum diupload";

  // 3. Jumlah jawaban terupload pada tanggal tersebut (hitung per siswa unik)
  const daySubmissions = submissionsList.filter((sub) => getRecordDate(sub) === dateKey);
  const uploadedStudentIds = new Set(
    daySubmissions
      .map((sub) => sub?.student_id || sub?.studentId)
      .filter(Boolean)
      .map((id) => String(id))
  );

  const uploadedCount = uploadedStudentIds.size;
  const missingCount = Math.max(0, hadirCount - uploadedCount);

  const missingStudents = presentStudentIds
    .filter((id) => !uploadedStudentIds.has(id))
    .map((id) => {
      const found = studentsList.find((s) => String(s.id) === id);
      return found?.name || found?.nama || `Siswa #${id}`;
    });

  return {
    dateKey,
    hadirCount,
    bankSoalCount: dayExams.length,
    hasBankSoal,
    bankSoalStatus, // "Sudah diupload" | "Belum diupload"
    uploadedCount,
    missingCount, // contoh: hadir 11, terupload 9 -> missingCount = 2
    missingStudents,
  };
}
