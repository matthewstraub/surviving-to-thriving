import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  RotateCcw,
  Users,
  TrendingUp,
  AlertTriangle,
  QrCode,
  Copy,
  LogOut,
  Loader2,
  BarChart3,
  Link as LinkIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { flagNeedsCheckIn, getScaleColor, getScaleGradient } from "@/lib/scale";

type Submission = {
  id: number;
  sessionId: number;
  studentName: string;
  emoji: string;
  rating: number;
  ipAddress: string | null;
  createdAt: Date;
};

// ─── QR Code Modal ──────────────────────────────────────────────────
function QRCodeDisplay({
  url,
  sessionLabel,
}: {
  url: string;
  sessionLabel: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: { dark: "#1e2028", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [url]);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  return (
    <div className="text-center space-y-4">
      <h3 className="text-lg font-serif font-semibold">{sessionLabel}</h3>
      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="QR Code"
          className="mx-auto rounded-lg shadow-md"
        />
      )}
      <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
        <code className="text-xs flex-1 truncate">{url}</code>
        <Button variant="ghost" size="sm" onClick={copyLink}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Students can scan this QR code or use the link to submit their check-in
      </p>
    </div>
  );
}

// ─── Submission Row ─────────────────────────────────────────────────
function SubmissionRow({
  submission,
  needsCheckIn,
}: {
  submission: Submission;
  needsCheckIn: boolean;
}) {
  const positionPercent = ((submission.rating - 1) / 9) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
        needsCheckIn
          ? "bg-destructive/5 border border-destructive/20"
          : "bg-card border border-border/50 hover:border-border"
      }`}
    >
      <span className="text-2xl flex-shrink-0">{submission.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">
            {submission.studentName}
          </span>
          {needsCheckIn && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0 h-4"
            >
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
              needs check-in
            </Badge>
          )}
        </div>
        {/* Mini scale bar */}
        <div className="mt-1.5 relative h-2 rounded-full overflow-hidden bg-muted">
          <div
            className="absolute inset-0 rounded-full opacity-30"
            style={{ background: getScaleGradient() }}
          />
          <motion.div
            initial={{ left: "0%" }}
            animate={{ left: `${positionPercent}%` }}
            transition={{ type: "spring", damping: 20 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-md"
            style={{ backgroundColor: getScaleColor(submission.rating) }}
          />
        </div>
      </div>
      <span
        className="text-lg font-bold tabular-nums flex-shrink-0 w-8 text-right"
        style={{ color: getScaleColor(submission.rating) }}
      >
        {submission.rating}
      </span>
    </motion.div>
  );
}

// ─── Stats Card ─────────────────────────────────────────────────────
function StatsPanel({ submissions }: { submissions: Submission[] }) {
  const stats = useMemo(() => {
    if (submissions.length === 0)
      return { avg: 0, min: 0, max: 0, stdDev: 0, count: 0 };

    const ratings = submissions.map((s) => s.rating);
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const stdDev = Math.sqrt(
      ratings.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) /
        ratings.length
    );

    return {
      avg,
      min: Math.min(...ratings),
      max: Math.max(...ratings),
      stdDev,
      count: submissions.length,
    };
  }, [submissions]);

  const avgPositionPercent = stats.count > 0 ? ((stats.avg - 1) / 9) * 100 : 50;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 text-center">
          <Users className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{stats.count}</p>
          <p className="text-xs text-muted-foreground">Responses</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm col-span-2 lg:col-span-1 order-first lg:order-none">
        <CardContent className="p-4 text-center">
          <BarChart3 className="h-5 w-5 mx-auto text-primary mb-1" />
          <p
            className="text-2xl font-bold"
            style={{ color: stats.count > 0 ? getScaleColor(Math.round(stats.avg)) : undefined }}
          >
            {stats.count > 0 ? stats.avg.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Group Average</p>
          {stats.count > 0 && (
            <div className="mt-2 relative h-2 rounded-full overflow-hidden bg-muted">
              <div
                className="absolute inset-0 rounded-full opacity-40"
                style={{ background: getScaleGradient() }}
              />
              <motion.div
                initial={{ left: "50%" }}
                animate={{ left: `${avgPositionPercent}%` }}
                transition={{ type: "spring", damping: 15 }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg"
                style={{ backgroundColor: getScaleColor(Math.round(stats.avg)) }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-chart-4 mb-1" />
          <p className="text-2xl font-bold">
            {stats.count > 0 ? `${stats.min}–${stats.max}` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Range</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 text-center">
          <AlertTriangle className="h-5 w-5 mx-auto text-chart-5 mb-1" />
          <p className="text-2xl font-bold">
            {stats.count > 0 ? stats.stdDev.toFixed(1) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Std Dev</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────
export default function TeacherDashboard() {
  const [, navigate] = useLocation();
  const token = localStorage.getItem("teacher_token") || "";
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeSessionCode, setActiveSessionCode] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [localSubmissions, setLocalSubmissions] = useState<Submission[]>([]);

  // The token itself rides along in the Authorization header (see main.tsx).
  const verifyQuery = trpc.teacher.verify.useQuery(undefined, {
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (!token || (verifyQuery.data && !verifyQuery.data.valid)) {
      navigate("/teacher/login");
    }
  }, [token, verifyQuery.data, navigate]);

  // Sessions
  const sessionsQuery = trpc.session.list.useQuery(undefined, {
    enabled: !!token && verifyQuery.data?.valid === true,
  });

  // Submissions for active session
  const submissionsQuery = trpc.submission.listBySession.useQuery(
    { sessionCode: activeSessionCode || "" },
    {
      enabled: !!activeSessionCode && !!token,
      refetchInterval: 10000, // fallback polling every 10s
    }
  );

  // Sync server data to local state
  useEffect(() => {
    if (submissionsQuery.data) {
      setLocalSubmissions(submissionsQuery.data as Submission[]);
    }
  }, [submissionsQuery.data]);

  // WebSocket for real-time updates
  const { onNewSubmission, onSessionReset } = useSocket(activeSessionCode);

  useEffect(() => {
    if (!activeSessionCode) return;

    const unsubNew = onNewSubmission((submission) => {
      setLocalSubmissions((prev) => {
        const sub = submission as Submission;
        // Avoid duplicates
        if (prev.some((s) => s.id === sub.id)) return prev;
        return [sub, ...prev];
      });
      toast.info("New check-in received!", { duration: 2000 });
    });

    const unsubReset = onSessionReset(() => {
      setLocalSubmissions([]);
    });

    return () => {
      unsubNew();
      unsubReset();
    };
  }, [activeSessionCode, onNewSubmission, onSessionReset]);

  // Auto-select first active session
  useEffect(() => {
    if (sessionsQuery.data && sessionsQuery.data.length > 0 && !activeSessionId) {
      const active = sessionsQuery.data.find((s) => s.isActive) || sessionsQuery.data[0];
      setActiveSessionId(active.id);
      setActiveSessionCode(active.code);
    }
  }, [sessionsQuery.data, activeSessionId]);

  // Mutations
  const utils = trpc.useUtils();

  const createSessionMutation = trpc.session.create.useMutation({
    onSuccess: (session) => {
      utils.session.list.invalidate();
      setActiveSessionId(session.id);
      setActiveSessionCode(session.code);
      setLocalSubmissions([]);
      setNewLabel("");
      toast.success("New session created!");
    },
    onError: () => toast.error("Failed to create session"),
  });

  const resetMutation = trpc.session.reset.useMutation({
    onSuccess: () => {
      setLocalSubmissions([]);
      utils.submission.listBySession.invalidate();
      toast.success("Submissions cleared!");
    },
    onError: () => toast.error("Failed to reset"),
  });

  const deleteSessionMutation = trpc.session.delete.useMutation({
    onSuccess: () => {
      utils.session.list.invalidate();
      setActiveSessionId(null);
      setActiveSessionCode(null);
      setLocalSubmissions([]);
      toast.success("Session deleted");
    },
    onError: () => toast.error("Failed to delete session"),
  });

  const handleCreateSession = () => {
    createSessionMutation.mutate({
      label: newLabel.trim() || undefined,
    });
  };

  const handleReset = () => {
    if (!activeSessionId || !activeSessionCode) return;
    resetMutation.mutate({ id: activeSessionId, code: activeSessionCode });
  };

  const handleDeleteSession = () => {
    if (!activeSessionId) return;
    deleteSessionMutation.mutate({ id: activeSessionId });
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher_token");
    navigate("/teacher/login");
  };

  const needsCheckInIds = useMemo(() => {
    const flags = flagNeedsCheckIn(localSubmissions.map((s) => s.rating));
    return new Set(
      localSubmissions.filter((_, i) => flags[i]).map((s) => s.id)
    );
  }, [localSubmissions]);

  const studentUrl = activeSessionCode
    ? `${window.location.origin}/s/${activeSessionCode}`
    : "";

  const activeSession = sessionsQuery.data?.find(
    (s) => s.id === activeSessionId
  );

  if (verifyQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-nu-ink text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-serif font-bold">
              Surviving to Thriving
            </h1>
            <p className="text-xs text-white/70">
              Teacher Dashboard
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white/80 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 mr-1" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Session Management */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              Survey Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create new session */}
            <div className="flex gap-2">
              <Input
                placeholder="Session label (e.g., Monday 9am)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="flex-1 bg-background"
                onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
              />
              <Button
                onClick={handleCreateSession}
                disabled={createSessionMutation.isPending}
                size="default"
              >
                {createSessionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                New Session
              </Button>
            </div>

            {/* Session list */}
            {sessionsQuery.data && sessionsQuery.data.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sessionsQuery.data.map((session) => (
                  <Button
                    key={session.id}
                    variant={
                      activeSessionId === session.id ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => {
                      setActiveSessionId(session.id);
                      setActiveSessionCode(session.code);
                      setLocalSubmissions([]);
                    }}
                    className="text-xs"
                  >
                    {session.label || session.code}
                    {!session.isActive && (
                      <span className="ml-1 opacity-50">(closed)</span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Session Controls */}
        {activeSession && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQR(!showQR)}
              >
                <QrCode className="h-4 w-4 mr-1" />
                {showQR ? "Hide QR" : "Show QR Code"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(studentUrl);
                  toast.success("Link copied!");
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Link
              </Button>

              <div className="flex-1" />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all submissions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all student responses for this
                      session. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset}>
                      Reset All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Session
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the session and all its
                      submissions. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteSession}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* QR Code */}
            <AnimatePresence>
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-6">
                      <QRCodeDisplay
                        url={studentUrl}
                        sessionLabel={
                          activeSession.label || `Session ${activeSession.code}`
                        }
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats */}
            <StatsPanel submissions={localSubmissions} />

            {/* Submissions List */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Student Responses
                  {localSubmissions.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {localSubmissions.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {localSubmissions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No responses yet</p>
                    <p className="text-xs mt-1">
                      Share the QR code or link with your students to get started
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {localSubmissions.map((sub) => (
                        <SubmissionRow
                          key={sub.id}
                          submission={sub}
                          needsCheckIn={needsCheckInIds.has(sub.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* No sessions */}
        {sessionsQuery.data && sessionsQuery.data.length === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-12 text-center text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No sessions yet</p>
              <p className="text-xs mt-1">
                Create a new session above to get started
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
