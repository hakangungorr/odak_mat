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
import { apiFetch } from "../api/client";
import { loadAuth, logout } from "../auth/authStore";
import { useNavigate } from "react-router-dom";

export default function AdminPage() {
    const nav = useNavigate();
    const { user } = loadAuth();

    const [tab, setTab] = useState("teachers");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [deletedTeachers, setDeletedTeachers] = useState([]);
    const [deletedStudents, setDeletedStudents] = useState([]);
    const [enrollments, setEnrollments] = useState([]);
    const [lessons, setLessons] = useState([]);
    const [packages, setPackages] = useState([]);
    const [studentPackages, setStudentPackages] = useState([]);

    function normalizeId(x) {
        return x?.id ?? x?.user_id ?? x?.teacher_user_id ?? x?.student_id ?? null;
    }


    const teacherById = new Map(
        teachers.map((t) => [String(t.user_id ?? t.id), t.full_name || t.name || t.email || null])
    );

    const studentById = new Map(
        students.map((s) => [String(s.id), s.full_name || s.name || s.email || null])
    );
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
    const [newStudentPhones, setNewStudentPhones] = useState("");

    const [newTeacherName, setNewTeacherName] = useState("");
    const [newTeacherEmail, setNewTeacherEmail] = useState("");
    const [newTeacherPassword, setNewTeacherPassword] = useState("");
    const [newTeacherPhones, setNewTeacherPhones] = useState("");

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
            const [t, s, e, l, p, sp, dt, ds] = await Promise.all([
                getTeachers(),
                getStudents(),
                getEnrollments(),
                getLessonSessions(),
                getPackages(),
                getStudentPackages(),
                apiFetch("/api/users?include_deleted=1", {
                    method: "GET",
                    token: loadAuth().token,
                }),
                apiFetch("/api/students?include_deleted=1", {
                    method: "GET",
                    token: loadAuth().token,
                }),
            ]);

            setTeachers(Array.isArray(t) ? t : t?.items ?? []);
            setStudents(Array.isArray(s) ? s : s?.items ?? []);
            setEnrollments(Array.isArray(e) ? e : e?.items ?? []);
            setLessons(Array.isArray(l) ? l : l?.items ?? []);
            setPackages(Array.isArray(p) ? p : p?.items ?? []);
            setStudentPackages(Array.isArray(sp) ? sp : sp?.items ?? []);

            setDeletedTeachers(
                (Array.isArray(dt) ? dt : dt?.items ?? []).filter(
                    (u) => u.role_key === "TEACHER" && !u.is_active
                )
            );
            setDeletedStudents(
                Array.isArray(ds) ? ds.filter((st) => st.deleted_at) : []
            );
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
            const tId =
                en.teacher_user_id ?? en.teacher_id ?? en.teacherId ?? en.teacher?.id;
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
                phones: newStudentPhones,
            };
            await createStudent(payload);
            setNewStudentName("");
            setNewStudentGrade("");
            setNewStudentEmail("");
            setNewStudentPassword("");
            setNewStudentPhones("");
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
                phones: newTeacherPhones,
            };
            await createTeacher(payload);
            setNewTeacherName("");
            setNewTeacherEmail("");
            setNewTeacherPassword("");
            setNewTeacherPhones("");
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
        <div style={{ padding: 20, fontFamily: "sans-serif" }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                }}
            >
                <h1>Admin Panel</h1>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span>
                        {user?.email || "admin"} · {user?.role || "ADMIN"}
                    </span>
                    <button onClick={loadAll}>Yenile</button>
                    <button onClick={onLogout}>Çıkış</button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                <button
                    onClick={() => setTab("teachers")}
                    style={{ fontWeight: tab === "teachers" ? "700" : "400" }}
                >
                    Öğretmenler
                </button>
                <button
                    onClick={() => setTab("students")}
                    style={{ fontWeight: tab === "students" ? "700" : "400" }}
                >
                    Öğrenciler
                </button>
                <button
                    onClick={() => setTab("link")}
                    style={{ fontWeight: tab === "link" ? "700" : "400" }}
                >
                    Öğretmen-Öğrenci Eşleştir
                </button>
                <button
                    onClick={() => setTab("lessons")}
                    style={{ fontWeight: tab === "lessons" ? "700" : "400" }}
                >
                    Ders Planları
                </button>
                <button
                    onClick={() => setTab("packages")}
                    style={{ fontWeight: tab === "packages" ? "700" : "400" }}
                >
                    Paketler
                </button>
                <button
                    onClick={() => setTab("deleted")}
                    style={{ fontWeight: tab === "deleted" ? "700" : "400" }}
                >
                    Silinenler
                </button>
            </div>

            {err ? (
                <div style={{ background: "#fee", padding: 10, marginBottom: 10, borderRadius: 4 }}>
                    {err}
                </div>
            ) : null}

            {loading ? (
                <div style={{ padding: 20, textAlign: "center" }}>Yükleniyor…</div>
            ) : null}

            {/* TEACHERS TAB */}
            {tab === "teachers" && !loading && (
                <div>
                    {/* Teacher List */}
                    <h2>Öğretmenler ({teachers.length})</h2>
                    {teachers.length === 0 ? (
                        <div style={{ padding: 20, background: "#f9f9f9" }}>Öğretmen yok.</div>
                    ) : null}

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {teachers.map((t) => {
                            const tid = t.id ?? t.user_id;
                            const isOpen = expandedTeacherId === tid;
                            const linked = studentsOfTeacher(t);
                            return (
                                <div
                                    key={tid}
                                    style={{
                                        border: "1px solid #ccc",
                                        borderRadius: 4,
                                        padding: 10,
                                        background: "#fff",
                                    }}
                                >
                                    <div
                                        onClick={() => setExpandedTeacherId(isOpen ? null : tid)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <div style={{ fontWeight: 700 }}>
                                            {t.full_name || t.name || "İsimsiz öğretmen"}
                                        </div>
                                        <div>{t.email || ""}</div>
                                        <div>{t.phones || "-"}</div>
                                        <div>
                                            💰 Ücret/Ders: {t.teacher_rate ?? "-"}₺
                                        </div>
                                        <div>👥 {linked.length} öğrenci</div>
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

                                    {isOpen && (
                                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee" }}>
                                            <h4>Bağlı Öğrenciler</h4>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                                                <input
                                                    type="number"
                                                    placeholder="Ücret/Ders"
                                                    value={teacherRateEdits[tid] ?? ""}
                                                    onChange={(e) =>
                                                        setTeacherRateEdits((prev) => ({
                                                            ...prev,
                                                            [tid]: e.target.value,
                                                        }))
                                                    }
                                                    style={{ width: 140 }}
                                                />
                                                <button onClick={() => onUpdateTeacherRate(tid)}>
                                                    Ücreti Güncelle
                                                </button>
                                            </div>

                                            {linked.length === 0 ? (
                                                <div style={{ padding: 10, background: "#f9f9f9" }}>
                                                    Henüz bağlı öğrenci yok.
                                                </div>
                                            ) : (
                                                <ul>
                                                    {linked.map((s) => (
                                                        <li key={s.id}>
                                                            {s.full_name}{" "}
                                                            (Sınıf: {s.grade ?? "-"})
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

                    {/* Create Teacher */}
                    <h3 style={{ marginTop: 30 }}>Öğretmen Oluştur</h3>
                    <form onSubmit={onCreateTeacher} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
                        <input
                            type="text"
                            placeholder="Ad Soyad"
                            required
                            value={newTeacherName}
                            onChange={(e) => setNewTeacherName(e.target.value)}
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            required
                            value={newTeacherEmail}
                            onChange={(e) => setNewTeacherEmail(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Telefonlar (opsiyonel)"
                            value={newTeacherPhones}
                            onChange={(e) => setNewTeacherPhones(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Şifre"
                            required
                            value={newTeacherPassword}
                            onChange={(e) => setNewTeacherPassword(e.target.value)}
                        />
                        <button type="submit">Oluştur</button>
                    </form>
                    <p style={{ fontSize: 12, color: "#666" }}>
                        Not: Backend öğretmeni "User" olarak oluşturuyorsa bu endpoint onu yapmalı.
                    </p>
                </div>
            )}

            {/* STUDENTS TAB */}
            {tab === "students" && !loading && (
                <div>
                    <h2>Öğrenciler ({students.length})</h2>
                    {students.length === 0 ? (
                        <div style={{ padding: 20, background: "#f9f9f9" }}>Öğrenci yok.</div>
                    ) : (
                        <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse", border: "1px solid #ccc" }}>
                            <thead>
                                <tr style={{ background: "#f5f5f5" }}>
                                    <th style={{ border: "1px solid #ccc", padding: 8 }}>Ad Soyad</th>
                                    <th style={{ border: "1px solid #ccc", padding: 8 }}>Sınıf</th>
                                    <th style={{ border: "1px solid #ccc", padding: 8 }}>Telefonlar</th>
                                    <th style={{ border: "1px solid #ccc", padding: 8 }}>Paket</th>
                                    <th style={{ border: "1px solid #ccc", padding: 8 }}>Kalan</th>
                                    <th style={{ border: "1px solid #ccc", padding: 8 }}>ID</th>
                                    <th style={{ border: "1px solid #ccc", padding: 8 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => {
                                    const sp =
                                        studentPackages.find(
                                            (p) => p.student_id === s.id && p.status === "ACTIVE"
                                        ) || studentPackages.find((p) => p.student_id === s.id);
                                    const pk = packages.find((p) => p.id === sp?.package_id);
                                    return (
                                        <tr key={s.id}>
                                            <td style={{ border: "1px solid #ccc", padding: 8 }}>{s.full_name}</td>
                                            <td style={{ border: "1px solid #ccc", padding: 8 }}>{s.grade ?? "-"}</td>
                                            <td style={{ border: "1px solid #ccc", padding: 8 }}>{s.phones || "-"}</td>
                                            <td style={{ border: "1px solid #ccc", padding: 8 }}>{pk?.name || "-"}</td>
                                            <td style={{ border: "1px solid #ccc", padding: 8 }}>{sp ? sp.remaining_lessons : "-"}</td>
                                            <td style={{ border: "1px solid #ccc", padding: 8 }}>{s.id}</td>
                                            <td style={{ border: "1px solid #ccc", padding: 8 }}>
                                                <button
                                                    onClick={() => onDeleteStudent(s.id, s.full_name)}
                                                    style={{ fontSize: 12 }}
                                                >
                                                    Sil
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    <h3 style={{ marginTop: 30 }}>Öğrenci Oluştur</h3>
                    <form onSubmit={onCreateStudent} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
                        <input
                            type="text"
                            placeholder="Ad Soyad"
                            required
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                        />
                        <input
                            type="number"
                            placeholder="Sınıf (opsiyonel)"
                            value={newStudentGrade}
                            onChange={(e) => setNewStudentGrade(e.target.value)}
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            required
                            value={newStudentEmail}
                            onChange={(e) => setNewStudentEmail(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Telefonlar (opsiyonel)"
                            value={newStudentPhones}
                            onChange={(e) => setNewStudentPhones(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Şifre"
                            required
                            value={newStudentPassword}
                            onChange={(e) => setNewStudentPassword(e.target.value)}
                        />
                        <button type="submit">Oluştur</button>
                    </form>
                    <p style={{ fontSize: 12, color: "#666" }}>
                        Not: Bu işlem öğrenci için login hesabını da oluşturur.
                    </p>
                </div>
            )}

            {/* LINK TAB */}
            {tab === "link" && !loading && (
                <div>
                    <h2>Öğretmen-Öğrenci Eşleştir</h2>
                    <form onSubmit={onCreateLink} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
                        <select
                            required
                            value={linkTeacherId}
                            onChange={(e) => setLinkTeacherId(e.target.value)}
                        >
                            <option value="">Öğretmen seç</option>
                            {teachers.map((t) => {
                                const tid = t.user_id ?? t.id;
                                return (
                                    <option key={tid} value={tid}>
                                        {t.full_name || t.name} ({t.email || tid})
                                    </option>
                                );
                            })}
                        </select>
                        <select
                            required
                            value={linkStudentId}
                            onChange={(e) => setLinkStudentId(e.target.value)}
                        >
                            <option value="">Öğrenci seç</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.full_name} (Sınıf: {s.grade ?? "-"})
                                </option>
                            ))}
                        </select>
                        <button type="submit">Eşleştir</button>
                    </form>
                    <p style={{ fontSize: 12, color: "#666" }}>
                        Bu işlem backend'de `POST /api/enrollments` ile teacher_user_id + student_id gönderir.
                    </p>
                </div>
            )}




            {/* LESSONS TAB */}
            {tab === "lessons" && !loading && (
                <div>
                    <h2>Ders Planları ({lessons.length})</h2>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                        <select
                            value={lessonFilterTeacher}
                            onChange={(e) => setLessonFilterTeacher(e.target.value)}
                        >
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
                        <select
                            value={lessonFilterStudent}
                            onChange={(e) => setLessonFilterStudent(e.target.value)}
                        >
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
                        <select
                            value={lessonFilterStatus}
                            onChange={(e) => setLessonFilterStatus(e.target.value)}
                        >
                            <option value="">Tüm durumlar</option>
                            <option value="PLANNED">PLANNED</option>
                            <option value="PENDING_CONFIRMATION">PENDING_CONFIRMATION</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                            <option value="MISSED">MISSED</option>
                        </select>
                    </div>

                    {lessons.length === 0 ? (
                        <div style={{ padding: 20, background: "#f9f9f9" }}>
                            Henüz ders planı yok.
                        </div>
                    ) : (
                        <div className="admin-table-wrap">
                            <div className="admin-lessons-card">
                                {lessons.filter((l) => {
                                    if (lessonFilterTeacher && String(l.teacher_user_id) !== String(lessonFilterTeacher)) return false;
                                    if (lessonFilterStudent && String(l.student_id) !== String(lessonFilterStudent)) return false;
                                    if (lessonFilterStatus && l.status !== lessonFilterStatus) return false;

                                    const d = l.scheduled_start ? new Date(l.scheduled_start) : null
                                    if (lessonFilterFrom && d && d < new Date(lessonFilterFrom)) return false;
                                    if (lessonFilterTo && d) {
                                        const to = new Date(lessonFilterTo);
                                        to.setHours(23, 59, 59, 999);
                                        if (d > to) return false;
                                    }
                                    return true;
                                })

                                    .map((l) => {
                                        const student = students.find((s) => s.id === l.student_id);

                                        const statusColor = {
                                            PLANNED: "#2563eb",
                                            PENDING_CONFIRMATION: "#b45309",
                                            COMPLETED: "#15803d",
                                            CANCELLED: "#b91c1c",
                                            MISSED: "#6b7280",
                                        }[l.status] || "#111827";

                                        return (
                                            <div key={l.id} className="admin-lesson-card">
                                                <div className="admin-lesson-top">
                                                    <div className="admin-lesson-date">
                                                        {l.scheduled_start?.replace("T", " ").slice(0, 16) || "-"}

                                                    </div>
                                                    <span className="admin-lesson-status" style={{ background: statusColor + "22", color: statusColor }}>
                                                        {l.status}
                                                    </span>
                                                </div>

                                                <div className="admin-lesson-grid">
                                                    <div><span>Öğretmen</span><strong>{teacherById.get(String(l.teacher_user_id)) || "-"} (#{l.teacher_user_id})</strong></div>
                                                    <div><span>Öğrenci</span><strong>{studentById.get(String(l.student_id)) || "—"} (#{l.student_id})</strong></div>
                                                    <div><span>Süre</span><strong>{l.duration_min} dk</strong></div>
                                                    <div><span>Mod</span><strong>{l.mode || "-"}</strong></div>
                                                    <div><span>Öğrt. Notu</span><strong>{l.teacher_mark_note || "-"}</strong></div>
                                                    <div><span>Öğrt. Onay</span><strong>{l.teacher_marked_at ? "Evet" : "-"}</strong></div>
                                                    <div><span>Öğr. Onay</span><strong>{l.student_marked_at ? "Evet" : "-"}</strong></div>
                                                    <div><span>İptal Eden</span><strong>{l.cancelled_by_role || "-"}</strong></div>
                                                </div>

                                                <div className="admin-lesson-actions">
                                                    <button onClick={() => onCancelLesson(l.id)} disabled={l.status === "CANCELLED"} >
                                                        İptal
                                                    </button>
                                                    <button onClick={() => onDeleteLesson(l.id)}>Sil</button>
                                                </div>



                                            </div>

                                        );


                                    })}
                            </div>
                        </div>
                    )}

                    {/* Teacher Earnings */}
                    <h3 style={{ marginTop: 30 }}>Öğretmen Kazanç (Bu Ay)</h3>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                <th>Öğretmen</th>
                                <th>Ders</th>
                                <th>Ücret/Ders</th>
                                <th>Toplam</th>
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
                                    counts.set(
                                        l.teacher_user_id,
                                        (counts.get(l.teacher_user_id) || 0) + 1
                                    );
                                });
                                return teachers.map((t) => {
                                    const tid = t.id ?? t.user_id;
                                    const count = counts.get(tid) || 0;
                                    const rate = Number(t.teacher_rate || 0);
                                    const total = rate * count;
                                    return (
                                        <tr key={tid}>
                                            <td>{t.full_name}</td>
                                            <td>{count}</td>
                                            <td>{rate || "-"}₺</td>
                                            <td>{total || "-"}₺</td>
                                        </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>


            )}

            {/* PACKAGES TAB */}
            {tab === "packages" && !loading && (
                <div>
                    <h2>Paketler ({packages.length})</h2>
                    {packages.length === 0 ? (
                        <div style={{ padding: 20, background: "#f9f9f9" }}>Paket yok.</div>
                    ) : (
                        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th>Ad</th>
                                    <th>Ders</th>
                                    <th>Fiyat</th>
                                    <th>Süre (gün)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {packages.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.name}</td>
                                        <td>{p.lesson_count}</td>
                                        <td>{p.price ?? "-"}₺</td>
                                        <td>{p.expires_in_days ?? "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <h3 style={{ marginTop: 20 }}>Öğrenci Paketleri</h3>
                    {studentPackages.length === 0 ? (
                        <div style={{ padding: 20, background: "#f9f9f9" }}>
                            Öğrenci paketi yok.
                        </div>
                    ) : (
                        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th>Öğrenci</th>
                                    <th>Paket</th>
                                    <th>Kalan</th>
                                    <th>Durum</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentPackages.map((sp) => {
                                    const st = students.find((s) => s.id === sp.student_id);
                                    const pk = packages.find((p) => p.id === sp.package_id);
                                    const canRenew = sp.remaining_lessons <= 1;
                                    return (
                                        <tr key={sp.id}>
                                            <td>{st?.full_name || sp.student_id}</td>
                                            <td>{pk?.name || sp.package_id}</td>
                                            <td>{sp.remaining_lessons}</td>
                                            <td>{sp.status}</td>
                                            <td>
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

                    <h3 style={{ marginTop: 30 }}>Paket Oluştur</h3>
                    <form onSubmit={onCreatePackage} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
                        <input
                            type="text"
                            placeholder="Paket adı"
                            required
                            value={newPackageName}
                            onChange={(e) => setNewPackageName(e.target.value)}
                        />
                        <input
                            type="number"
                            placeholder="Ders sayısı"
                            required
                            value={newPackageCount}
                            onChange={(e) => setNewPackageCount(e.target.value)}
                        />
                        <input
                            type="number"
                            placeholder="Fiyat (opsiyonel)"
                            value={newPackagePrice}
                            onChange={(e) => setNewPackagePrice(e.target.value)}
                        />
                        <input
                            type="number"
                            placeholder="Geçerlilik süresi (gün, opsiyonel)"
                            value={newPackageExpire}
                            onChange={(e) => setNewPackageExpire(e.target.value)}
                        />
                        <button type="submit">Paket Oluştur</button>
                    </form>

                    <h3 style={{ marginTop: 30 }}>Paket Ata</h3>
                    <form onSubmit={onAssignPackage} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
                        <select
                            required
                            value={assignStudentId}
                            onChange={(e) => setAssignStudentId(e.target.value)}
                        >
                            <option value="">Öğrenci seç</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.full_name}
                                </option>
                            ))}
                        </select>
                        <select
                            required
                            value={assignPackageId}
                            onChange={(e) => setAssignPackageId(e.target.value)}
                        >
                            <option value="">Paket seç</option>
                            {packages.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.lesson_count})
                                </option>
                            ))}
                        </select>
                        {assignStudentId &&
                            (() => {
                                const activeSp = studentPackages.find(
                                    (sp) =>
                                        sp.student_id === Number(assignStudentId) &&
                                        sp.status === "ACTIVE"
                                );
                                return activeSp && activeSp.remaining_lessons > 1;
                            })() ? (
                            <div style={{ background: "#fef3c7", padding: 10, borderRadius: 4 }}>
                                ⚠️ Kalan ders 1'den büyük. Yenileme yapılamaz.
                            </div>
                        ) : null}
                        <button
                            type="submit"
                            disabled={
                                assignStudentId &&
                                (() => {
                                    const activeSp = studentPackages.find(
                                        (sp) =>
                                            sp.student_id === Number(assignStudentId) &&
                                            sp.status === "ACTIVE"
                                    );
                                    return activeSp && activeSp.remaining_lessons > 1;
                                })()
                            }
                        >
                            Ata
                        </button>
                    </form>
                </div>
            )}

            {/* DELETED TAB */}
            {tab === "deleted" && !loading && (
                <div>
                    <h2>Silinen Öğretmenler ({deletedTeachers.length})</h2>
                    {deletedTeachers.length === 0 ? (
                        <div style={{ padding: 20, background: "#f9f9f9" }}>Kayıt yok.</div>
                    ) : (
                        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th>Ad Soyad</th>
                                    <th>Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deletedTeachers.map((t) => (
                                    <tr key={t.id}>
                                        <td>{t.full_name}</td>
                                        <td>{t.email}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <h2 style={{ marginTop: 30 }}>Silinen Öğrenciler ({deletedStudents.length})</h2>
                    {deletedStudents.length === 0 ? (
                        <div style={{ padding: 20, background: "#f9f9f9" }}>Kayıt yok.</div>
                    ) : (
                        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th>Ad Soyad</th>
                                    <th>Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deletedStudents.map((s) => (
                                    <tr key={s.id}>
                                        <td>{s.full_name}</td>
                                        <td>{s.email || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
