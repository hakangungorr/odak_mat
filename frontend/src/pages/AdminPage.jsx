import React, { useEffect, useMemo, useState } from "react";
import {
    getStudents,
    createStudent,
    getTeachers,
    createTeacher,
    deleteTeacher,
    updateTeacher,
    deleteStudent,
    getEnrollments,
    createEnrollment,
    getLessonSessions,
    updateLessonSession,
    cancelLessonSession,
    deleteLessonSession,
    getPackages,
    createPackage,
    getStudentPackages,
    assignPackage,
} from "../api/admin";
import { loadAuth, logout } from "../auth/authStore";
import { useNavigate } from "react-router-dom";

function normalizeId(x) {
    // backend bazen id, bazen user_id döndürebilir
    return x?.id ?? x?.user_id ?? x?.teacher_user_id ?? x?.student_id ?? null;
}

export default function AdminPage() {
    const nav = useNavigate();
    const { user } = loadAuth();

    const [tab, setTab] = useState("teachers"); // teachers | students | link | lessons | packages
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [packages, setPackages] = useState([]);
    const [studentPackages, setStudentPackages] = useState([]);
    const [lessonFilterTeacher, setLessonFilterTeacher] = useState("");
    const [lessonFilterStudent, setLessonFilterStudent] = useState("");
    const [lessonFilterFrom, setLessonFilterFrom] = useState("");
    const [lessonFilterTo, setLessonFilterTo] = useState("");
    const [lessonFilterStatus, setLessonFilterStatus] = useState("");

    const [expandedTeacherId, setExpandedTeacherId] = useState(null);

    // forms
    const [newStudentName, setNewStudentName] = useState("");
    const [newStudentGrade, setNewStudentGrade] = useState("");
    const [newStudentEmail, setNewStudentEmail] = useState("");
    const [newStudentPassword, setNewStudentPassword] = useState("");

    const [newTeacherName, setNewTeacherName] = useState("");
    const [newTeacherEmail, setNewTeacherEmail] = useState("");
    const [newTeacherPassword, setNewTeacherPassword] = useState("");

    const [linkTeacherId, setLinkTeacherId] = useState("");
    const [linkStudentId, setLinkStudentId] = useState("");
    const [teacherRateEdits, setTeacherRateEdits] = useState({});

    const [newPackageName, setNewPackageName] = useState("");
    const [newPackageCount, setNewPackageCount] = useState("");
    const [newPackagePrice, setNewPackagePrice] = useState("");
    const [newPackageExpire, setNewPackageExpire] = useState("");

    const [assignStudentId, setAssignStudentId] = useState("");
    const [assignPackageId, setAssignPackageId] = useState("");

    async function loadAll() {
        setLoading(true);
        setErr("");
        try {
            const [t, s, e, l, p, sp] = await Promise.all([
                getTeachers(),
                getStudents(),
                getEnrollments(),
                getLessonSessions(),
                getPackages(),
                getStudentPackages(),
            ]);
            setTeachers(Array.isArray(t) ? t : (t?.items ?? []));
            setStudents(Array.isArray(s) ? s : (s?.items ?? []));
            setEnrollments(Array.isArray(e) ? e : (e?.items ?? []));
            setLessons(Array.isArray(l) ? l : (l?.items ?? []));
            setPackages(Array.isArray(p) ? p : (p?.items ?? []));
            setStudentPackages(Array.isArray(sp) ? sp : (sp?.items ?? []));
        } catch (ex) {
            setErr(ex?.message || "Yükleme hatası");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAll();
    }, []);

    // teacherId -> studentIds map
    const teacherToStudentIds = useMemo(() => {
        const map = new Map();
        for (const en of enrollments) {
            const tId = en.teacher_user_id ?? en.teacher_id ?? en.teacherId ?? en.teacher?.id;
            const sId = en.student_id ?? en.studentId ?? en.student?.id;
            if (!tId || !sId) continue;
            if (!map.has(tId)) map.set(tId, []);
            map.get(tId).push(sId);
        }
        return map;
    }, [enrollments]);

    function studentsOfTeacher(teacher) {
        const tId = teacher.id ?? teacher.user_id;
        const sIds = teacherToStudentIds.get(tId) || [];
        const setIds = new Set(sIds);
        return students.filter((st) => setIds.has(st.id));
    }

    async function onCreateStudent(e) {
        e.preventDefault();
        setErr("");
        try {
            const payload = {
                full_name: newStudentName,
                grade: newStudentGrade ? Number(newStudentGrade) : null,
                email: newStudentEmail,
                password: newStudentPassword,
            };
            await createStudent(payload);
            setNewStudentName("");
            setNewStudentGrade("");
            setNewStudentEmail("");
            setNewStudentPassword("");
            await loadAll();
            setTab("students");
        } catch (ex) {
            setErr(ex?.message || "Öğrenci oluşturma hatası");
        }
    }

    async function onDeleteStudent(studentId, studentName) {
        const hasPackage = studentPackages.some((sp) => sp.student_id === studentId);
        const msg = hasPackage
            ? `${studentName || "Öğrenci"} silinsin mi? Bu öğrencinin aktif paketi var. Silmek istediğine emin misin?`
            : `${studentName || "Öğrenci"} silinsin mi?`;
        const ok = window.confirm(msg);
        if (!ok) return;
        setErr("");
        try {
            await deleteStudent(studentId);
            await loadAll();
        } catch (ex) {
            setErr(ex?.message || "Öğrenci silme hatası");
        }
    }

    async function onCreateTeacher(e) {
        e.preventDefault();
        setErr("");
        try {
            const payload = {
                full_name: newTeacherName,
                email: newTeacherEmail,
                password: newTeacherPassword,
                role_key: "TEACHER",
            };
            await createTeacher(payload);
            setNewTeacherName("");
            setNewTeacherEmail("");
            setNewTeacherPassword("");
            await loadAll();
            setTab("teachers");
        } catch (ex) {
            setErr(ex?.message || "Öğretmen oluşturma hatası");
        }
    }

    async function onUpdateTeacherRate(teacherUserId) {
        setErr("");
        try {
            const rate = teacherRateEdits[teacherUserId];
            await updateTeacher(teacherUserId, { teacher_rate: rate });
            await loadAll();
        } catch (ex) {
            setErr(ex?.message || "Öğretmen ücret güncelleme hatası");
        }
    }
    async function onDeleteTeacher(teacherUserId, teacherName) {
        const ok = window.confirm(`${teacherName || "Öğretmen"} silinsin mi?`);
        if (!ok) return;
        setErr("");
        try {
            await deleteTeacher(teacherUserId);
            await loadAll();
        } catch (ex) {
            setErr(ex?.message || "Öğretmen silme hatası");
        }
    }

    async function onCreateLink(e) {
        e.preventDefault();
        setErr("");
        try {
            const payload = {
                teacher_user_id: Number(linkTeacherId),
                student_id: Number(linkStudentId),
            };
            await createEnrollment(payload);
            setLinkTeacherId("");
            setLinkStudentId("");
            await loadAll();
            setTab("teachers");
        } catch (ex) {
            setErr(ex?.message || "Eşleştirme hatası");
        }
    }

    async function onCreatePackage(e) {
        e.preventDefault();
        setErr("");
        try {
            const payload = {
                name: newPackageName,
                lesson_count: Number(newPackageCount),
                price: newPackagePrice ? Number(newPackagePrice) : undefined,
                expires_in_days: newPackageExpire ? Number(newPackageExpire) : undefined,
            };
            await createPackage(payload);
            setNewPackageName("");
            setNewPackageCount("");
            setNewPackagePrice("");
            setNewPackageExpire("");
            await loadAll();
            setTab("packages");
        } catch (ex) {
            setErr(ex?.message || "Paket oluşturma hatası");
        }
    }

    async function onAssignPackage(e) {
        e.preventDefault();
        setErr("");
        try {
            const payload = {
                student_id: Number(assignStudentId),
                package_id: Number(assignPackageId),
            };
            await assignPackage(payload);
            setAssignStudentId("");
            setAssignPackageId("");
            await loadAll();
        } catch (ex) {
            setErr(ex?.message || "Paket atama hatası");
        }
    }

    async function onCancelLesson(lessonId) {
        const ok = window.confirm("Dersi iptal etmek istiyor musun?");
        if (!ok) return;
        setErr("");
        try {
            await cancelLessonSession(lessonId);
            await loadAll();
        } catch (ex) {
            setErr(ex?.message || "Ders iptal hatası");
        }
    }

    async function onDeleteLesson(lessonId) {
        const ok = window.confirm("Dersi kalıcı olarak silmek istiyor musun?");
        if (!ok) return;
        setErr("");
        try {
            await deleteLessonSession(lessonId);
            await loadAll();
        } catch (ex) {
            setErr(ex?.message || "Ders silme hatası");
        }
    }

    function onLogout() {
        logout();
        nav("/login");
    }

    return (
        <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                    <h2 style={{ margin: 0 }}>Admin Panel</h2>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>
                        {user?.email || "admin"} · {user?.role || "ADMIN"}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={loadAll} disabled={loading}>Yenile</button>
                    <button onClick={onLogout}>Çıkış</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => setTab("teachers")} style={{ fontWeight: tab === "teachers" ? "700" : "400" }}>
                    Öğretmenler
                </button>
                <button onClick={() => setTab("students")} style={{ fontWeight: tab === "students" ? "700" : "400" }}>
                    Öğrenciler
                </button>
                <button onClick={() => setTab("link")} style={{ fontWeight: tab === "link" ? "700" : "400" }}>
                    Öğretmen-Öğrenci Eşleştir
                </button>
                <button onClick={() => setTab("lessons")} style={{ fontWeight: tab === "lessons" ? "700" : "400" }}>
                    Ders Planları
                </button>
                <button onClick={() => setTab("packages")} style={{ fontWeight: tab === "packages" ? "700" : "400" }}>
                    Paketler
                </button>
            </div>

            {err ? (
                <div style={{ marginTop: 12, color: "crimson" }}>{err}</div>
            ) : null}

            {loading ? (
                <div style={{ marginTop: 12 }}>Yükleniyor…</div>
            ) : null}

            {/* TEACHERS TAB */}
            {tab === "teachers" && !loading && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
                    {/* Teacher List */}
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğretmenler ({teachers.length})</h3>

                        {teachers.length === 0 ? <div>Öğretmen yok.</div> : null}

                        <div style={{ display: "grid", gap: 8 }}>
                            {teachers.map((t) => {
                                const tid = t.id ?? t.user_id;
                                const isOpen = expandedTeacherId === tid;
                                const linked = studentsOfTeacher(t);

                                return (
                                    <div key={tid} style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: 10 }}>
                                        <div
                                            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}
                                            onClick={() => setExpandedTeacherId(isOpen ? null : tid)}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700 }}>
                                                    {t.full_name || t.name || "İsimsiz öğretmen"}
                                                </div>
                                                <div style={{ fontSize: 13, opacity: 0.75 }}>
                                                    {t.email || ""}
                                                </div>
                                                <div style={{ fontSize: 13, opacity: 0.75 }}>
                                                    Ücret/Ders: {t.teacher_rate ?? "-"}
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                <div style={{ fontSize: 13, opacity: 0.8 }}>
                                                    {linked.length} öğrenci
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteTeacher(tid, t.full_name || t.name);
                                                    }}
                                                    style={{ fontSize: 12 }}
                                                >
                                                    Sil
                                                </button>
                                            </div>
                                        </div>

                                        {isOpen && (
                                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #eee" }}>
                                                <div style={{ fontWeight: 600, marginBottom: 6 }}>Bağlı Öğrenciler</div>
                                                <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
                                                    <input
                                                        placeholder="Ücret/Ders"
                                                        value={teacherRateEdits[tid] ?? t.teacher_rate ?? ""}
                                                        onChange={(e) =>
                                                            setTeacherRateEdits((prev) => ({ ...prev, [tid]: e.target.value }))
                                                        }
                                                        style={{ width: 140 }}
                                                    />
                                                    <button onClick={() => onUpdateTeacherRate(tid)}>
                                                        Ücreti Güncelle
                                                    </button>
                                                </div>
                                                {linked.length === 0 ? (
                                                    <div style={{ fontSize: 13, opacity: 0.75 }}>Henüz bağlı öğrenci yok.</div>
                                                ) : (
                                                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                                                        {linked.map((s) => (
                                                            <li key={s.id}>
                                                                {s.full_name}{" "}
                                                                <span style={{ fontSize: 12, opacity: 0.7 }}>
                                                                    (Sınıf: {s.grade ?? "-"})
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Create Teacher */}
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğretmen Oluştur</h3>
                        <form onSubmit={onCreateTeacher} style={{ display: "grid", gap: 10 }}>
                            <input
                                placeholder="Ad Soyad"
                                value={newTeacherName}
                                onChange={(e) => setNewTeacherName(e.target.value)}
                            />
                            <input
                                placeholder="Email"
                                value={newTeacherEmail}
                                onChange={(e) => setNewTeacherEmail(e.target.value)}
                            />
                            <input
                                placeholder="Şifre"
                                type="password"
                                value={newTeacherPassword}
                                onChange={(e) => setNewTeacherPassword(e.target.value)}
                            />
                            <button>Oluştur</button>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                                Not: Backend öğretmeni “User” olarak oluşturuyorsa bu endpoint onu yapmalı.
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* STUDENTS TAB */}
            {tab === "students" && !loading && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğrenciler ({students.length})</h3>

                        {students.length === 0 ? <div>Öğrenci yok.</div> : null}

                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left" }}>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Ad Soyad</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Sınıf</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>ID</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => (
                                    <tr key={s.id}>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                            {s.full_name}
                                        </td>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                            {s.grade ?? "-"}
                                        </td>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                            {s.id}
                                        </td>
                                        <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                            <button onClick={() => onDeleteStudent(s.id, s.full_name)} style={{ fontSize: 12 }}>
                                                Sil
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Öğrenci Oluştur</h3>
                        <form onSubmit={onCreateStudent} style={{ display: "grid", gap: 10 }}>
                            <input
                                placeholder="Ad Soyad"
                                value={newStudentName}
                                onChange={(e) => setNewStudentName(e.target.value)}
                            />
                            <input
                                placeholder="Sınıf (ör: 8)"
                                value={newStudentGrade}
                                onChange={(e) => setNewStudentGrade(e.target.value)}
                            />
                            <input
                                placeholder="Email"
                                value={newStudentEmail}
                                onChange={(e) => setNewStudentEmail(e.target.value)}
                            />
                            <input
                                placeholder="Şifre"
                                type="password"
                                value={newStudentPassword}
                                onChange={(e) => setNewStudentPassword(e.target.value)}
                            />
                            <button>Oluştur</button>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                                Not: Bu işlem öğrenci için login hesabını da oluşturur.
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LINK TAB */}
            {tab === "link" && !loading && (
                <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Öğretmen-Öğrenci Eşleştir</h3>

                    <form onSubmit={onCreateLink} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "center" }}>
                        <select value={linkTeacherId} onChange={(e) => setLinkTeacherId(e.target.value)}>
                            <option value="">Öğretmen seç</option>
                            {teachers.map((t) => {
                                const tid = t.id ?? t.user_id;
                                return (
                                    <option key={tid} value={tid}>
                                        {t.full_name || t.name} ({t.email || tid})
                                    </option>
                                );
                            })}
                        </select>

                        <select value={linkStudentId} onChange={(e) => setLinkStudentId(e.target.value)}>
                            <option value="">Öğrenci seç</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.full_name} (Sınıf: {s.grade ?? "-"})
                                </option>
                            ))}
                        </select>

                        <button disabled={!linkTeacherId || !linkStudentId}>Eşleştir</button>
                    </form>

                    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                        Bu işlem backend’de `POST /api/enrollments` ile teacher_user_id + student_id gönderir.
                    </div>
                </div>
            )}

            {/* LESSONS TAB */}
            {tab === "lessons" && !loading && (
                <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Ders Planları ({lessons.length})</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                        <select value={lessonFilterTeacher} onChange={(e) => setLessonFilterTeacher(e.target.value)}>
                            <option value="">Tüm öğretmenler</option>
                            {teachers.map((t) => {
                                const tid = t.id ?? t.user_id;
                                return (
                                    <option key={tid} value={tid}>
                                        {t.full_name || t.name} ({t.email || tid})
                                    </option>
                                );
                            })}
                        </select>
                        <select value={lessonFilterStudent} onChange={(e) => setLessonFilterStudent(e.target.value)}>
                            <option value="">Tüm öğrenciler</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.full_name} (Sınıf: {s.grade ?? "-"})
                                </option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={lessonFilterFrom}
                            onChange={(e) => setLessonFilterFrom(e.target.value)}
                            placeholder="Başlangıç"
                        />
                        <input
                            type="date"
                            value={lessonFilterTo}
                            onChange={(e) => setLessonFilterTo(e.target.value)}
                            placeholder="Bitiş"
                        />
                        <select value={lessonFilterStatus} onChange={(e) => setLessonFilterStatus(e.target.value)}>
                            <option value="">Tüm durumlar</option>
                            <option value="PLANNED">PLANNED</option>
                            <option value="PENDING_CONFIRMATION">PENDING_CONFIRMATION</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                            <option value="MISSED">MISSED</option>
                        </select>
                    </div>
                    {lessons.length === 0 ? (
                        <div>Henüz ders planı yok.</div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left" }}>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Tarih</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğretmen</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrenci</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Süre</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Mod</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrt. Notu</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrt. Onay</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğr. Onay</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>İptal Eden</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {lessons
                                    .filter((l) => {
                                        if (lessonFilterTeacher && String(l.teacher_user_id) !== String(lessonFilterTeacher)) return false;
                                        if (lessonFilterStudent && String(l.student_id) !== String(lessonFilterStudent)) return false;
                                        if (lessonFilterStatus && l.status !== lessonFilterStatus) return false;
                                        const d = l.scheduled_start ? new Date(l.scheduled_start) : null;
                                        if (lessonFilterFrom && d && d < new Date(lessonFilterFrom)) return false;
                                        if (lessonFilterTo && d) {
                                            const to = new Date(lessonFilterTo);
                                            to.setHours(23, 59, 59, 999);
                                            if (d > to) return false;
                                        }
                                        return true;
                                    })
                                    .map((l) => {
                                    const teacher = teachers.find((t) => (t.id ?? t.user_id) === l.teacher_user_id);
                                    const student = students.find((s) => s.id === l.student_id);
                                    const statusColor = {
                                        PLANNED: "#2563eb",
                                        PENDING_CONFIRMATION: "#b45309",
                                        COMPLETED: "#15803d",
                                        CANCELLED: "#b91c1c",
                                        MISSED: "#6b7280",
                                    }[l.status] || "#111827";
                                    return (
                                        <tr key={l.id}>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {l.scheduled_start?.replace("T", " ").slice(0, 16) || "-"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {teacher?.full_name || `#${l.teacher_user_id}`}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {student?.full_name || `#${l.student_id}`}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {l.duration_min} dk
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {l.mode}
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
                                                    {l.status}
                                                </span>
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {l.teacher_mark_note || "-"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {l.teacher_marked_at ? "Evet" : "-"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {l.student_marked_at ? "Evet" : "-"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                {l.cancelled_by_role ? `${l.cancelled_by_role}` : "-"}
                                            </td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8, display: "flex", gap: 6 }}>
                                                <button onClick={() => onCancelLesson(l.id)} disabled={l.status === "CANCELLED"}>
                                                    İptal
                                                </button>
                                                <button onClick={() => onDeleteLesson(l.id)}>
                                                    Sil
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Teacher Earnings */}
                    <div style={{ marginTop: 16 }}>
                        <h4 style={{ marginTop: 0 }}>Öğretmen Kazanç (Bu Ay)</h4>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ textAlign: "left" }}>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğretmen</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Ders</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Ücret/Ders</th>
                                    <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Toplam</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const now = new Date();
                                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                                    const counts = new Map();
                                    lessons.forEach((l) => {
                                        const d = l.scheduled_start ? new Date(l.scheduled_start) : null;
                                        if (!d || d < start) return;
                                        if (l.status !== "COMPLETED") return;
                                        counts.set(l.teacher_user_id, (counts.get(l.teacher_user_id) || 0) + 1);
                                    });
                                    return teachers.map((t) => {
                                        const tid = t.id ?? t.user_id;
                                        const count = counts.get(tid) || 0;
                                        const rate = Number(t.teacher_rate || 0);
                                        const total = rate * count;
                                        return (
                                            <tr key={tid}>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{t.full_name}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{count}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{rate || "-"}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{total || "-"}</td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PACKAGES TAB */}
            {tab === "packages" && !loading && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Paketler ({packages.length})</h3>
                        {packages.length === 0 ? (
                            <div>Paket yok.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Ad</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Ders</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Fiyat</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Süre (gün)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {packages.map((p) => (
                                        <tr key={p.id}>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{p.name}</td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{p.lesson_count}</td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{p.price ?? "-"}</td>
                                            <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{p.expires_in_days ?? "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        <h4 style={{ marginTop: 16 }}>Öğrenci Paketleri</h4>
                        {studentPackages.length === 0 ? (
                            <div>Öğrenci paketi yok.</div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left" }}>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Öğrenci</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Paket</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Kalan</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}>Durum</th>
                                        <th style={{ borderBottom: "1px solid #eee", padding: 8 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentPackages.map((sp) => {
                                        const st = students.find((s) => s.id === sp.student_id);
                                        const pk = packages.find((p) => p.id === sp.package_id);
                                        const canRenew = sp.status === "ACTIVE" && sp.remaining_lessons <= 1;
                                        return (
                                            <tr key={sp.id}>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{st?.full_name || sp.student_id}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{pk?.name || sp.package_id}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{sp.remaining_lessons}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>{sp.status}</td>
                                                <td style={{ borderBottom: "1px solid #f5f5f5", padding: 8 }}>
                                                    {canRenew ? (
                                                        <button
                                                            onClick={() => {
                                                                setAssignStudentId(String(sp.student_id));
                                                                setTab("packages");
                                                            }}
                                                        >
                                                            Yenile
                                                        </button>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Paket Oluştur</h3>
                        <form onSubmit={onCreatePackage} style={{ display: "grid", gap: 10 }}>
                            <input placeholder="Paket adı" value={newPackageName} onChange={(e) => setNewPackageName(e.target.value)} />
                            <input placeholder="Ders sayısı" value={newPackageCount} onChange={(e) => setNewPackageCount(e.target.value)} />
                            <input placeholder="Fiyat (opsiyonel)" value={newPackagePrice} onChange={(e) => setNewPackagePrice(e.target.value)} />
                            <input placeholder="Geçerlilik (gün)" value={newPackageExpire} onChange={(e) => setNewPackageExpire(e.target.value)} />
                            <button>Paket Oluştur</button>
                        </form>

                        <h3 style={{ marginTop: 16 }}>Paket Ata</h3>
                        <form onSubmit={onAssignPackage} style={{ display: "grid", gap: 10 }}>
                            <select value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)}>
                                <option value="">Öğrenci seç</option>
                                {students.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.full_name}
                                    </option>
                                ))}
                            </select>
                            <select value={assignPackageId} onChange={(e) => setAssignPackageId(e.target.value)}>
                                <option value="">Paket seç</option>
                                {packages.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} ({p.lesson_count})
                                    </option>
                                ))}
                            </select>
                            {assignStudentId && (() => {
                                const activeSp = studentPackages.find(
                                    (sp) => sp.student_id === Number(assignStudentId) && sp.status === "ACTIVE"
                                );
                                return activeSp && activeSp.remaining_lessons > 1;
                            })() ? (
                                <div style={{ fontSize: 12, color: "#b45309" }}>
                                    Kalan ders 1’den büyük. Yenileme yapılamaz.
                                </div>
                            ) : null}
                            <button
                                disabled={
                                    !assignStudentId ||
                                    !assignPackageId ||
                                    (() => {
                                        const activeSp = studentPackages.find(
                                            (sp) => sp.student_id === Number(assignStudentId) && sp.status === "ACTIVE"
                                        );
                                        return activeSp && activeSp.remaining_lessons > 1;
                                    })()
                                }
                            >
                                Ata
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
