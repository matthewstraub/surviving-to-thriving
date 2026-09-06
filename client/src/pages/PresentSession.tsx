import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Loader2, Maximize, Minimize } from "lucide-react";
import QRCode from "qrcode";

/**
 * Full-screen view for projecting a session's join link to a room.
 *
 * Deliberately public: it shows only the QR code and join URL, both of which
 * students receive anyway. Keeping it unauthenticated means it opens on any
 * classroom machine, and — more importantly — a teacher session expiring
 * mid-class can never blank the screen in front of a room.
 */
export default function PresentSession() {
  const params = useParams<{ code: string }>();
  const code = params.code || "";

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const sessionQuery = trpc.session.getByCode.useQuery(
    { code },
    { enabled: !!code, retry: false }
  );

  const joinUrl = `${window.location.origin}/s/${code}`;
  /** Shown without the scheme — shorter to read, and browsers do not need it. */
  const displayUrl = joinUrl.replace(/^https?:\/\//, "");

  useEffect(() => {
    if (!code) return;
    // Rendered large, so generate well above display size to stay crisp.
    QRCode.toDataURL(joinUrl, {
      width: 1200,
      margin: 1,
      color: { dark: "#1e2028", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [code, joinUrl]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      rootRef.current?.requestFullscreen?.();
    }
  };

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (sessionQuery.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
        <h1 className="text-3xl font-serif font-bold mb-2">Session Not Found</h1>
        <p className="text-muted-foreground text-lg">
          This link is invalid or the session has been deleted.
        </p>
      </div>
    );
  }

  const session = sessionQuery.data;

  return (
    // h-dvh (not min-h-screen) so the flex children have a definite height to
    // resolve max-h-full against, and the view never scrolls on a projector.
    <div ref={rootRef} className="h-dvh overflow-hidden flex flex-col bg-background">
      {/* Title band */}
      <header className="bg-nu-ink text-white py-[2.5vh] px-6 relative shrink-0">
        <h1 className="text-center font-serif font-bold tracking-tight text-[clamp(1.75rem,5vh,3.5rem)]">
          Surviving to Thriving
        </h1>
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          className="absolute top-1/2 -translate-y-1/2 right-6 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          {isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Maximize className="h-5 w-5" />
          )}
        </button>
      </header>

      {/* QR code */}
      {/* The code is sized by the space the header and footer leave, rather than
          a fixed viewport fraction, so a taller footer — a closed-session notice,
          a long label wrapping — shrinks the code instead of overflowing. */}
      <main className="flex-1 flex items-center justify-center p-[3vh] min-h-0">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR code linking to ${displayUrl}`}
            className="max-h-full max-w-[74vw] rounded-2xl shadow-lg bg-white"
          />
        ) : (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        )}
      </main>

      {/* Session name and link */}
      <footer className="shrink-0 pb-[4vh] px-6 text-center space-y-[1.5vh]">
        {session?.label && (
          <p className="font-serif font-semibold text-[clamp(1.5rem,4vh,2.75rem)] text-foreground">
            {session.label}
          </p>
        )}

        <p className="text-[clamp(1.125rem,3.2vh,2.25rem)] tracking-tight text-muted-foreground break-all">
          {displayUrl.slice(0, displayUrl.lastIndexOf("/s/"))}
          <span className="font-semibold text-primary">
            {displayUrl.slice(displayUrl.lastIndexOf("/s/"))}
          </span>
        </p>

        {session && !session.isActive && (
          <p className="inline-flex items-center gap-2 text-destructive font-medium text-[clamp(0.875rem,2.2vh,1.25rem)]">
            <AlertTriangle className="h-[1em] w-[1em]" />
            This session is closed and is not accepting responses
          </p>
        )}
      </footer>
    </div>
  );
}
