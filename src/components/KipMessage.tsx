import { Kip } from "./Kip";
export function KipMessage({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <Kip size={110} className="animate-bob" />
      <p className="mt-4 max-w-xs font-display text-xl font-semibold">{children}</p>
      {action && <div className="mt-6 w-full max-w-xs">{action}</div>}
    </div>
  );
}
