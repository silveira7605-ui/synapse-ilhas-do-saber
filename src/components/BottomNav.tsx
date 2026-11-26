import { Link } from "@tanstack/react-router";
const items = [
  { to: "/", label: "Mapa", icon: "🗺️" },
  { to: "/revisar", label: "Revisar hoje", icon: "🃏" },
  { to: "/perfil", label: "Perfil", icon: "👤" },
] as const;
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-xl justify-around py-2">
        {items.map((i) => (
          <Link key={i.to} to={i.to} activeOptions={{ exact: true }}
            className="flex flex-col items-center rounded-2xl px-5 py-1.5 text-xs font-bold text-muted-foreground"
            activeProps={{ className: "bg-primary/20 !text-foreground" }}>
            <span className="text-2xl">{i.icon}</span>{i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
