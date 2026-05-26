import styles from "../styles/App.module.css";

const statusLabels = {
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

function StatusBadge({ status }) {
  return <span className={`${styles.statusBadge} ${styles[status]}`}>{statusLabels[status] || status}</span>;
}

export default StatusBadge;
