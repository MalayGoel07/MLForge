import { useState } from "react";
import api from "../api/api";
import { setToken } from "../api/auth";
import ThemeButton from "./ThemeButton";

// Mirrors the backend rules in security.py (UserSignup)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388bfd]/70";
const INPUT_CLASS =
    "w-full rounded-lg border border-[#30363d] bg-[#010409] px-3 py-2.5 text-sm text-[#e6edf3] outline-none transition placeholder:text-[#6e7681] focus:border-[#388bfd] focus:ring-2 focus:ring-[#388bfd]/20 disabled:opacity-50";
const INPUT_ERROR = "!border-[#f85149] focus:!border-[#f85149] focus:!ring-[#f85149]/20";

const ICONS = {
    eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    eyeOff: "M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
    alert: "M12 8v5M12 16.5v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    check: "M20 6 9 17l-5-5",
    compare: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    clean: "M3 4h18l-7 8v6l-4 2v-8z",
    code: "m8 7-5 5 5 5M16 7l5 5-5 5",
    chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z",
};

function Icon({ name, size = 16, className = "" }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <path d={ICONS[name]} />
        </svg>
    );
}

const FEATURES = [
    { icon: "compare", title: "Compare models", desc: "Train several models on the same dataset and see them side by side." },
    { icon: "clean", title: "Analyse and clean data", desc: "Profile columns, fix missing values and remove duplicates." },
    { icon: "code", title: "Run code", desc: "Write and run experiments in a notebook without leaving the workspace." },
    { icon: "chat", title: "Pick up where you left off", desc: "Your chats are saved to your account." },
];

const gridBg = {
    backgroundImage:
        "linear-gradient(to right, rgba(139,148,158,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(139,148,158,0.10) 1px, transparent 1px)",
    backgroundSize: "36px 36px",
    WebkitMaskImage: "linear-gradient(to bottom, black 10%, transparent 95%)",
    maskImage: "linear-gradient(to bottom, black 10%, transparent 95%)",
};

const errorMessage = (err) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) return detail.map((d) => d.msg).join(". ");
    if (err instanceof TypeError && /fetch|network|failed/i.test(err.message)) {
        return "Can't reach the server. Is the backend running?";
    }
    return err.message || "Something went wrong. Try again.";
};

function TextField({ id, label, error, trailing, hint, ...props }) {
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[#e6edf3]">{label}</label>
            <div className="relative">
                <input
                    id={id}
                    aria-invalid={error ? "true" : undefined}
                    aria-describedby={describedBy}
                    className={`${INPUT_CLASS} ${error ? INPUT_ERROR : ""} ${trailing ? "pr-12" : ""}`}
                    {...props}
                />
                {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
            </div>
            {error && (
                <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-[#ff7b72]">
                    <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
                    {error}
                </p>
            )}
            {!error && hint}
        </div>
    );
}

export default function LoginSignPage({ onNavigate, theme = "black", onSelectTheme }) {
    const [mode, setMode] = useState("login");
    const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [capsOn, setCapsOn] = useState(false);
    const [fieldError, setFieldError] = useState(null); // { field, message }
    const [error, setError] = useState("");              // server / network error
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isSignup = mode === "signup";
    const fe = (field) => (fieldError?.field === field ? fieldError.message : "");

    const setField = (key) => (event) => {
        setForm((f) => ({ ...f, [key]: event.target.value }));
        if (fieldError?.field === key) setFieldError(null);
    };

    const switchMode = (next) => {
        if (next === mode) return;
        setMode(next);
        setError("");
        setFieldError(null);
        setShowPassword(false);
        setForm((f) => ({ ...f, password: "", confirm: "" }));
    };

    const validate = () => {
        if (!isSignup) {
            if (!EMAIL_RE.test(form.email.trim())) return { field: "email", message: "Enter a valid email address." };
            if (!form.password) return { field: "password", message: "Enter your password." };
            return null;
        }
        if (!form.name.trim()) return { field: "name", message: "Enter your name." };
        if (!EMAIL_RE.test(form.email.trim())) return { field: "email", message: "Enter a valid email address." };
        if (form.password.length < MIN_PASSWORD) return { field: "password", message: `Password must be at least ${MIN_PASSWORD} characters.` };
        if (form.password !== form.confirm) return { field: "confirm", message: "Passwords don't match." };
        return null;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isSubmitting) return;

        const problem = validate();
        if (problem) {
            setError("");
            setFieldError(problem);
            document.getElementById(problem.field)?.focus();
            return;
        }

        setIsSubmitting(true);
        setError("");
        setFieldError(null);
        try {
            let data;
            if (isSignup) {
                ({ data } = await api.post("/auth/signup", {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    password: form.password,
                }));
            } else {
                // FastAPI's OAuth2PasswordRequestForm expects form-encoded fields, not JSON
                ({ data } = await api.post(
                    "/auth/login",
                    new URLSearchParams({ username: form.email.trim(), password: form.password }),
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

    const lengthOk = form.password.length >= MIN_PASSWORD;
    const capsHandler = (e) => setCapsOn(!!e.getModifierState?.("CapsLock"));

    return (
        <div className="t-page page-no-overscroll flex min-h-screen flex-col overflow-x-clip overscroll-none font-sans text-[#c9d1d9] scrollbar-thin scrollbar-thumb-[#58a6ff] scroll-smooth">
            <header className="flex items-center justify-between px-4 py-3 md:px-8">
                <span className="t-accent text-lg font-semibold tracking-tight">MLForge</span>
                <ThemeButton onNavigate={onNavigate} showSettings={false} />
            </header>

            <div className="grid flex-1 lg:grid-cols-2">
                {/* Value panel (desktop) */}
                <aside className="relative hidden border-r border-[#30363d] lg:block" aria-label="About MLForge">
                    <div className="pointer-events-none absolute inset-0" style={gridBg} aria-hidden="true" />
                    <div className="relative mx-auto flex h-full max-w-md flex-col justify-center px-8 py-12">
                        <h2 className="text-3xl font-semibold leading-tight tracking-tight text-[#e6edf3]">
                            Everything for your ML experiments, in one workspace.
                        </h2>
                        <ul className="mt-8 space-y-5">
                            {FEATURES.map((f) => (
                                <li key={f.title} className="flex gap-3.5">
                                    <span className="t-accent mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#30363d] bg-[#0d1117]">
                                        <Icon name={f.icon} size={17} />
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-[#e6edf3]">{f.title}</p>
                                        <p className="mt-0.5 text-sm leading-6 text-[#8b949e]">{f.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* Form */}
                <main className="flex items-center justify-center px-4 py-8 md:px-8">
                    <section className="w-full max-w-sm">
                        <header className="mb-6">
                            <h1 className="text-2xl font-semibold tracking-tight text-[#e6edf3] md:text-3xl">
                                {isSignup ? "Create your account" : "Welcome back"}
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-[#8b949e]">
                                {isSignup ? "Sign up to save your chats and pick up where you left off." : "Log in to open your chats and tools."}
                            </p>
                        </header>

                        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-[#30363d] bg-[#010409] p-1" role="group" aria-label="Choose log in or sign up">
                            {[["login", "Log in"], ["signup", "Sign up"]].map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-pressed={mode === key}
                                    onClick={() => switchMode(key)}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${focusRing} ${mode === key ? "bg-[#21262d] text-white shadow-sm" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting} className="space-y-4">
                            {error && (
                                <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#f85149]/30 bg-[#f85149]/10 px-3 py-2.5 text-sm text-[#ffa198]">
                                    <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {isSignup && (
                                <TextField id="name" label="Name" type="text" autoComplete="name" value={form.name} onChange={setField("name")}
                                    disabled={isSubmitting} placeholder="Ada Lovelace" autoFocus error={fe("name")} />
                            )}

                            <TextField id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={setField("email")}
                                disabled={isSubmitting} placeholder="you@example.com" autoFocus={!isSignup} error={fe("email")} />

                            <TextField
                                id="password"
                                label="Password"
                                type={showPassword ? "text" : "password"}
                                autoComplete={isSignup ? "new-password" : "current-password"}
                                value={form.password}
                                onChange={setField("password")}
                                onKeyUp={capsHandler}
                                onKeyDown={capsHandler}
                                onBlur={() => setCapsOn(false)}
                                disabled={isSubmitting}
                                placeholder={isSignup ? `At least ${MIN_PASSWORD} characters` : "Your password"}
                                error={fe("password")}
                                trailing={
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((s) => !s)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        aria-pressed={showPassword}
                                        className={`rounded-md p-2 text-[#8b949e] transition hover:text-white ${focusRing}`}
                                    >
                                        <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                                    </button>
                                }
                                hint={
                                    <>
                                        {capsOn && <p className="mt-1.5 text-xs text-[#e3b341]">Caps Lock is on.</p>}
                                        {isSignup && (
                                            <p id="password-hint" className={`mt-1.5 flex items-center gap-1.5 text-xs transition-colors ${lengthOk ? "text-[#3fb950]" : "text-[#8b949e]"}`}>
                                                <Icon name="check" size={13} className={lengthOk ? "" : "opacity-40"} />
                                                At least {MIN_PASSWORD} characters
                                            </p>
                                        )}
                                    </>
                                }
                            />

                            {isSignup && (
                                <TextField id="confirm" label="Confirm password" type={showPassword ? "text" : "password"} autoComplete="new-password"
                                    value={form.confirm} onChange={setField("confirm")} disabled={isSubmitting} placeholder="Repeat password" error={fe("confirm")} />
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#238636] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                            >
                                {isSubmitting && (
                                    <svg viewBox="0 0 24 24" width="16" height="16" className="animate-spin motion-reduce:animate-none" fill="none" aria-hidden="true">
                                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                                        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                )}
                                {isSubmitting ? (isSignup ? "Creating account..." : "Logging in...") : isSignup ? "Create account" : "Log in"}
                            </button>
                        </form>

                        <p className="mt-5 text-center text-sm text-[#8b949e]">
                            {isSignup ? "Already have an account? " : "New here? "}
                            <button type="button" onClick={() => switchMode(isSignup ? "login" : "signup")} className={`rounded text-[#58a6ff] underline-offset-2 transition hover:underline ${focusRing}`}>
                                {isSignup ? "Log in" : "Create one"}
                            </button>
                        </p>
                    </section>
                </main>
            </div>
        </div>
    );
}