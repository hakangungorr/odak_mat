import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client";
import { loadAuth, logout } from "../auth/authStore";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TeacherPage() {
    const nav = useNavigate();
    const { token, user } = loadAuth();

    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [reports, setReports] = useState([]);
    const [homeworks, setHomeworks] = useState([]);
    const [studentPackages, setStudentPackages] = useState([]);
    const [externalEvents, setExternalEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [sessionErr, setSessionErr] = useState("");
    const [tab, setTab] = useState("students");

    const [sessionStudentId, setSessionStudentId] = useState("");
    const [sessionDate, setSessionDate] = useState("");
    const [sessionTime, setSessionTime] = useState("09:00");
    const [sessionDuration, setSessionDuration] = useState("60");
    const [sessionMode, setSessionMode] = useState("ONLINE");
    const [sessionTopic, setSessionTopic] = useState("");

    const [profileLevel, setProfileLevel] = useState("");
    const [profileTarget, setProfileTarget] = useState("");
    const [profileStrengths, setProfileStrengths] = useState("");
    const [profileWeaknesses, setProfileWeaknesses] = useState("");

    const [reportSessionId, setReportSessionId] = useState("");
    const [reportTopic, setReportTopic] = useState("");
    const [reportRating, setReportRating] = useState("5");
    const [reportNote, setReportNote] = useState("");
    const [reportNext, setReportNext] = useState("");

    const [hwStudentId, setHwStudentId] = useState("");
    const [hwTitle, setHwTitle] = useState("");
    const [hwDesc, setHwDesc] = useState("");
    const [hwDue, setHwDue] = useState("");

    const [monthOffset, setMonthOffset] = useState(0);

    async function loadStudents() {
        setLoading(true);
        setErr("");
        try {
            const data = await apiFetch("/api/students", {
                method: "GET",
                token,
            });
            setStudents(Array.isArray(data) ? data : (data?.items ?? []));
            if (!selectedStudentId && Array.isArray(data) && data.length > 0) {
                setSelectedStudentId(data[0].id);
                setSessionStudentId(String(data[0].id));
            }
        } catch (ex) {
            setErr(ex?.message || "Öğrenciler yüklenemedi");
        } finally {
            setLoading(false);
        }
    }

    async function loadSessions() {
        setSessionErr("");
        try {
            const data = await apiFetch("/api/lesson-sessions", {
                method: "GET",
                token,
            });
            const items = Array.isArray(data) ? data : (data?.items ?? []);
            const now = new Date();
            setSessions(
                items.filter((s) => {
                    if (s.status === "COMPLETED") return false;
                    if (!s.scheduled_start) return true;
                    const d = new Date(s.scheduled_start);
                    if (Number.isNaN(d.getTime())) return true;
                    return d >= now;
                })
            );
        } catch (ex) {
            setSessionErr(ex?.message || "Dersler yüklenemedi");
        }
    }

    async function loadReports() {
        try {
            const data = await apiFetch("/api/lesson-reports", { method: "GET", token });
            setReports(Array.isArray(data) ? data : (data?.items ?? []));
        } catch { }
    }

    async function loadHomeworks() {
        try {
            const data = await apiFetch("/api/homeworks", { method: "GET", token });
            setHomeworks(Array.isArray(data) ? data : (data?.items ?? []));
        } catch { }
    }

    async function loadStudentPackages(studentId) {
        if (!studentId) {
            setStudentPackages([]);
            return;
        }
        try {
            const data = await apiFetch(`/api/packages/student-packages?student_id=${studentId}`, {
                method: "GET",
                token,
            });
            setStudentPackages(Array.isArray(data) ? data : (data?.items ?? []));
        } catch {
            setStudentPackages([]);
        }
    }

    useEffect(() => {
        loadStudents();
        loadSessions();
        loadReports();
        loadHomeworks();
        apiFetch("/api/calendar/public-calendar", { method: "GET", token })
            .then((cal) => setExternalEvents(Array.isArray(cal?.items) ? cal.items : []))
            .catch(() => setExternalEvents([]));
    }, []);

    function onLogout() {
        logout();
        nav("/login");
    }

    async function onCreateSession(e) {
        e.preventDefault();
        setSessionErr("");

        try {
            const scheduledStart = sessionDate && sessionTime
                ? `${sessionDate}T${sessionTime}:00`
                : "";
            const payload = {
                student_id: Number(sessionStudentId),
                scheduled_start: scheduledStart,
                duration_min: Number(sessionDuration),
                mode: sessionMode,
                topic: sessionTopic || undefined,
            };
            await apiFetch("/api/lesson-sessions", {
                method: "POST",
                token,
                body: payload,
            });
            setSessionDate("");
            setSessionTime("09:00");
            setSessionDuration("60");
            setSessionMode("ONLINE");
            setSessionTopic("");
            await loadSessions();
        } catch (ex) {
            setSessionErr(ex?.message || "Ders oluşturma hatası");
        }
    }

    async function onTeacherMark(sessionId) {
        setSessionErr("");
        try {
            await apiFetch(`/api/lesson-sessions/${sessionId}/teacher-mark`, {
                method: "PATCH",
                token,
                body: {},
            });
            await loadSessions();
        } catch (ex) {
            setSessionErr(ex?.message || "Ders işaretleme hatası");
        }
    }

    async function onTeacherCancel(sessionId) {
        const ok = window.confirm("Dersi iptal etmek istiyor musun? Öğrencinin hakkı düşmez.");
        if (!ok) return;
        setSessionErr("");
        try {
            await apiFetch(`/api/lesson-sessions/${sessionId}/cancel`, {
                method: "PATCH",
                token,
                body: {},
            });
            await loadSessions();
        } catch (ex) {
            setSessionErr(ex?.message || "Ders iptal hatası");
        }
    }

    async function onUpdateProfile(e) {
        e.preventDefault();
        if (!selectedStudentId) return;
        try {
            await apiFetch(`/api/students/${selectedStudentId}`, {
                method: "PATCH",
                token,
                body: {
                    level: profileLevel,
                    target_exam: profileTarget,
                    strengths: profileStrengths,
                    weaknesses: profileWeaknesses,
                },
            });
            await loadStudents();
        } catch (ex) {
            setSessionErr(ex?.message || "Profil güncelleme hatası");
        }
    }

    async function onCreateReport(e) {
        e.preventDefault();
        try {
            await apiFetch("/api/lesson-reports", {
                method: "POST",
                token,
                body: {
                    lesson_session_id: Number(reportSessionId),
                    topic: reportTopic,
                    performance_rating: Number(reportRating),
                    teacher_note: reportNote,
                    next_note: reportNext,
                },
            });
            setReportSessionId("");
            setReportTopic("");
            setReportRating("5");
            setReportNote("");
            setReportNext("");
            await loadReports();
        } catch (ex) {
            setSessionErr(ex?.message || "Rapor oluşturma hatası");
        }
    }

    async function onCreateHomework(e) {
        e.preventDefault();
        try {
            await apiFetch("/api/homeworks", {
                method: "POST",
                token,
                body: {
                    student_id: Number(hwStudentId),
                    title: hwTitle,
                    description: hwDesc,
                    due_date: hwDue || undefined,
                },
            });
            setHwStudentId("");
            setHwTitle("");
            setHwDesc("");
            setHwDue("");
            await loadHomeworks();
        } catch (ex) {
            setSessionErr(ex?.message || "Ödev oluşturma hatası");
        }
    }

    useEffect(() => {
        const s = students.find((x) => x.id === selectedStudentId);
        if (s) {
            setProfileLevel(s.level || "");
            setProfileTarget(s.target_exam || "");
            setProfileStrengths(s.strengths || "");
            setProfileWeaknesses(s.weaknesses || "");
        }
    }, [selectedStudentId, students]);

    useEffect(() => {
        loadStudentPackages(sessionStudentId ? Number(sessionStudentId) : null);
    }, [sessionStudentId]);

    const selectedStudent = students.find((s) => s.id === selectedStudentId) || null;
    const studentNameById = new Map(students.map((s) => [s.id, s.full_name]));
    const activeStudentPackage = studentPackages.find((sp) => sp.status === "ACTIVE") || studentPackages[0];
    const remainingForSession = activeStudentPackage?.remaining_lessons;

    const pendingTeacher = sessions.filter((s) => !s.teacher_marked_at && !["CANCELLED", "MISSED", "COMPLETED"].includes(s.status));
    const pendingStudent = sessions.filter((s) => s.teacher_marked_at && !s.student_marked_at && s.status === "PENDING_CONFIRMATION");
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCompleted = sessions.filter((s) => {
        if (s.status !== "COMPLETED") return false;
        const d = s.scheduled_start ? new Date(s.scheduled_start) : null;
        return d && d >= monthStart;
    }).length;
    const rate = Number(user?.teacher_rate || 0);
    const monthEarning = rate * monthCompleted;

    function formatDatePart(iso) {
        if (!iso) return "-";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleDateString();
    }

    function formatTimePart(iso) {
        if (!iso) return "-";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function buildMonthDays(offset = 0) {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
        const days = [];
        const startDay = first.getDay();
        for (let i = 0; i < startDay; i += 1) days.push(null);
        for (let d = 1; d <= last.getDate(); d += 1) {
            days.push(new Date(first.getFullYear(), first.getMonth(), d));
        }
        return { first, days };
    }

    function toKey(d) {
        return d.toISOString().slice(0, 10);
    }

    function mergeCalendarItems() {
        const items = [];
        sessions.forEach((s) => {
            if (!s.scheduled_start) return;
            items.push({
                date: s.scheduled_start.slice(0, 10),
                time: formatTimePart(s.scheduled_start),
                title: s.topic ? `Ders: ${s.topic}` : "Ders",
                type: "lesson",
            });
        });
        externalEvents.forEach((e) => {
            if (!e.start) return;
            items.push({
                date: e.start.slice(0, 10),
                time: formatTimePart(e.start),
                title: e.summary || "Etkinlik",
                type: "external",
            });
        });
        return items;
    }

    return (
        <div className="page narrow">
            <div className="page-header">
                <div className="page-title">
                    <h2>Öğretmen Paneli</h2>
                    <div className="page-subtitle">
                        {user?.email || "teacher"} · {user?.role || "TEACHER"}
                    </div>
                </div>
                <div className="page-actions">
                    <button onClick={loadStudents} disabled={loading}>Yenile</button>
                    <button className="btn-ghost" onClick={onLogout}>Çıkış</button>
                </div>
            </div>

            {err ? <div style={{ marginTop: 12, color: "crimson" }}>{err}</div> : null}
            {loading ? <div style={{ marginTop: 12 }}>Yükleniyor…</div> : null}

            <Tabs value={tab} onValueChange={setTab} className="tabs-root">
                <TabsList className="flex w-full flex-wrap gap-2 bg-transparent p-0">
                    <TabsTrigger value="students" className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-none data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                        Öğrenciler
                    </TabsTrigger>
                    <TabsTrigger value="lessons" className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-none data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                        Ders Planlarım
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-none data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                        Takvim
                    </TabsTrigger>
                    <TabsTrigger value="reports" className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-none data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                        Raporlar
                    </TabsTrigger>
                    <TabsTrigger value="homeworks" className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-none data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                        Ödevler
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {!loading && (
                <>
                    {tab === "students" && (
                        <div style={{
                            marginTop: 16,
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 16
                        }}>
                            <style>{`
                                @media (min-width: 768px) {
                                    .students-grid {
                                        grid-template-columns: 1.3fr 0.7fr !important;
                                    }
                                }
                            `}</style>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "1fr",
                                gap: 16
                            }} className="students-grid">
                                <div className="card">
                                    <h3 className="section-title">Öğrencilerim ({students.length})</h3>
                                    {students.length === 0 ? (
                                        <div>Henüz atanmış öğrencin yok.</div>
                                    ) : (
                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr style={{ textAlign: "left" }}>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Ad Soyad</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Sınıf</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Email</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>ID</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {students.map((s) => (
                                                        <tr
                                                            key={s.id}
                                                            onClick={() => setSelectedStudentId(s.id)}
                                                            style={{
                                                                cursor: "pointer",
                                                                background: selectedStudentId === s.id ? "#f7f7f7" : "transparent",
                                                            }}
                                                        >
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                {s.full_name}
                                                            </td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                {s.grade ?? "-"}
                                                            </td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                {s.email || "-"}
                                                            </td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                {s.id}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                                <div className="card">
                                    <h3 className="section-title">Öğrenci Detayı</h3>
                                    {selectedStudent ? (
                                        <div style={{ display: "grid", gap: 6 }}>
                                            <div><strong>Ad Soyad:</strong> {selectedStudent.full_name}</div>
                                            <div><strong>Email:</strong> {selectedStudent.email || "-"}</div>
                                            <div><strong>Sınıf:</strong> {selectedStudent.grade ?? "-"}</div>
                                            <div><strong>Seviye:</strong> {selectedStudent.level || "-"}</div>
                                            <div><strong>Hedef Sınav:</strong> {selectedStudent.target_exam || "-"}</div>
                                            <div><strong>ID:</strong> {selectedStudent.id}</div>
                                            <div><strong>Kalan Ders Hakkı:</strong> {activeStudentPackage?.remaining_lessons ?? "-"}</div>
                                        </div>
                                    ) : (
                                        <div>Bir öğrenci seç.</div>
                                    )}
                                    {selectedStudent ? (
                                        <form onSubmit={onUpdateProfile} style={{ display: "grid", gap: 8, marginTop: 12 }}>
                                            <input placeholder="Seviye" value={profileLevel} onChange={(e) => setProfileLevel(e.target.value)} />
                                            <input placeholder="Hedef sınav" value={profileTarget} onChange={(e) => setProfileTarget(e.target.value)} />
                                            <textarea placeholder="Güçlü konular" value={profileStrengths} onChange={(e) => setProfileStrengths(e.target.value)} />
                                            <textarea placeholder="Zayıf konular" value={profileWeaknesses} onChange={(e) => setProfileWeaknesses(e.target.value)} />
                                            <button>Profili Güncelle</button>
                                        </form>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "lessons" && (
                        <div style={{
                            marginTop: 24,
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 16
                        }}>
                            <style>{`
                                @media (min-width: 768px) {
                                    .lessons-grid {
                                        grid-template-columns: 1.3fr 0.7fr !important;
                                    }
                                }
                            `}</style>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "1fr",
                                gap: 16
                            }} className="lessons-grid">
                                <div className="card">
                                    <h3 className="section-title">Derslerim ({sessions.length})</h3>
                                    {(pendingTeacher.length > 0 || pendingStudent.length > 0) && (
                                        <div style={{ marginBottom: 10, fontSize: 13, color: "#7c2d12" }}>
                                            {pendingTeacher.length > 0 && (
                                                <div>Senin onayını bekleyen ders: {pendingTeacher.length}</div>
                                            )}
                                            {pendingStudent.length > 0 && (
                                                <div>Öğrenci onayı bekleyen ders: {pendingStudent.length}</div>
                                            )}
                                        </div>
                                    )}
                                    {sessionErr ? <div style={{ color: "crimson" }}>{sessionErr}</div> : null}
                                    {sessions.length === 0 ? (
                                        <div>Henüz ders oluşturulmadı.</div>
                                    ) : (
                                        <>
                                            <div className="table-wrap">
                                                <table className="table-desktop">
                                                    <thead>
                                                        <tr style={{ textAlign: "left" }}>
                                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Tarih</th>
                                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Saat</th>
                                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrenci</th>
                                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Süre</th>
                                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Mod</th>
                                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>İptal Eden</th>
                                                            <th style={{ borderBottom: "1px solid #eee", padding: 8 }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sessions.map((s) => {
                                                            const statusColor = {
                                                                PLANNED: "#2563eb",
                                                                PENDING_CONFIRMATION: "#b45309",
                                                                COMPLETED: "#15803d",
                                                                CANCELLED: "#b91c1c",
                                                                MISSED: "#6b7280",
                                                            }[s.status] || "#111827";
                                                            const canMark = !["CANCELLED", "MISSED", "COMPLETED"].includes(s.status);
                                                            const canCancel = !["CANCELLED", "MISSED", "COMPLETED"].includes(s.status);
                                                            return (
                                                                <tr key={s.id}>
                                                                    <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                        {formatDatePart(s.scheduled_start)}
                                                                    </td>
                                                                    <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                        {formatTimePart(s.scheduled_start)}
                                                                    </td>
                                                                    <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                        {studentNameById.get(s.student_id) || `#${s.student_id}`}
                                                                    </td>
                                                                    <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                        {s.duration_min} dk
                                                                    </td>
                                                                    <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                        {s.mode}
                                                                    </td>
                                                                    <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                        <span style={{
                                                                            display: "inline-block",
                                                                            padding: "2px 8px",
                                                                            borderRadius: 999,
                                                                            background: statusColor + "22",
                                                                            color: statusColor,
                                                                            fontSize: 12,
                                                                            fontWeight: 600,
                                                                        }}>
                                                                            {s.status}
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                        {s.cancelled_by_role || "-"}
                                                                    </td>
                                                                    <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                        <button
                                                                            disabled={!canMark || !!s.teacher_marked_at}
                                                                            onClick={() => onTeacherMark(s.id)}
                                                                        >
                                                                            {s.teacher_marked_at ? "İşaretlendi" : "Dersi Yaptım"}
                                                                        </button>
                                                                        <button
                                                                            style={{ marginLeft: 6 }}
                                                                            disabled={!canCancel}
                                                                            onClick={() => onTeacherCancel(s.id)}
                                                                        >
                                                                            İptal Et
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="stack-cards">
                                                {sessions.map((s) => (
                                                    <div key={s.id} className="stack-card">
                                                        <div><strong>Tarih:</strong> {formatDatePart(s.scheduled_start)}</div>
                                                        <div><strong>Saat:</strong> {formatTimePart(s.scheduled_start)}</div>
                                                        <div><strong>Öğrenci:</strong> {studentNameById.get(s.student_id) || `#${s.student_id}`}</div>
                                                        <div><strong>Süre:</strong> {s.duration_min} dk</div>
                                                        <div><strong>Durum:</strong> {s.status}</div>
                                                        <div style={{ marginTop: 8 }}>
                                                            <button
                                                                disabled={!(!["CANCELLED", "MISSED", "COMPLETED"].includes(s.status)) || !!s.teacher_marked_at}
                                                                onClick={() => onTeacherMark(s.id)}
                                                            >
                                                                {s.teacher_marked_at ? "İşaretlendi" : "Dersi Yaptım"}
                                                            </button>
                                                            <button
                                                                style={{ marginTop: 6 }}
                                                                disabled={!(!["CANCELLED", "MISSED", "COMPLETED"].includes(s.status))}
                                                                onClick={() => onTeacherCancel(s.id)}
                                                            >
                                                                İptal Et
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div>
                                    <div className="card">
                                        <h3 className="section-title">Ders Planla</h3>
                                        <form onSubmit={onCreateSession} style={{ display: "grid", gap: 10 }}>
                                            <select
                                                value={sessionStudentId}
                                                onChange={(e) => setSessionStudentId(e.target.value)}
                                            >
                                                <option value="">Öğrenci seç</option>
                                                {students.map((s) => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.full_name}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="date"
                                                value={sessionDate}
                                                min={new Date().toISOString().slice(0, 10)}
                                                onChange={(e) => setSessionDate(e.target.value)}
                                            />
                                            <select
                                                value={sessionTime}
                                                onChange={(e) => setSessionTime(e.target.value)}
                                            >
                                                {Array.from({ length: 48 }, (_, i) => {
                                                    const minutes = 9 * 60 + i * 15;
                                                    if (minutes > 21 * 60) return null;
                                                    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
                                                    const mm = String(minutes % 60).padStart(2, "0");
                                                    const label = `${hh}:${mm}`;
                                                    return (
                                                        <option key={label} value={label}>
                                                            {label}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <input
                                                type="number"
                                                min="15"
                                                step="5"
                                                value={sessionDuration}
                                                onChange={(e) => setSessionDuration(e.target.value)}
                                                placeholder="Süre (dk)"
                                            />
                                            <select
                                                value={sessionMode}
                                                onChange={(e) => setSessionMode(e.target.value)}
                                            >
                                                <option value="ONLINE">ONLINE</option>
                                                <option value="IN_PERSON">IN_PERSON</option>
                                            </select>
                                            <input
                                                placeholder="Konu (opsiyonel)"
                                                value={sessionTopic}
                                                onChange={(e) => setSessionTopic(e.target.value)}
                                            />
                                            {remainingForSession !== undefined && remainingForSession <= 0 ? (
                                                <div style={{ fontSize: 12, color: "#b91c1c" }}>
                                                    Bu öğrencinin ders hakkı bitmiş. Yeni ders oluşturulamaz.
                                                </div>
                                            ) : null}
                                            <button disabled={!sessionStudentId || !sessionDate || !sessionTime || remainingForSession === 0}>
                                                Oluştur
                                            </button>
                                        </form>
                                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                                            Tarih ve saat ayrı seçilir. Saatler 15 dakikalık aralıktadır.
                                        </div>
                                    </div>

                                    <div className="card" style={{ marginTop: 16 }}>
                                        <h3 className="section-title">Bu Ay Kazanç</h3>
                                        <div><strong>Ders sayısı:</strong> {monthCompleted}</div>
                                        <div><strong>Ücret/Ders:</strong> {rate || "-"}₺</div>
                                        <div><strong>Toplam:</strong> {monthEarning || "-"}₺</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "calendar" && (
                        <div className="calendar-wrap" style={{ marginTop: 24 }}>
                            <div className="calendar-header">
                                <h3 style={{ margin: 0 }}>Takvim (Ders + Google)</h3>
                                <div className="page-actions">
                                    <button onClick={() => setMonthOffset((m) => m - 1)}>‹</button>
                                    <button onClick={() => setMonthOffset(0)}>Bugün</button>
                                    <button onClick={() => setMonthOffset((m) => m + 1)}>›</button>
                                </div>
                            </div>
                            {(() => {
                                const { first, days } = buildMonthDays(monthOffset);
                                const items = mergeCalendarItems();
                                const byDate = new Map();
                                items.forEach((it) => {
                                    if (!byDate.has(it.date)) byDate.set(it.date, []);
                                    byDate.get(it.date).push(it);
                                });
                                return (
                                    <>
                                        <div style={{ marginBottom: 8, color: "#5e5e67" }}>
                                            {first.toLocaleString([], { month: "long", year: "numeric" })}
                                        </div>
                                        <div className="calendar-grid">
                                            {days.map((d, idx) => {
                                                if (!d) return <div key={`e-${idx}`} className="calendar-cell" />;
                                                const key = toKey(d);
                                                const dayItems = byDate.get(key) || [];
                                                return (
                                                    <div key={key} className="calendar-cell">
                                                        <div className="calendar-day">{d.getDate()}</div>
                                                        {dayItems.map((it, i) => (
                                                            <span key={`${key}-${i}`} className={`calendar-item ${it.type}`}>
                                                                {it.time} · {it.title}
                                                            </span>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {tab === "reports" && (
                        <div style={{
                            marginTop: 24,
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 16
                        }}>
                            <style>{`
                                @media (min-width: 768px) {
                                    .reports-grid {
                                        grid-template-columns: 1.3fr 0.7fr !important;
                                    }
                                }
                            `}</style>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "1fr",
                                gap: 16
                            }} className="reports-grid">
                                <div className="card">
                                    <h3 className="section-title">Ders Raporları ({reports.length})</h3>
                                    {reports.length === 0 ? (
                                        <div>Henüz rapor yok.</div>
                                    ) : (
                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr style={{ textAlign: "left" }}>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Tarih</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrenci</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Konu</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Puan</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğretmen Notu</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Sonraki Ders Notu</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reports.map((r) => (
                                                        <tr key={r.id}>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                {formatDatePart(r.created_at)}
                                                            </td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                {studentNameById.get(r.student_id) || `#${r.student_id}`}
                                                            </td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.topic || "-"}</td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.performance_rating ?? "-"}</td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.teacher_note || "-"}</td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{r.next_note || "-"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                                <div className="card">
                                    <h3 className="section-title">Ders Sonu Raporu</h3>
                                    <form onSubmit={onCreateReport} style={{ display: "grid", gap: 10 }}>
                                        <select value={reportSessionId} onChange={(e) => setReportSessionId(e.target.value)}>
                                            <option value="">Ders seç</option>
                                            {sessions.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {studentNameById.get(s.student_id) || `#${s.student_id}`} · {s.scheduled_start?.replace("T", " ").slice(0, 16)}
                                                </option>
                                            ))}
                                        </select>
                                        <input placeholder="İşlenen konu" value={reportTopic} onChange={(e) => setReportTopic(e.target.value)} />
                                        <input type="number" min="1" max="5" value={reportRating} onChange={(e) => setReportRating(e.target.value)} />
                                        <textarea placeholder="Öğretmen notu" value={reportNote} onChange={(e) => setReportNote(e.target.value)} />
                                        <textarea placeholder="Bir sonraki ders notu" value={reportNext} onChange={(e) => setReportNext(e.target.value)} />
                                        <button disabled={!reportSessionId}>Kaydet</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "homeworks" && (
                        <div style={{
                            marginTop: 24,
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 16
                        }}>
                            <style>{`
                                @media (min-width: 768px) {
                                    .homeworks-grid {
                                        grid-template-columns: 1.3fr 0.7fr !important;
                                    }
                                }
                            `}</style>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "1fr",
                                gap: 16
                            }} className="homeworks-grid">
                                <div className="card">
                                    <h3 className="section-title">Ödevler ({homeworks.length})</h3>
                                    {homeworks.length === 0 ? (
                                        <div>Ödev yok.</div>
                                    ) : (
                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr style={{ textAlign: "left" }}>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrenci</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Başlık</th>
                                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {homeworks.map((h) => (
                                                        <tr key={h.id}>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                                {studentNameById.get(h.student_id) || `#${h.student_id}`}
                                                            </td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{h.title}</td>
                                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{h.status}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                                <div className="card">
                                    <h3 className="section-title">Ödev Ver</h3>
                                    <form onSubmit={onCreateHomework} style={{ display: "grid", gap: 10 }}>
                                        <select value={hwStudentId} onChange={(e) => setHwStudentId(e.target.value)}>
                                            <option value="">Öğrenci seç</option>
                                            {students.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.full_name}
                                                </option>
                                            ))}
                                        </select>
                                        <input placeholder="Başlık" value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} />
                                        <textarea placeholder="Açıklama" value={hwDesc} onChange={(e) => setHwDesc(e.target.value)} />
                                        <input type="datetime-local" value={hwDue} onChange={(e) => setHwDue(e.target.value)} />
                                        <button disabled={!hwStudentId || !hwTitle}>Ödev Oluştur</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
