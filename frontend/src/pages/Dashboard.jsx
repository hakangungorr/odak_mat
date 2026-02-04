import React, { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { loadAuth, logout } from "../auth/authStore";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const nav = useNavigate();
}