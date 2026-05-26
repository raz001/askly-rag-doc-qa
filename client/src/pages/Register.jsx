import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";
import PasswordInput from "../components/PasswordInput.jsx";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import { clearAuthError, registerUser } from "../features/auth/authSlice.js";
import styles from "../styles/App.module.css";

function BrandMark() {
  return (
    <Link to="/" className={styles.authBrandMark} aria-label="Back to home">
      <Sparkles size={24} strokeWidth={1.8} />
    </Link>
  );
}

function Register() {
  const dispatch = useDispatch();
  const { token, loading, error } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    const result = await dispatch(registerUser(form));
    if (registerUser.fulfilled.match(result)) {
      toast.success("Account created — welcome aboard");
    } else if (registerUser.rejected.match(result)) {
      toast.error(result.payload || "Could not create account");
    }
  };

  return (
    <main className={styles.authPage}>
      <ThemeToggleButton className={styles.authThemeToggle} />
      <a href="#register-form" className={styles.visuallyHidden}>
        Skip to registration form
      </a>
      <form id="register-form" className={styles.authPanel} onSubmit={submit}>
        <div className={styles.authBrand}>
          <BrandMark />
          <div>
            <h1>Create account</h1>
          </div>
        </div>
        <p className={styles.authSubtitle}>Get started with grounded document Q&amp;A in minutes.</p>
        <label htmlFor="register-name">
          Name
          <input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </label>
        <label htmlFor="register-email">
          Email
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </label>
        <label htmlFor="register-password">
          Password
          <PasswordInput
            id="register-password"
            name="password"
            autoComplete="new-password"
            minLength={6}
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
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p className={styles.authSwitch}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
        <Link to="/" className={styles.authHomeLink}>
          ← Back to home
        </Link>
      </form>
    </main>
  );
}

export default Register;
