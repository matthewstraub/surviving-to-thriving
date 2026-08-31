import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Lock, Users, BarChart3, QrCode } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-nu-ink text-white">
        <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight mb-4">
              Surviving to Thriving
            </h1>
            <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
              A quick, anonymous classroom check-in that helps instructors
              understand how their students are really doing.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/teacher/login")}
              className="font-semibold px-8 h-12"
            >
              <Lock className="h-4 w-4 mr-2" />
              Teacher Dashboard
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: QrCode,
              title: "Easy Access",
              desc: "Students scan a QR code or click a link \u2014 no login required.",
            },
            {
              icon: BarChart3,
              title: "Real-Time Insights",
              desc: "Watch responses stream in live with group averages and outlier alerts.",
            },
            {
              icon: Users,
              title: "Class Pulse",
              desc: "See at a glance how your class is feeling, from surviving to thriving.",
            },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (i + 1) }}
            >
              <Card className="border-0 shadow-sm h-full">
                <CardContent className="pt-6 text-center">
                  <feature.icon className="h-8 w-8 mx-auto text-primary mb-3" />
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          Surviving to Thriving &middot; Classroom Check-In Tool
        </div>
      </div>
    </div>
  );
}
