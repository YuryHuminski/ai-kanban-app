"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";

export const AuthGate = () => {
  // null while the session is being checked
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/me").then((response) => setSignedIn(response.ok));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setSignedIn(false);
  };

  if (signedIn === null) {
    return null;
  }
  if (!signedIn) {
    return <LoginForm onLogin={() => setSignedIn(true)} />;
  }
  return <KanbanBoard onLogout={handleLogout} />;
};
