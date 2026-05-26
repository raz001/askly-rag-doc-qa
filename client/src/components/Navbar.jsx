import { useDispatch, useSelector } from "react-redux";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Sparkles, LogOut } from "lucide-react";
import ThemeToggleButton from "./ThemeToggleButton.jsx";
import { logout } from "../features/auth/authSlice.js";
import styles from "../styles/App.module.css";

function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <header className={styles.navbar}>
      <div className={styles.navLeft}>
        <Link to="/dashboard" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Sparkles size={20} strokeWidth={2} />
          </span>
          Askly
        </Link>
        <nav className={styles.navLinks} aria-label="Main">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
            end
          >
            Library
          </NavLink>
        </nav>
      </div>
      <div className={styles.navActions}>
        <ThemeToggleButton />
        {user && (
          <Link to="/account" className={styles.userChip} aria-label="Account settings">
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userAvatar} aria-hidden="true">
              {initial}
            </span>
          </Link>
        )}
        <button className={styles.secondaryButton} type="button" onClick={handleLogout}>
          <LogOut size={15} strokeWidth={1.8} style={{ marginRight: 6 }} />
          Sign out
        </button>
      </div>
    </header>
  );
}

export default Navbar;
