import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-accent/40 via-background to-background dark:from-primary/10 dark:via-background dark:to-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
        aria-hidden
      >
        <div className="absolute -left-32 top-20 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-24 top-40 size-64 rounded-full bg-sky-400/30 blur-3xl dark:bg-sky-500/20" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6 sm:py-24 md:py-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-primary/30 hover:text-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          Built for students & study groups
        </div>

        <div className="max-w-3xl space-y-4">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Academic Project Management Made Simple
          </h1>
          <p className="text-pretty text-base text-muted-foreground sm:text-lg md:text-xl">
            Plan coursework, collaborate with your team, and see contribution
            analytics so everyone stays accountable—without the clutter of
            enterprise tools.
          </p>
        </div>

        <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:max-w-md sm:flex-row sm:items-center">
          <Button
            size="lg"
            className="h-11 gap-2 shadow-md shadow-primary/25 transition-transform hover:scale-[1.02]"
            asChild
          >
            <Link href="/register">
              Get Started
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-11 transition-transform hover:scale-[1.02]" asChild>
            <Link href="/#features">Learn More</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
