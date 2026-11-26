import { createFileRoute } from "@tanstack/react-router";
import { KipMessage } from "@/components/KipMessage";

export const Route = createFileRoute("/_authenticated/revisar")({
  validateSearch: (s: Record<string, unknown>): { ilha?: string; modo?: string } => ({ ...(typeof s["ilha"] === "string" ? { ilha: s["ilha"] } : {}), ...(typeof s["modo"] === "string" ? { modo: s["modo"] } : {}) }),
  head: () => ({ meta: [{ title: "Synapse" }, { name: "description", content: "Synapse, estudos com o Kip." }] }),
  component: () => <KipMessage>Essa parte ainda está sendo construída 🛠️ Volto já!</KipMessage>,
});
