import { useState } from "react";
import api from "../api/api";
import { setToken } from "../api/auth";
import ThemeButton from "./ThemeButton";

// Mirrors the backend rules in security.py (UserSignup)
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const INPUT_CLASS =
    "w-full rounded-lg border border-[#243724] bg-[#070a07] px-3 py-2 text-sm text-[#d4e6d5] outline-none transition placeholder:text-gray-600 focus:border-[#7aa88a] disabled:opacity-50";
const LABEL_CLASS = "mb-1.5 block text-xs uppercase tracking-[0.2em] text-[#adc9ae]";

const errorMessage = (err) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) return detail.map((d) => d.msg).join(". ");
    if (!err.response) return "Can't reach the server. Is the backend running?";
    return err.message || "Something went wrong. Try again.";
};

export default function LoginSignPage({ onNavigate, theme = "forest", onSelectTheme }) {
    const [mode, setMode] = useState("login");
    const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "", confirm: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isSignup = mode === "signup";
    const setField = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

    const switchMode = (next) => {
        if (next === mode) return;
        setMode(next);
        setError("");
        setShowPassword(false);
        setForm((f) => ({ ...f, password: "", confirm: "" }));
    };

    const validate = () => {
        const username = form.username.trim();
        if (!isSignup) {
            if (!username || !form.password) return "Enter your username and password.";
            return "";
        }
        if (!USERNAME_RE.test(username)) return "Username must be 3 to 32 characters: letters, numbers, _ . or -";
        if (!EMAIL_RE.test(form.email.trim())) return "Enter a valid email address.";
        if (form.password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
        if (form.password !== form.confirm) return "Passwords don't match.";
        return "";
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isSubmitting) return;

        const problem = validate();
        if (problem) { setError(problem); return; }

        setIsSubmitting(true);
        setError("");
        try {
            let data;
            if (isSignup) {
                ({ data } = await api.post("/auth/signup", {
                    username: form.username.trim(),
                    email: form.email.trim(),
                    full_name: form.fullName.trim() || null,
                    password: form.password,
                }));
            } else {
                // FastAPI's OAuth2PasswordRequestForm expects form-encoded fields, not JSON
                ({ data } = await api.post(
                    "/auth/login",
                    new URLSearchParams({ username: form.username.trim(), password: form.password }),
                    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
                ));
            }
            const token = data?.access_token;
            if (!token) {
                throw new Error("No access token received from the server.");
            }
            
            setToken(token);
            
            // Navigate using your existing custom router.
            onNavigate("/home");
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="t-page page-no-overscroll flex min-h-screen flex-col overflow-x-clip overscroll-none px-4 py-4 font-mono md:px-8 scrollbar-thin scrollbar-thumb-[#7aa88a] scroll-smooth">
            <div className="flex justify-end">
                <ThemeButton theme={theme} onSelect={onSelectTheme} />
            </div>

            <main className="flex flex-1 items-center justify-center py-8">
                <section className="w-full max-w-md">
                    <header className="mb-6 text-center">
                        <p className="t-accent mb-2 text-xs uppercase tracking-[0.3em]">MlForge</p>
                        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{isSignup ? "Create account" : "Welcome back"}</h1>
                        <p className="mt-2 text-sm leading-6 text-gray-400">
                            {isSignup ? "Sign up to save your chats and pick up where you left off." : "Log in to open your chats and tools."}
                        </p>
                    </header>

                    <div className="rounded-xl border border-[#243724] bg-[#0e140e]/80 p-6 shadow-2xl shadow-[#172617]/20">
                        <div className="mb-5 flex gap-2" role="group" aria-label="Choose login or sign up">
                            {[["login", "Log in"], ["signup", "Sign up"]].map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={mode === key}
                                    onClick={() => switchMode(key)}
                                    className={`flex-1 rounded-lg border px-3 py-2 text-xs transition ${mode === key ? "border-[#618c61] bg-[#172617] text-white" : "border-[#243724] bg-[#101a10] text-gray-400 hover:border-[#618c61]"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} noValidate className="space-y-4">
                            {isSignup && (
                                <div>
                                    <label htmlFor="fullName" className={LABEL_CLASS}>Full name <span className="normal-case tracking-normal text-gray-600">(optional)</span></label>
                                    <input id="fullName" type="text" autoComplete="name" value={form.fullName} onChange={setField("fullName")} disabled={isSubmitting} className={INPUT_CLASS} placeholder="Ada Lovelace" />
                                </div>
                            )}

                            <div>
                                <label htmlFor="username" className={LABEL_CLASS}>Username</label>
                                <input id="username" type="text" autoComplete="username" value={form.username} onChange={setField("username")} disabled={isSubmitting} className={INPUT_CLASS} placeholder="your_username" autoFocus />
                            </div>

                            {isSignup && (
                                <div>
                                    <label htmlFor="email" className={LABEL_CLASS}>Email</label>
                                    <input id="email" type="email" autoComplete="email" value={form.email} onChange={setField("email")} disabled={isSubmitting} className={INPUT_CLASS} placeholder="you@example.com" />
                                </div>
                            )}

                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label htmlFor="password" className="text-xs uppercase tracking-[0.2em] text-[#adc9ae]">Password</label>
                                    <button type="button" onClick={() => setShowPassword((s) => !s)} className="text-[10px] text-gray-500 transition hover:text-[#adc9ae]">
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete={isSignup ? "new-password" : "current-password"}
                                    value={form.password}
                                    onChange={setField("password")}
                                    disabled={isSubmitting}
                                    className={INPUT_CLASS}
                                    placeholder={isSignup ? `At least ${MIN_PASSWORD} characters` : "Your password"}
                                />
                            </div>

                            {isSignup && (
                                <div>
                                    <label htmlFor="confirm" className={LABEL_CLASS}>Confirm password</label>
                                    <input id="confirm" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.confirm} onChange={setField("confirm")} disabled={isSubmitting} className={INPUT_CLASS} placeholder="Repeat password" />
                                </div>
                            )}

                            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full rounded-lg border border-red-500 bg-red-400/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSubmitting ? (isSignup ? "Creating account..." : "Logging in...") : isSignup ? "Create account" : "Log in"}
                            </button>
                        </form>
                    </div>

                    <p className="mt-4 text-center text-xs text-gray-500">
                        {isSignup ? "Already have an account? " : "New here? "}
                        <button type="button" onClick={() => switchMode(isSignup ? "login" : "signup")} className="text-[#adc9ae] underline-offset-2 transition hover:underline">
                            {isSignup ? "Log in" : "Create one"}
                        </button>
                    </p>
                </section>
            </main>
        </div>
    );
}