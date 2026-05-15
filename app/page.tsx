import {
  BarChart3,
  CheckSquare,
  TrendingUp,
  Users,
} from "lucide-react"

import { DashboardPreview } from "@/components/dashboard-preview"
import { FeatureCard } from "@/components/feature-card"
import { Footer } from "@/components/footer"
import { Hero } from "@/components/hero"
import { Navbar } from "@/components/navbar"

const features = [
  {
    icon: CheckSquare,
    title: "Task Management",
    description:
      "Break projects into clear tasks, deadlines, and owners so coursework never slips.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Comment, align, and ship together—built for labs, capstones, and group assignments.",
  },
  {
    icon: BarChart3,
    title: "Contribution Analytics",
    description:
      "See who contributed what with fair, lightweight signals—not surveillance.",
  },
  {
    icon: TrendingUp,
    title: "Productivity Tracking",
    description:
      "Spot bottlenecks early with simple trends that keep your cohort on track.",
  },
] as const

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />

        <section
          id="features"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need for academic teamwork
            </h2>
            <p className="mt-3 text-muted-foreground sm:text-lg">
              SyncDesk keeps collaboration visible and calm—so you can focus on
              learning, not logistics.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <FeatureCard
                key={f.title}
                icon={f.icon}
                title={f.title}
                description={f.description}
              />
            ))}
          </div>
        </section>

        <section
          id="preview"
          className="border-y border-border/60 bg-muted/20 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Analytics dashboard preview
              </h2>
              <p className="mt-3 text-muted-foreground sm:text-lg">
                A glimpse of how SyncDesk surfaces progress—ready when you connect
                your first project.
              </p>
            </div>
            <div className="mt-10">
              <DashboardPreview />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
