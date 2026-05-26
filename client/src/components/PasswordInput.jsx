import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "../styles/App.module.css";

/**
 * Password input with a built-in show/hide eye toggle.
 * Drop-in replacement for <input type="password" /> — accepts all the same props.
 */
const PasswordInput = forwardRef(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <span className={`${styles.passwordField} ${className || ""}`}>
      <input
        ref={ref}
        {...props}
        type={visible ? "text" : "password"}
        className={styles.passwordFieldInput}
      />
      <button
        type="button"
        className={styles.passwordToggle}
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
      </button>
    </span>
  );
});

export default PasswordInput;
