import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function TeacherLogin() {
  const [password, setPassword] = useState("");
  const [, navigate] = useLocation();

  const loginMutation = trpc.teacher.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("teacher_token", data.token);
      toast.success("Welcome back!");
      navigate("/teacher");
    },
    onError: () => {
      toast.error("Invalid password. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    loginMutation.mutate({ password: password.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-serif">Teacher Dashboard</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your password to access the dashboard
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base bg-background"
                autoFocus
              />
              <Button
                type="submit"
                className="w-full h-11 font-semibold"
                disabled={!password.trim() || loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
