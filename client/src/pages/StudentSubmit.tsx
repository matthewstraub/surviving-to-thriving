import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { CheckCircle2, Loader2, AlertTriangle, SmilePlus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import {
  getScaleColor,
  SCALE_LABELS,
  SCALE_SURVIVING,
  SCALE_THRIVING,
} from "@/lib/scale";

function EmojiPickerSection({
  selectedEmoji,
  onSelect,
}: {
  selectedEmoji: string;
  onSelect: (emoji: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  const handleEmojiSelect = (emoji: any) => {
    onSelect(emoji.native);
    setShowPicker(false);
  };

  return (
    <div className="bg-card rounded-xl p-4 border shadow-sm">
      {/* Selected emoji display / trigger button */}
      <div className="flex items-center justify-center gap-3">
        {selectedEmoji ? (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-3 px-5 py-3 rounded-xl border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all group"
          >
            <span className="text-4xl">{selectedEmoji}</span>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Tap to change
            </span>
          </button>
        ) : (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-accent transition-all text-muted-foreground hover:text-foreground"
          >
            <SmilePlus className="h-6 w-6" />
            <span className="text-sm font-medium">Search & pick an emoji</span>
          </button>
        )}
      </div>

      {/* Emoji Mart Picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="flex justify-end mb-1">
              <button
                onClick={() => setShowPicker(false)}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="w-full" style={{ display: "flex", justifyContent: "center" }}>
              <div className="w-full" ref={(el) => {
                // emoji-mart renders as a web component with shadow DOM;
                // dynamicWidth alone doesn't always fill the parent.
                if (el) {
                  const em = el.querySelector('em-emoji-picker') as HTMLElement | null;
                  if (em) {
                    em.style.width = '100%';
                    em.style.maxWidth = '100%';
                  }
                }
              }}>
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="light"
                  set="native"
                  previewPosition="none"
                  skinTonePosition="search"
                  maxFrequentRows={2}
                  perLine={8}
                  searchPosition="sticky"
                  navPosition="bottom"
                  dynamicWidth={true}
                  emojiVersion={15}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StudentSubmit() {
  const params = useParams<{ code: string }>();
  const code = params.code || "";

  const [studentName, setStudentName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);

  const sessionQuery = trpc.session.getByCode.useQuery(
    { code },
    { enabled: !!code, retry: false }
  );

  const submitMutation = trpc.submission.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Response submitted!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit");
    },
  });

  const canSubmit = useMemo(
    () => studentName.trim().length > 0 && selectedEmoji !== "",
    [studentName, selectedEmoji]
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitMutation.mutate({
      sessionCode: code,
      studentName: studentName.trim(),
      emoji: selectedEmoji,
      rating,
    });
  };

  // Error state
  if (sessionQuery.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Survey Not Found</h2>
            <p className="text-muted-foreground">
              This survey link is invalid or has expired. Please check with your instructor for the correct link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const session = sessionQuery.data;

  // Session closed
  if (session && !session.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Survey Closed</h2>
            <p className="text-muted-foreground">
              This check-in session is no longer accepting responses.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
        >
          <Card className="max-w-md w-full shadow-lg border-0">
            <CardContent className="pt-10 pb-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                <CheckCircle2 className="mx-auto h-16 w-16 text-chart-4 mb-4" />
              </motion.div>
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
                Thank You!
              </h2>
              <p className="text-muted-foreground text-lg mb-4">
                Your check-in has been recorded.
              </p>
              <div className="text-5xl mb-2">{selectedEmoji}</div>
              <p className="text-muted-foreground">
                {studentName} &middot; {rating}/10
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-nu-ink text-white py-6 px-4">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
            Surviving to Thriving
          </h1>
          {session?.label && (
            <p className="mt-1 text-white/80 text-sm">
              {session.label}
            </p>
          )}
          <p className="mt-2 text-white/70 text-sm">
            How are you doing today? Share honestly — your response is anonymous to classmates.
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <label className="block text-sm font-medium text-foreground mb-2">
            Your Name
          </label>
          <Input
            placeholder="Enter your first name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="h-12 text-base bg-card"
            maxLength={100}
          />
        </motion.div>

        {/* Rating Slider */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <label className="block text-sm font-medium text-foreground mb-3">
            How are you feeling? <span className="text-muted-foreground font-normal">({rating}/10)</span>
          </label>

          <div className="bg-card rounded-xl p-5 border shadow-sm">
            <div className="flex justify-between text-xs text-muted-foreground mb-4 px-1">
              <span className="font-medium" style={{ color: SCALE_SURVIVING }}>Surviving</span>
              <span className="font-medium" style={{ color: SCALE_THRIVING }}>Thriving</span>
            </div>

            {/* The filled track follows the rating's own scale color rather than the
                brand accent, so a 9/10 does not read as an alarming red bar. */}
            <Slider
              value={[rating]}
              onValueChange={(v) => setRating(v[0])}
              min={1}
              max={10}
              step={1}
              style={{ "--scale-fill": getScaleColor(rating) } as React.CSSProperties}
              className="mb-4 [&_[data-slot=slider-range]]:bg-[var(--scale-fill)] [&_[data-slot=slider-thumb]]:border-[var(--scale-fill)]"
            />

            <div className="flex justify-between text-xs text-muted-foreground px-0.5">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i + 1}
                  className={`w-5 text-center transition-all ${
                    rating === i + 1 ? "font-bold text-foreground scale-125" : ""
                  }`}
                >
                  {i + 1}
                </span>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={rating}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="text-center mt-4 text-sm font-medium"
                style={{ color: getScaleColor(rating) }}
              >
                {SCALE_LABELS[rating]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Emoji Picker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <label className="block text-sm font-medium text-foreground mb-2">
            Pick an emoji that represents how you feel
          </label>
          <EmojiPickerSection
            selectedEmoji={selectedEmoji}
            onSelect={setSelectedEmoji}
          />
        </motion.div>

        {/* Submit */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitMutation.isPending}
            className="w-full h-12 text-base font-semibold shadow-md"
            size="lg"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Check-In"
            )}
          </Button>
          {!canSubmit && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Please enter your name and select an emoji
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
