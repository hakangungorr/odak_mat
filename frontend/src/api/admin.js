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
    apiFetch("/api/students", {
        method: "POST",
        token: token(),
        body: payload,
    });

// ---- TEACHERS ----
export const getTeachers = () =>
    apiFetch("/api/teachers", {
        method: "GET",
        token: token(),
    });

export const createTeacher = (payload) =>
    apiFetch("/api/teachers", {
        method: "POST",
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
