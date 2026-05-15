import Link from "next/link"

import { LogoMark } from "@/components/logo-mark"
import { APP_NAME } from "@/lib/constants"

const footerLinks = [
  { href: "/#features", label: "Features" },
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
] as const

export function Footer() {
  return (
    <footer className="border-t border-border/80 bg-card/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <LogoMark size={36} className="shadow-md shadow-primary/10" />
            <span>{APP_NAME}</span>
          </Link>
          <p className="max-w-sm text-sm text-muted-foreground">
            A calm workspace for coursework, group projects, and transparent
            collaboration.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Footer">
          {footerLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-border/60 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </div>
    </footer>
  )
}
