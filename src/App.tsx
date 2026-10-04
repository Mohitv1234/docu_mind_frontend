import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  FileText,
  Files,
  FileUp,
  Filter,
  Gauge,
  HardDrive,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "./services/api";

type Health = { api: string; database: string; redis: string };
type Doc = {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
  status: string;
  createdAt: string;
  summary?: string;
  aiError?: string | null;
  chunkCount?: number;
};
type SearchResult = {
  _id: string;
  text: string;
  score: number;
  document: { _id: string; originalName: string; summary?: string };
};
type AdminStats = {
  users: number;
  documents: number;
  chunks: number;
  storageBytes: number;
  recentUploads: number;
  statuses: { processing: number; completed: number; failed: number };
};
type Page = "overview" | "documents" | "search" | "admin" | "settings";
const nav: { id: Page; label: string; icon: LucideIcon; admin?: boolean }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "documents", label: "My documents", icon: Files },
  { id: "search", label: "AI search", icon: Search },
  { id: "admin", label: "Administration", icon: Gauge, admin: true },
  { id: "settings", label: "Settings", icon: Settings2 },
];
const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState(localStorage.getItem("accessToken") || "");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [page, setPage] = useState<Page>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [filter, setFilter] = useState("all");
  const fileInput = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    if (!localStorage.getItem("accessToken")) {
      setDocuments([]);
      return;
    }
    try {
      const response = await api.get("/documents", {
        params: { page: 1, limit: 50 },
      });
      setDocuments(response.data.data || []);
    } catch {
      setDocuments([]);
    }
  }
  async function loadAdminData() {
    if (role !== "admin") return;
    setAdminBusy(true);
    try {
      const response = await api.get("/admin/stats");
      setAdminStats(response.data.data);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Could not load admin statistics.",
      );
    } finally {
      setAdminBusy(false);
    }
  }
  useEffect(() => {
    api
      .get("/health")
      .then((r) => setHealth(r.data.data))
      .catch(() => setHealth(null));
    if (localStorage.getItem("accessToken")) {
      api
        .get("/auth/me")
        .then((r) => setRole(r.data.data.role))
        .catch(() => {
          localStorage.removeItem("accessToken");
          setToken("");
        });
      loadDocuments();
    }
  }, []);
  useEffect(() => {
    if (token && role === "admin") loadAdminData();
  }, [token, role]);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setAuthBusy(true);
    try {
      const endpoint =
        authMode === "register" ? "/auth/register" : "/auth/login";
      const payload =
        authMode === "register"
          ? { name: authName, email: authEmail, password: authPassword }
          : { email: authEmail, password: authPassword };
      const response = await api.post(endpoint, payload);
      const nextToken = response.data.data.token;
      localStorage.setItem("accessToken", nextToken);
      setToken(nextToken);
      setRole(response.data.data.user.role);
      await loadDocuments();
      setMessage("Welcome to your workspace.");
    } catch (err: any) {
      setError(err.response?.data?.message || "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }
  function signOut() {
    localStorage.removeItem("accessToken");
    setToken("");
    setRole("user");
    setAdminStats(null);
    setDocuments([]);
    setPage("overview");
    setMessage("");
  }
  async function handleUpload(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    if (!/\.(pdf|txt)$/i.test(file.name)) {
      setError("Please choose a PDF or TXT file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("This file is larger than 5 MB. Choose a smaller file.");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setUploading(true);
    try {
      const response = await api.post("/documents/upload", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(
        `${response.data.data.originalName} uploaded. ${response.data.data.textLength.toLocaleString()} characters extracted. ${response.data.aiMessage || ""}`,
      );
      await loadDocuments();
      if (role === "admin") await loadAdminData();
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleUpload(event.dataTransfer.files?.[0]);
  }
  async function runSearch(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSearchBusy(true);
    try {
      const response = await api.get("/documents/search", {
        params: { q: query },
      });
      setSearchResults(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Semantic search failed.");
      setSearchResults([]);
    } finally {
      setSearchBusy(false);
    }
  }
  async function removeDocument(id: string) {
    if (
      !window.confirm(
        "Delete this document permanently? This action cannot be undone.",
      )
    )
      return;
    try {
      await api.delete(`/documents/${id}`);
      await loadDocuments();
      if (role === "admin") await loadAdminData();
      setMessage("Document deleted.");
    } catch (err: any) {
      setError(err.response?.data?.message || "Could not delete document.");
    }
  }
  async function refreshSummary(id: string) {
    setError("");
    setMessage("Regenerating summary and embeddings…");
    try {
      const response = await api.post(`/admin/refresh-summary/${id}`);
      await loadDocuments();
      await loadAdminData();
      setMessage(response.data.message || "Summary regenerated.");
    } catch (err: any) {
      setError(err.response?.data?.message || "Could not regenerate summary.");
      setMessage("");
    }
  }

  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0);
  const filteredDocs = useMemo(
    () =>
      filter === "all"
        ? documents
        : documents.filter((d) => d.status === filter),
    [documents, filter],
  );
  const pageTitle = nav.find((item) => item.id === page)?.label || "Overview";

  if (!token)
    return (
      <div className="auth-shell">
        <div className="auth-art">
          <div className="auth-art-inner">
            <div className="brand brand-light">
              <span className="brand-mark">
                <Sparkles size={19} />
              </span>
              <span>
                <b>DocuMind</b>
                <small>DOCUMENT INTELLIGENCE</small>
              </span>
            </div>
            <div className="auth-copy">
              <div className="eyebrow">
                <span className="pulse-dot" /> YOUR KNOWLEDGE, CONNECTED
              </div>
              <h1>
                Every document.
                <br />
                <em>One clear view.</em>
              </h1>
              <p>
                Turn scattered files into searchable knowledge. Summaries,
                semantic search, and a secure workspace — all in one place.
              </p>
              <div className="auth-feature">
                <span>
                  <Zap size={16} />
                </span>
                <div>
                  <b>Understand faster</b>
                  <small>
                    AI-generated summaries bring the key points forward.
                  </small>
                </div>
              </div>
              <div className="auth-feature">
                <span>
                  <LockKeyhole size={16} />
                </span>
                <div>
                  <b>Stay in control</b>
                  <small>Your documents remain scoped to your account.</small>
                </div>
              </div>
            </div>
            <div className="auth-art-foot">
              BUILT FOR YOUR DOCUMENT WORKFLOW <span>•</span> PRIVATE BY DESIGN
            </div>
          </div>
        </div>
        <div className="auth-form-side">
          <form className="auth-card" onSubmit={authenticate}>
            <div className="mobile-brand brand">
              <span className="brand-mark">
                <Sparkles size={18} />
              </span>
              <b>DocuMind</b>
            </div>
            <div className="auth-kicker">
              {authMode === "login" ? "WELCOME BACK" : "GET STARTED"}
            </div>
            <h2>
              {authMode === "login"
                ? "Sign in to your workspace"
                : "Create your workspace"}
            </h2>
            <p className="muted">
              {authMode === "login"
                ? "Enter your details to access your documents."
                : "Create an account to start organizing your knowledge."}
            </p>
            {authMode === "register" && (
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                required
                minLength={8}
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary btn-full" disabled={authBusy}>
              {authBusy ? <LoaderCircle className="spin" size={17} /> : null}
              {authBusy
                ? "Please wait…"
                : authMode === "login"
                  ? "Sign in"
                  : "Create account"}
              <ArrowRight size={16} />
            </button>
            <div className="auth-switch">
              {authMode === "login"
                ? "New to DocuMind?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setError("");
                }}
              >
                {authMode === "login" ? "Create an account" : "Sign in"}
              </button>
            </div>
            <div className="auth-secure">
              <ShieldCheck size={15} /> Secure authentication · Encrypted
              connection
            </div>
          </form>
        </div>
      </div>
    );

  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <span>
            <b>DocuMind</b>
            <small>DOCUMENT INTELLIGENCE</small>
          </span>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">
          {nav
            .filter((item) => !item.admin || role === "admin")
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`nav-link ${page === item.id ? "active" : ""}`}
                  onClick={() => {
                    setPage(item.id);
                    setMobileNav(false);
                    setError("");
                  }}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {item.id === "admin" && (
                    <span className="nav-tag">ADMIN</span>
                  )}
                </button>
              );
            })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="privacy-card">
          <div className="privacy-icon">
            <ShieldCheck size={17} />
          </div>
          <b>Your files, your space</b>
          <p>
            Documents are private to your account. Access is protected by your
            sign-in.
          </p>
        </div>
        <div className="profile-row">
          <div className="avatar">
            {(authEmail || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="profile-meta">
            <b>{authEmail || "Your account"}</b>
            <small>
              {role === "admin" ? "Administrator" : "Personal workspace"}
            </small>
          </div>
          <button
            className="icon-btn"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn menu-trigger"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumbs">
              Workspace <span>/</span> <b>{pageTitle}</b>
            </div>
          </div>
          <div className="topbar-right">
            <div className="connection-pill">
              <span
                className={`connection-dot ${health?.api === "ok" ? "online" : ""}`}
              />
              {health?.api === "ok"
                ? "All systems operational"
                : "Connecting to services"}
            </div>
            <div className="avatar avatar-small">
              {(authEmail || "U").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="page-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "admin" ? "PLATFORM CONTROL" : "YOUR WORKSPACE"}
              </div>
              <h1>{page === "overview" ? "Good to see you." : pageTitle}</h1>
              <p>
                {page === "overview"
                  ? "A calm place to organize, understand, and find your documents."
                  : page === "documents"
                    ? "Browse your files and revisit the insights they contain."
                    : page === "search"
                      ? "Ask a question and find relevant passages across your library."
                      : page === "admin"
                        ? "Monitor platform activity and manage document processing."
                        : "Your workspace status and account preferences."}
              </p>
            </div>
            {page !== "settings" && (
              <button
                className="btn btn-primary"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                <Plus size={17} />
                {uploading ? "Uploading…" : "Upload document"}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            className="sr-only"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
          {(message || error) && (
            <div className={`alert ${error ? "alert-error" : "alert-success"}`}>
              <span>{error || message}</span>
              <button
                className="icon-btn"
                onClick={() => {
                  setMessage("");
                  setError("");
                }}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {page === "overview" && (
            <>
              <section
                className={`upload-zone ${dragging ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <div className="upload-icon">
                  <FileUp size={22} />
                </div>
                <div className="upload-copy">
                  <b>
                    {uploading
                      ? "Processing your document…"
                      : dragging
                        ? "Drop your file to upload"
                        : "Bring your documents into focus"}
                  </b>
                  <p>
                    Drag and drop a PDF or TXT file here, or{" "}
                    <button onClick={() => fileInput.current?.click()}>
                      browse files
                    </button>
                  </p>
                  <small>PDF or TXT · Maximum file size 5 MB</small>
                </div>
                <div className="upload-action">
                  <button
                    className="btn btn-secondary"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                  >
                    <UploadCloud size={16} /> Choose file
                  </button>
                </div>
              </section>
              <section className="stats-grid">
                <Stat
                  icon={Files}
                  label="Documents"
                  value={String(documents.length)}
                  note="In your library"
                />
                <Stat
                  icon={HardDrive}
                  label="Storage used"
                  value={formatBytes(totalSize)}
                  note="Original file sizes"
                />
                <Stat
                  icon={Activity}
                  label="AI processed"
                  value={String(
                    documents.filter((d) => d.status === "completed").length,
                  )}
                  note="Ready to search"
                />
              </section>
              <section className="content-grid">
                <div className="surface document-surface">
                  <div className="section-head">
                    <div>
                      <h2>Recent documents</h2>
                      <p>Your latest additions to the library</p>
                    </div>
                    <button
                      className="text-action"
                      onClick={() => setPage("documents")}
                    >
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  <DocumentList
                    docs={documents.slice(0, 5)}
                    role={role}
                    onDelete={removeDocument}
                    onRefresh={refreshSummary}
                    onUpload={() => fileInput.current?.click()}
                  />
                </div>
                <div className="right-stack">
                  <div className="surface search-promo">
                    <div className="promo-icon">
                      <Sparkles size={19} />
                    </div>
                    <div className="eyebrow">AI-POWERED DISCOVERY</div>
                    <h2>
                      Find the insight,
                      <br />
                      not just the file.
                    </h2>
                    <p>
                      Search across your documents using natural language. Ask a
                      question and discover relevant passages.
                    </p>
                    <button
                      className="btn btn-primary btn-full"
                      onClick={() => setPage("search")}
                    >
                      Explore AI search <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="surface system-surface">
                    <div className="section-head">
                      <div>
                        <h2>System status</h2>
                        <p>Connected services</p>
                      </div>
                      <Activity size={17} className="subtle-icon" />
                    </div>
                    <ServiceStatus health={health} />
                  </div>
                </div>
              </section>
              {role === "admin" && (
                <AdminOverview
                  stats={adminStats}
                  busy={adminBusy}
                  refresh={loadAdminData}
                />
              )}
            </>
          )}

          {page === "documents" && (
            <section className="surface full-surface">
              <div className="section-head section-head-wrap">
                <div>
                  <h2>Document library</h2>
                  <p>
                    {documents.length} file{documents.length === 1 ? "" : "s"}{" "}
                    in your workspace
                  </p>
                </div>
                <div className="filter-control">
                  <Filter size={15} />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    aria-label="Filter documents"
                  >
                    <option value="all">All statuses</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="failed">Failed</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
              <DocumentList
                docs={filteredDocs}
                role={role}
                onDelete={removeDocument}
                onRefresh={refreshSummary}
                onUpload={() => fileInput.current?.click()}
              />
            </section>
          )}

          {page === "search" && (
            <section className="search-page">
              <div className="surface search-panel">
                <div className="search-hero-icon">
                  <Sparkles size={23} />
                </div>
                <div className="eyebrow">MEANING-BASED DISCOVERY</div>
                <h2>What would you like to find?</h2>
                <p>
                  Search the content of your documents with a question or a
                  phrase. Results are limited to documents you can access.
                </p>
                <form className="search-form" onSubmit={runSearch}>
                  <Search size={19} />
                  <input
                    minLength={3}
                    required
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. What are the key project deadlines?"
                  />
                  <button
                    className="btn btn-primary"
                    disabled={!query.trim() || searchBusy}
                  >
                    {searchBusy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Search size={16} />
                    )}
                    Search
                  </button>
                </form>
                <div className="suggestions">
                  <span>TRY</span>
                  {[
                    "Project deadlines",
                    "Key financial figures",
                    "Important decisions",
                  ].map((s) => (
                    <button key={s} onClick={() => setQuery(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {searchBusy && (
                <div className="search-loading">
                  <LoaderCircle className="spin" size={18} /> Finding relevant
                  passages…
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="results-wrap">
                  <div className="section-head">
                    <div>
                      <h2>Search results</h2>
                      <p>
                        {searchResults.length} relevant passage
                        {searchResults.length === 1 ? "" : "s"} found
                      </p>
                    </div>
                    <span className="result-label">
                      <Sparkles size={13} /> AI MATCHES
                    </span>
                  </div>
                  {searchResults.map((result, i) => (
                    <article
                      key={result._id || i}
                      className="surface result-card"
                    >
                      <div className="result-top">
                        <div className="file-label">
                          <span className="file-mini">
                            <FileText size={15} />
                          </span>
                          <b>{result.document?.originalName || "Document"}</b>
                        </div>
                        <span className="match-score">
                          {(result.score * 100).toFixed(1)}% match
                        </span>
                      </div>
                      <p className="result-text">{result.text}</p>
                      {result.document?.summary && (
                        <details className="summary-details">
                          <summary>View AI summary</summary>
                          <p>{result.document.summary}</p>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {!searchBusy && query && searchResults.length === 0 && !error && (
                <div className="surface empty-state">
                  <div className="empty-icon">
                    <Search size={21} />
                  </div>
                  <b>No passages to show yet</b>
                  <p>
                    Try a broader question or different wording. Make sure your
                    documents have finished processing.
                  </p>
                </div>
              )}
            </section>
          )}

          {page === "admin" && role === "admin" && (
            <section className="admin-page">
              <div className="admin-banner">
                <div className="admin-banner-icon">
                  <ShieldCheck size={21} />
                </div>
                <div>
                  <b>Administrator console</b>
                  <p>
                    Platform-wide metrics and document operations. Admin
                    permissions are enforced by the API.
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={loadAdminData}
                  disabled={adminBusy}
                >
                  {adminBusy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <RefreshCw size={15} />
                  )}{" "}
                  Refresh
                </button>
              </div>
              <AdminOverview
                stats={adminStats}
                busy={adminBusy}
                refresh={loadAdminData}
              />
              <div className="surface full-surface">
                <div className="section-head">
                  <div>
                    <h2>All documents</h2>
                    <p>Manage documents across the platform</p>
                  </div>
                  <span className="admin-tag">
                    <ShieldCheck size={13} /> ADMIN ACCESS
                  </span>
                </div>
                <DocumentList
                  docs={documents}
                  role={role}
                  onDelete={removeDocument}
                  onRefresh={refreshSummary}
                  onUpload={() => fileInput.current?.click()}
                />
              </div>
            </section>
          )}

          {page === "settings" && (
            <section className="settings-grid">
              <div className="surface settings-card">
                <div className="settings-icon">
                  <LockKeyhole size={19} />
                </div>
                <h2>Account & privacy</h2>
                <p>
                  Your documents are associated with your account. Sign out when
                  you are using a shared device.
                </p>
                <div className="settings-detail">
                  <span>Signed in as</span>
                  <b>{authEmail}</b>
                </div>
                <div className="settings-detail">
                  <span>Access level</span>
                  <b>{role === "admin" ? "Administrator" : "Standard user"}</b>
                </div>
                <button className="btn btn-secondary" onClick={signOut}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
              <div className="surface settings-card">
                <div className="settings-icon">
                  <Activity size={19} />
                </div>
                <h2>Connected services</h2>
                <p>Live status reported by your backend health endpoint.</p>
                <ServiceStatus health={health} />
                <button
                  className="text-action settings-refresh"
                  onClick={() =>
                    api
                      .get("/health")
                      .then((r) => setHealth(r.data.data))
                      .catch(() => setHealth(null))
                  }
                >
                  <RefreshCw size={14} /> Check connection
                </button>
              </div>
              <div className="surface settings-card">
                <div className="settings-icon">
                  <CircleHelp size={19} />
                </div>
                <h2>Supported documents</h2>
                <p>
                  DocuMind currently accepts the following file formats and
                  limits.
                </p>
                <div className="settings-detail">
                  <span>File types</span>
                  <b>PDF, TXT</b>
                </div>
                <div className="settings-detail">
                  <span>Maximum file size</span>
                  <b>5 MB per file</b>
                </div>
                <div className="settings-detail">
                  <span>AI search</span>
                  <b>Semantic matching</b>
                </div>
              </div>
            </section>
          )}

          <footer className="footer">
            <span>
              DOCUMIND <i>·</i> DOCUMENT INTELLIGENCE WORKSPACE
            </span>
            <span>
              <ShieldCheck size={13} /> Private by design
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function ServiceStatus({ health }: { health: Health | null }) {
  return (
    <div className="service-list">
      {[
        ["API", health?.api],
        ["MongoDB", health?.database],
        ["Redis", health?.redis],
      ].map(([name, status]) => {
        const ok = status === "ok" || status === "connected";
        return (
          <div className="service-row" key={name}>
            <span>{name}</span>
            <span className={`service-state ${ok ? "is-online" : ""}`}>
              <i />
              {status || "Checking"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
function AdminOverview({
  stats,
  busy,
  refresh,
}: {
  stats: AdminStats | null;
  busy: boolean;
  refresh: () => void;
}) {
  const metrics = stats
    ? [
        { label: "Registered users", value: String(stats.users), icon: Users },
        { label: "All documents", value: String(stats.documents), icon: Files },
        { label: "Indexed chunks", value: String(stats.chunks), icon: Command },
        {
          label: "Storage used",
          value: formatBytes(stats.storageBytes),
          icon: HardDrive,
        },
        {
          label: "Uploads · 7 days",
          value: String(stats.recentUploads),
          icon: Activity,
        },
        {
          label: "Failed processing",
          value: String(stats.statuses.failed),
          icon: Zap,
        },
      ]
    : [];
  return (
    <div className="admin-metrics">
      {metrics.map((item) => {
        const Icon = item.icon;
        return (
          <div className="stat-card" key={item.label}>
            <div className="stat-top">
              <span>{item.label}</span>
              <span className="stat-icon">
                <Icon size={16} />
              </span>
            </div>
            <strong>{item.value}</strong>
            <small>Platform metric</small>
          </div>
        );
      })}
      {!stats && (
        <div className="surface admin-empty">
          {busy
            ? "Loading platform statistics…"
            : "Platform statistics are not available."}
          <button className="text-action" onClick={refresh}>
            Try again <RefreshCw size={14} />
          </button>
        </div>
      )}
      <div className="surface status-breakdown">
        <div>
          <span className="status-dot done" />
          Completed <b>{stats?.statuses.completed ?? "—"}</b>
        </div>
        <div>
          <span className="status-dot working" />
          Processing <b>{stats?.statuses.processing ?? "—"}</b>
        </div>
        <div>
          <span className="status-dot failed" />
          Failed <b>{stats?.statuses.failed ?? "—"}</b>
        </div>
      </div>
    </div>
  );
}
function DocumentList({
  docs,
  role,
  onDelete,
  onRefresh,
  onUpload,
}: {
  docs: Doc[];
  role: "user" | "admin";
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
  onUpload: () => void;
}) {
  if (!docs.length)
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Files size={21} />
        </div>
        <b>Your library is ready</b>
        <p>
          Upload a PDF or TXT document to start building your searchable
          knowledge base.
        </p>
        <button className="btn btn-secondary" onClick={onUpload}>
          <UploadCloud size={16} /> Upload first document
        </button>
      </div>
    );
  return (
    <div className="doc-list">
      {docs.map((doc) => (
        <article className="doc-row" key={doc._id}>
          <div
            className={`doc-icon ${doc.extension === "pdf" ? "pdf" : "txt"}`}
          >
            <FileText size={19} />
            <small>{doc.extension.toUpperCase()}</small>
          </div>
          <div className="doc-main">
            <b title={doc.originalName}>{doc.originalName}</b>
            <div className="doc-meta">
              <span>{formatBytes(doc.size)}</span>
              <i>·</i>
              <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
              <i>·</i>
              <span>{doc.chunkCount || 0} chunks</span>
            </div>
            {doc.summary && (
              <details className="summary-details">
                <summary>Read AI summary</summary>
                <p>{doc.summary}</p>
              </details>
            )}
            {doc.aiError && <p className="doc-error">{doc.aiError}</p>}
          </div>
          <span
            className={`status-pill ${doc.status === "completed" ? "complete" : doc.status === "failed" ? "failure" : "pending"}`}
          >
            <i />
            {doc.status}
          </span>
          <div className="doc-actions">
            {role === "admin" && (
              <button
                className="icon-btn"
                onClick={() => onRefresh(doc._id)}
                title="Regenerate summary"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <button
              className="icon-btn danger-hover"
              onClick={() => onDelete(doc._id)}
              title="Delete document"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
