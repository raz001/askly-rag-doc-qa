import { Link, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import {
  Sparkles,
  FileSearch,
  Zap,
  Quote,
  ShieldCheck,
  ArrowRight,
  Code2,
} from "lucide-react";
import ThemeToggleButton from "../components/ThemeToggleButton.jsx";
import styles from "../styles/App.module.css";

const FEATURES = [
  {
    icon: FileSearch,
    title: "Multi-format ingestion",
    description:
      "PDFs, Markdown, CSV, JSON, HTML, and more — extracted, chunked, and embedded for semantic search.",
  },
  {
    icon: Zap,
    title: "Streaming answers",
    description:
      "Tokens render as they arrive. Stop or regenerate anytime, with rate-limit aware retry built in.",
  },
  {
    icon: Quote,
    title: "Inline citations",
    description:
      "Every answer cites its sources. Click [1] to jump to the exact page or chunk in the document preview.",
  },
  {
    icon: ShieldCheck,
    title: "Owner-scoped & private",
    description:
      "JWT authentication, ownership checks on every endpoint, and your documents stay yours.",
  },
];

function Landing() {
  const { token } = useSelector((state) => state.auth);

  // If already signed in, send the user straight to their library.
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.landingPage}>
      <header className={styles.landingNav}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Sparkles size={20} strokeWidth={2} />
          </span>
          Askly
        </Link>
        <div className={styles.landingNavActions}>
          <ThemeToggleButton />
          <Link to="/login" className={styles.navLink}>
            Sign in
          </Link>
          <Link to="/register" className={styles.primaryButton}>
            Get started
          </Link>
        </div>
      </header>

      <main className={styles.landingMain}>
        <section className={styles.landingHero}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={styles.landingHeroContent}
          >
            <span className={styles.landingBadge}>
              <Sparkles size={14} strokeWidth={2} />
              Retrieval-augmented document Q&amp;A
            </span>
            <h1 className={styles.landingTitle}>
              Chat with your documents.
              <br />
              <span className={styles.landingTitleAccent}>Grounded answers, every time.</span>
            </h1>
            <p className={styles.landingLede}>
              Upload PDFs, Markdown, CSVs, and more. Askly indexes the content, retrieves the most
              relevant passages, and answers your questions with inline citations you can verify in
              one click.
            </p>
            <div className={styles.landingCta}>
              <Link to="/register" className={styles.primaryButton}>
                Get started — it&apos;s free
                <ArrowRight size={16} strokeWidth={2} style={{ marginLeft: 8 }} />
              </Link>
              <Link to="/login" className={styles.secondaryButton}>
                I already have an account
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={styles.landingHeroVisual}
            aria-hidden="true"
          >
            <div className={styles.heroMockChat}>
              <div className={styles.heroMockHeader}>
                <span className={styles.heroMockDot} />
                <span className={styles.heroMockDot} />
                <span className={styles.heroMockDot} />
              </div>
              <div className={styles.heroMockBody}>
                <div className={styles.heroMockUser}>What were the key findings?</div>
                <div className={styles.heroMockAssistant}>
                  The report identifies three key findings:
                  <ul>
                    <li>Strong autonomy as a top strength <span className={styles.heroMockChip}>1</span></li>
                    <li>Resilience under pressure <span className={styles.heroMockChip}>2</span></li>
                    <li>Drive for self-improvement <span className={styles.heroMockChip}>3</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className={styles.landingFeatures}>
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                className={styles.landingFeatureCard}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: idx * 0.07 }}
              >
                <div className={styles.landingFeatureIcon}>
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </motion.div>
            );
          })}
        </section>

        <section className={styles.landingCtaSection}>
          <h2>Ready to talk to your documents?</h2>
          <p>Sign up in seconds. Upload a file. Start asking.</p>
          <Link to="/register" className={styles.primaryButton}>
            Create your free account
            <ArrowRight size={16} strokeWidth={2} style={{ marginLeft: 8 }} />
          </Link>
        </section>
      </main>

      <footer className={styles.landingFooter}>
        <span>© {new Date().getFullYear()} Askly</span>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.landingFooterLink}
        >
          <Code2 size={14} strokeWidth={2} />
          View on GitHub
        </a>
      </footer>
    </div>
  );
}

export default Landing;
