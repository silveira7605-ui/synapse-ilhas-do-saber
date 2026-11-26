import { createFileRoute } from "@tanstack/react-router";
import { KipMessage } from "@/components/KipMessage";

export const Route = createFileRoute("/_authenticated/nova-ilha")({
  
  head: () => ({ meta: [{ title: "Synapse" }, { name: "description", content: "Synapse, estudos com o Kip." }] }),
  component: () => <KipMessage>Essa parte ainda está sendo construída 🛠️ Volto já!</KipMessage>,
});
