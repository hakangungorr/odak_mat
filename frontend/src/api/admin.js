import { apiFetch } from "./client";
import { loadAuth } from "../auth/authStore";

const token = () => loadAuth().token;

// ---- STUDENTS ----
export const getStudents = () =>
    apiFetch("/api/students", {
        method: "GET",
        token: token(),
    });

export const createStudent = (payload) =>
    apiFetch("/api/admin/students/student-accounts", {
        method: "POST",
        token: token(),
        body: payload,
    });

export const deleteStudent = (studentId) =>
    apiFetch(`/api/admin/students/student-accounts/${studentId}`, {
        method: "DELETE",
        token: token(),
    });

// ---- TEACHERS ----
export const getTeachers = () =>
    apiFetch("/api/users?role=TEACHER", {
        method: "GET",
        token: token(),
    });

export const createTeacher = (payload) =>
    apiFetch("/api/users", {
        method: "POST",
        token: token(),
        body: payload,
    });

export const deleteTeacher = (teacherUserId) =>
    apiFetch(`/api/users/${teacherUserId}`, {
        method: "DELETE",
        token: token(),
    });

export const updateTeacher = (teacherUserId, payload) =>
    apiFetch(`/api/users/${teacherUserId}`, {
        method: "PATCH",
        token: token(),
        body: payload,
    });

// ---- ENROLLMENTS ----
export const getEnrollments = () =>
    apiFetch("/api/enrollments", {
        method: "GET",
        token: token(),
    });

export const createEnrollment = (payload) =>
    apiFetch("/api/enrollments", {
        method: "POST",
        token: token(),
        body: payload,
    });

// ---- LESSON SESSIONS ----
export const getLessonSessions = () =>
    apiFetch("/api/lesson-sessions", {
        method: "GET",
        token: token(),
    });

export const updateLessonSession = (sessionId, payload) =>
    apiFetch(`/api/lesson-sessions/${sessionId}`, {
        method: "PATCH",
        token: token(),
        body: payload,
    });

export const cancelLessonSession = (sessionId) =>
    apiFetch(`/api/lesson-sessions/${sessionId}/cancel`, {
        method: "PATCH",
        token: token(),
    });

export const deleteLessonSession = (sessionId) =>
    apiFetch(`/api/lesson-sessions/${sessionId}`, {
        method: "DELETE",
        token: token(),
    });

// ---- PACKAGES ----
export const getPackages = () =>
    apiFetch("/api/packages", {
        method: "GET",
        token: token(),
    });

export const createPackage = (payload) =>
    apiFetch("/api/packages", {
        method: "POST",
        token: token(),
        body: payload,
    });

export const getStudentPackages = (studentId) =>
    apiFetch(`/api/packages/student-packages${studentId ? `?student_id=${studentId}` : ""}`, {
        method: "GET",
        token: token(),
    });

export const assignPackage = (payload) =>
    apiFetch("/api/packages/student-packages", {
        method: "POST",
        token: token(),
        body: payload,
    });
