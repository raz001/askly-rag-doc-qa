import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  MessageSquare,
  Save,
  Lock,
  Trash2,
} from "lucide-react";
import api, { getErrorMessage } from "../api/axios.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Navbar from "../components/Navbar.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import {
  changePassword,
  deleteAccount,
  fetchMe,
  logout,
  updateProfile,
} from "../features/auth/authSlice.js";
import styles from "../styles/App.module.css";

function StatCard({ icon: Icon, label, value }) {
  return (
    <motion.div
      className={styles.accountStat}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className={styles.accountStatIcon}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div>
        <div className={styles.accountStatValue}>{value}</div>
        <div className={styles.accountStatLabel}>{label}</div>
      </div>
    </motion.div>
  );
}

function Account() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [memberSince, setMemberSince] = useState(null);

  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setStatsLoading(true);
    dispatch(fetchMe())
      .unwrap()
      .then((data) => {
        if (!active) return;
        setStats(data.stats);
        setMemberSince(data.user?.createdAt);
      })
      .catch((err) => {
        if (active) toast.error(err || "Could not load account");
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dispatch]);

  // Keep the local name input in sync with the redux user (e.g. after save).
  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  const initial = useMemo(
    () => user?.name?.trim()?.charAt(0)?.toUpperCase() || "?",
    [user?.name]
  );

  const handleSaveName = async (event) => {
    event.preventDefault();
    if (!name.trim() || name.trim() === user?.name) return;
    setSavingName(true);
    const result = await dispatch(updateProfile({ name: name.trim() }));
    setSavingName(false);
    if (updateProfile.fulfilled.match(result)) {
      toast.success("Profile updated");
    } else {
      toast.error(result.payload || "Could not update profile");
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (pwForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setPwSaving(true);
    const result = await dispatch(
      changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      })
    );
    setPwSaving(false);
    if (changePassword.fulfilled.match(result)) {
      toast.success("Password updated");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      toast.error(result.payload || "Could not change password");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await dispatch(deleteAccount());
    setDeleting(false);
    setConfirmOpen(false);
    if (deleteAccount.fulfilled.match(result)) {
      toast.success("Account deleted");
      navigate("/", { replace: true });
    } else {
      toast.error(result.payload || "Could not delete account");
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className={styles.appShell}>
      <Navbar />
      <main className={`${styles.page} ${styles.accountPage}`} id="main-content">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={styles.backButton}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back
        </button>

        <header className={styles.accountHeader}>
          <div className={styles.accountAvatar} aria-hidden="true">{initial}</div>
          <div>
            <h1>{user?.name || "Your account"}</h1>
            <p>{user?.email}</p>
            <p className={styles.accountMeta}>Member since {formatDate(memberSince)}</p>
          </div>
        </header>

        <section className={styles.accountStatsRow} aria-label="Usage">
          <StatCard
            icon={FileText}
            label="Total documents"
            value={statsLoading ? "—" : stats?.documents ?? 0}
          />
          <StatCard
            icon={CheckCircle2}
            label="Ready to chat"
            value={statsLoading ? "—" : stats?.readyDocuments ?? 0}
          />
          <StatCard
            icon={MessageSquare}
            label="Chat messages"
            value={statsLoading ? "—" : stats?.messages ?? 0}
          />
        </section>

        <section className={styles.accountCard}>
          <h2>Profile</h2>
          <form onSubmit={handleSaveName} className={styles.accountForm}>
            <label htmlFor="account-name">
              Display name
              <input
                id="account-name"
                type="text"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label htmlFor="account-email">
              Email
              <input id="account-email" type="email" value={user?.email || ""} disabled />
              <small className={styles.accountHint}>
                Email changes aren&apos;t supported yet — contact support if you need this.
              </small>
            </label>
            <div className={styles.accountFormActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={savingName || !name.trim() || name.trim() === user?.name}
              >
                <Save size={15} strokeWidth={1.8} style={{ marginRight: 6 }} />
                {savingName ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.accountCard}>
          <h2>Change password</h2>
          <form onSubmit={handleChangePassword} className={styles.accountForm}>
            <label htmlFor="account-current-password">
              Current password
              <PasswordInput
                id="account-current-password"
                autoComplete="current-password"
                value={pwForm.currentPassword}
                onChange={(event) =>
                  setPwForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                }
                required
              />
            </label>
            <div className={styles.accountFormGrid}>
              <label htmlFor="account-new-password">
                New password
                <PasswordInput
                  id="account-new-password"
                  autoComplete="new-password"
                  minLength={6}
                  value={pwForm.newPassword}
                  onChange={(event) =>
                    setPwForm((prev) => ({ ...prev, newPassword: event.target.value }))
                  }
                  required
                />
              </label>
              <label htmlFor="account-confirm-password">
                Confirm new password
                <PasswordInput
                  id="account-confirm-password"
                  autoComplete="new-password"
                  minLength={6}
                  value={pwForm.confirmPassword}
                  onChange={(event) =>
                    setPwForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  required
                />
              </label>
            </div>
            <div className={styles.accountFormActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={
                  pwSaving ||
                  !pwForm.currentPassword ||
                  !pwForm.newPassword ||
                  !pwForm.confirmPassword
                }
              >
                <Lock size={15} strokeWidth={1.8} style={{ marginRight: 6 }} />
                {pwSaving ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </section>

        <section className={`${styles.accountCard} ${styles.accountDanger}`}>
          <h2>Danger zone</h2>
          <p>
            Deleting your account permanently removes your profile, all uploaded documents, every
            chat conversation, and the embeddings derived from them. This action cannot be undone.
          </p>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 size={15} strokeWidth={1.8} style={{ marginRight: 6 }} />
            Delete my account
          </button>
        </section>
      </main>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete account permanently?"
        description="All your documents, chats, and data will be removed. There is no recovery."
        confirmLabel="Yes, delete everything"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default Account;
