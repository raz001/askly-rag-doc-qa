import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";
import PasswordInput from "../components/PasswordInput.jsx";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import { clearAuthError, loginUser } from "../features/auth/authSlice.js";
import styles from "../styles/App.module.css";

function BrandMark() {
  return (
    <Link to="/" className={styles.authBrandMark} aria-label="Back to home">
      <Sparkles size={24} strokeWidth={1.8} />
    </Link>
  );
}

function Login() {
  const dispatch = useDispatch();
  const { token, loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    const result = await dispatch(loginUser(form));
    if (loginUser.fulfilled.match(result)) {
      toast.success(`Welcome back, ${result.payload.user.name.split(" ")[0]}`);
    } else if (loginUser.rejected.match(result)) {
      toast.error(result.payload || "Sign-in failed");
    }
  };

  return (
    <main className={styles.authPage}>
      <ThemeToggleButton className={styles.authThemeToggle} />
      <a href="#login-form" className={styles.visuallyHidden}>
        Skip to sign-in form
      </a>
      <form id="login-form" className={styles.authPanel} onSubmit={submit}>
        <div className={styles.authBrand}>
          <BrandMark />
          <div>
            <h1>Welcome back</h1>
          </div>
        </div>
        <p className={styles.authSubtitle}>Sign in to upload documents and chat with your indexed content.</p>
        <label htmlFor="login-email">
          Email
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </label>
        <label htmlFor="login-password">
          Password
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
        </label>
        {error && (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        )}
        <button className={styles.primaryButton} type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className={styles.authSwitch}>
          New here? <Link to="/register">Create an account</Link>
        </p>
        <Link to="/" className={styles.authHomeLink}>
          ← Back to home
        </Link>
      </form>
    </main>
  );
}

export default Login;
