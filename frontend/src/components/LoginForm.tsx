import { useState, type FormEvent } from "react";

type LoginFormProps = {
  onLogin: () => void;
};

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      onLogin();
    } else {
      setError("Invalid username or password");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)]"
      >
        <div className="h-2 w-10 rounded-full bg-[var(--accent-yellow)]" />
        <h1 className="font-display text-3xl font-semibold text-[var(--navy-dark)]">
          Sign in
        </h1>
        <label className="block space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Username
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className={inputClass}
            required
          />
        </label>
        <label className="block space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className={inputClass}
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
        >
          Sign in
        </button>
      </form>
    </main>
  );
};
